"""Unit tests for ``SessionService`` on a throwaway SQLite file (task 4.1, design D2).

Covers the decisions of spec ``login-session``: each sign-in is its own session, the
90-day and 7-day limits, rotation, the 30-second grace with one extra reissue and a
``409`` for the third use, reuse outside the grace revoking every session, revoked
sessions having no grace, and only an explicit logout recording ``logged_out_at``.
The same behaviour through HTTP on both databases is in the integration tests.
"""

import secrets
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import DatabaseSettings
from app.core.db import Base, create_engine
from app.core.tokens import AccessTokenCodec, TokenKeys, csrf_value_for, hash_token
from app.modules.account.models import AccountSession, User
from app.modules.account.service import (
    RefreshConflictError,
    SessionExpiredError,
    SessionInvalidError,
    SessionService,
    SourceInfo,
)
from tests.factories.accounts import add_user, sessions_of, tokens_of

NOW = datetime(2026, 11, 26, 8, 0, tzinfo=UTC)
SOURCE = SourceInfo(address="203.0.113.7", user_agent="pytest")
KEYS = TokenKeys.derive(SecretStr(secrets.token_urlsafe(48)))


@pytest.fixture
async def db(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    # The app's engine factory, so foreign keys are enforced as in production.
    engine = create_engine(DatabaseSettings(database_url=None, sqlite_path=tmp_path / "unit.db"))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


def _service(db: AsyncSession) -> SessionService:
    return SessionService(db, codec=AccessTokenCodec(KEYS.access), csrf_key=KEYS.csrf)


async def _signed_in(db: AsyncSession, user: User, at: datetime = NOW) -> tuple[str, str]:
    """Start a session at ``at`` and commit; return ``(raw refresh, session id)``."""
    issued = await _service(db).start(user, SOURCE, at)
    await db.commit()
    return issued.refresh_token, str(issued.session_id)


async def _age(db: AsyncSession, user: User, *, started: datetime, last_seen: datetime) -> None:
    await db.execute(
        update(AccountSession)
        .where(AccountSession.user_id == user.id)
        .values(started_at=started, last_seen_at=last_seen)
    )
    await db.commit()


# --- start -------------------------------------------------------------------------------


async def test_start_records_a_session_and_a_hashed_refresh_token(db: AsyncSession) -> None:
    user = await add_user(db)

    issued = await _service(db).start(user, SOURCE, NOW)
    await db.commit()

    (row,) = await sessions_of(db, user.id)
    assert (row.started_at, row.last_seen_at, row.revoked_at) == (NOW, NOW, None)
    assert row.source_info is not None and "203.0.113.7" in row.source_info
    (token,) = await tokens_of(db, row.id)
    assert token.token_hash == hash_token(issued.refresh_token)
    assert issued.refresh_token not in token.token_hash
    assert token.expires_at == NOW + timedelta(days=7) == issued.expires_at
    claims = AccessTokenCodec(KEYS.access).decode(issued.access_token, now=NOW)
    assert (claims.user_id, claims.session_id) == (user.id, row.id)
    assert claims.expires_at == NOW + timedelta(minutes=15)
    assert issued.csrf_token == csrf_value_for(KEYS.csrf, row.id)
    assert issued.user is user


async def test_each_sign_in_is_its_own_session(db: AsyncSession) -> None:
    user = await add_user(db)

    await _signed_in(db, user, NOW)
    await _signed_in(db, user, NOW + timedelta(hours=1))

    rows = await sessions_of(db, user.id)
    assert [row.started_at for row in rows] == [NOW, NOW + timedelta(hours=1)]


# --- refresh -----------------------------------------------------------------------------


async def test_refresh_rotates_the_token_and_moves_the_idle_line(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    later = NOW + timedelta(days=2)

    issued = await _service(db).refresh(raw, later)

    (row,) = await sessions_of(db, user.id)
    old, new = await tokens_of(db, row.id)
    assert issued.refresh_token != raw
    assert old.consumed_at == later
    assert new.token_hash == hash_token(issued.refresh_token)
    assert new.expires_at == later + timedelta(days=7)
    assert row.last_seen_at == later
    assert issued.session_id == row.id


async def test_unknown_refresh_token_is_invalid(db: AsyncSession) -> None:
    with pytest.raises(SessionInvalidError):
        await _service(db).refresh(secrets.token_urlsafe(32), NOW)


async def test_refresh_after_ninety_days_expires_without_recording_a_logout(
    db: AsyncSession,
) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    now = NOW + timedelta(days=90)
    await _age(db, user, started=NOW, last_seen=now - timedelta(minutes=1))

    with pytest.raises(SessionExpiredError):
        await _service(db).refresh(raw, now)

    (row,) = await sessions_of(db, user.id)
    assert row.revoked_at == now
    assert row.logged_out_at is None


async def test_refresh_after_seven_days_idle_expires(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)

    with pytest.raises(SessionExpiredError):
        await _service(db).refresh(raw, NOW + timedelta(days=7, minutes=1))

    (row,) = await sessions_of(db, user.id)
    assert row.revoked_at is not None
    assert row.logged_out_at is None


async def test_extending_near_the_limit_stops_at_ninety_days(db: AsyncSession) -> None:
    user = await add_user(db)
    started = NOW - timedelta(days=89)
    raw, _ = await _signed_in(db, user, started)
    await _age(db, user, started=started, last_seen=NOW - timedelta(days=1))

    issued = await _service(db).refresh(raw, NOW)

    limit = started + timedelta(days=90)
    assert issued.expires_at == limit
    claims = AccessTokenCodec(KEYS.access).decode(issued.access_token, now=NOW)
    assert claims.expires_at <= limit


async def test_second_use_within_the_grace_reissues_for_the_same_session(
    db: AsyncSession,
) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    first = await _service(db).refresh(raw, NOW + timedelta(minutes=20))

    second = await _service(db).refresh(raw, NOW + timedelta(minutes=20, seconds=10))

    rows = await sessions_of(db, user.id)
    assert len(rows) == 1
    assert rows[0].revoked_at is None
    assert first.session_id == second.session_id == rows[0].id
    assert first.refresh_token != second.refresh_token
    tokens = await tokens_of(db, rows[0].id)
    assert [token.reissue_count for token in tokens][0] == 1
    assert len(tokens) == 3


async def test_third_use_within_the_grace_conflicts_and_revokes_nothing(
    db: AsyncSession,
) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    other_raw, _ = await _signed_in(db, user)
    await _service(db).refresh(raw, NOW + timedelta(minutes=20))
    await _service(db).refresh(raw, NOW + timedelta(minutes=20, seconds=5))

    with pytest.raises(RefreshConflictError):
        await _service(db).refresh(raw, NOW + timedelta(minutes=20, seconds=10))

    assert all(row.revoked_at is None for row in await sessions_of(db, user.id))
    await _service(db).refresh(other_raw, NOW + timedelta(minutes=21))


async def test_reuse_outside_the_grace_revokes_every_session(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    other_raw, _ = await _signed_in(db, user)
    await _service(db).refresh(raw, NOW + timedelta(minutes=20))

    with pytest.raises(SessionInvalidError):
        await _service(db).refresh(raw, NOW + timedelta(minutes=21))

    rows = await sessions_of(db, user.id)
    assert all(row.revoked_at is not None for row in rows)
    assert all(row.logged_out_at is None for row in rows)
    with pytest.raises(SessionInvalidError):
        await _service(db).refresh(other_raw, NOW + timedelta(minutes=22))


async def test_a_logged_out_session_has_no_grace(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    other_raw, _ = await _signed_in(db, user)
    await _service(db).logout(raw, NOW + timedelta(minutes=1))

    with pytest.raises(SessionInvalidError):
        await _service(db).refresh(raw, NOW + timedelta(minutes=1, seconds=5))

    _, other = await sessions_of(db, user.id)
    assert other.revoked_at is None
    await _service(db).refresh(other_raw, NOW + timedelta(minutes=2))


async def test_a_deactivated_account_cannot_refresh(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    await db.execute(update(User).where(User.id == user.id).values(is_active=False))
    await db.commit()

    with pytest.raises(SessionInvalidError):
        await _service(db).refresh(raw, NOW + timedelta(minutes=20))

    (row,) = await sessions_of(db, user.id)
    (token,) = await tokens_of(db, row.id)
    assert token.consumed_at is None


# --- logout and revoke_all -----------------------------------------------------------------


async def test_logout_ends_only_this_session_and_records_the_logout(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    await _signed_in(db, user)

    await _service(db).logout(raw, NOW + timedelta(hours=1))

    mine, other = await sessions_of(db, user.id)
    assert mine.revoked_at == mine.logged_out_at == NOW + timedelta(hours=1)
    assert other.revoked_at is None


@pytest.mark.parametrize("raw", [None, "", "unknown-value"])
async def test_logout_without_a_usable_token_writes_nothing(
    db: AsyncSession, raw: str | None
) -> None:
    user = await add_user(db)
    await _signed_in(db, user)

    await _service(db).logout(raw, NOW + timedelta(hours=1))

    (row,) = await sessions_of(db, user.id)
    assert row.revoked_at is None


async def test_logout_of_an_already_ended_session_records_nothing(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)
    await _service(db).revoke_all(user.id, NOW + timedelta(minutes=1))
    await db.commit()

    await _service(db).logout(raw, NOW + timedelta(minutes=2))

    (row,) = await sessions_of(db, user.id)
    assert row.revoked_at == NOW + timedelta(minutes=1)
    assert row.logged_out_at is None


async def test_logout_of_an_expired_session_records_no_logout(db: AsyncSession) -> None:
    user = await add_user(db)
    raw, _ = await _signed_in(db, user)

    await _service(db).logout(raw, NOW + timedelta(days=8))

    (row,) = await sessions_of(db, user.id)
    assert row.revoked_at is None
    assert row.logged_out_at is None
