"""Unit tests for ``AccountPrincipalLoader`` on a throwaway SQLite file (task 4.1).

Steps 1 and 2 of authorization read the session and the account from the database on
every request (spec ``auth-guard``): any reason to refuse is the same
``AuthenticationRequiredError``, and the role comes from the database, never the token.
"""

import secrets
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from pydantic import SecretStr
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import AuthenticationRequiredError, Principal, PrincipalLoader
from app.core.config import DatabaseSettings
from app.core.db import Base, create_engine
from app.core.tokens import AccessClaims, AccessTokenCodec, TokenKeys
from app.modules.account.models import AccountSession, User
from app.modules.account.service import AccountPrincipalLoader, SessionService, SourceInfo
from tests.factories.accounts import add_user

NOW = datetime(2026, 11, 26, 8, 0, tzinfo=UTC)
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


def _loader(at: datetime = NOW) -> AccountPrincipalLoader:
    return AccountPrincipalLoader(clock=lambda: at)


async def _claims(db: AsyncSession, user: User) -> AccessClaims:
    service = SessionService(db, codec=AccessTokenCodec(KEYS.access), csrf_key=KEYS.csrf)
    issued = await service.start(user, SourceInfo(address="", user_agent=""), NOW)
    await db.commit()
    return AccessTokenCodec(KEYS.access).decode(issued.access_token, now=NOW)


async def _set_user(db: AsyncSession, user: User, **values: Any) -> None:
    await db.execute(update(User).where(User.id == user.id).values(**values))
    await db.commit()


async def _set_session(db: AsyncSession, claims: AccessClaims, **values: Any) -> None:
    await db.execute(
        update(AccountSession).where(AccountSession.id == claims.session_id).values(**values)
    )
    await db.commit()


def test_the_loader_implements_the_core_protocol() -> None:
    loader: PrincipalLoader = _loader()

    assert isinstance(loader, AccountPrincipalLoader)


async def test_an_active_session_gives_the_principal_with_the_database_role(
    db: AsyncSession,
) -> None:
    user = await add_user(db, role="super_admin")
    claims = await _claims(db, user)

    principal = await _loader().load(claims, db)

    assert principal == Principal(user_id=user.id, session_id=claims.session_id, role="super_admin")


async def test_a_role_change_applies_on_the_next_request(db: AsyncSession) -> None:
    user = await add_user(db, role="super_admin")
    claims = await _claims(db, user)
    await _set_user(db, user, role="user")

    principal = await _loader().load(claims, db)

    assert principal.role == "user"
    assert claims.role == "super_admin"


async def _refused(db: AsyncSession, claims: AccessClaims, at: datetime = NOW) -> None:
    with pytest.raises(AuthenticationRequiredError) as caught:
        await _loader(at).load(claims, db)
    assert caught.value.params == {}


async def test_a_missing_session_is_refused(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)

    await _refused(db, AccessClaims(**{**claims.__dict__, "session_id": uuid.uuid4()}))


async def test_a_session_of_another_account_is_refused(db: AsyncSession) -> None:
    user = await add_user(db)
    other = await add_user(db, email="other@example.com")
    claims = await _claims(db, user)

    await _refused(db, AccessClaims(**{**claims.__dict__, "user_id": other.id}))


async def test_a_revoked_session_is_refused(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)
    await _set_session(db, claims, revoked_at=NOW)

    await _refused(db, claims)


async def test_a_session_past_ninety_days_is_refused(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)
    now = NOW + timedelta(days=90)
    await _set_session(db, claims, last_seen_at=now - timedelta(minutes=1))

    await _refused(db, claims, now)


async def test_a_session_idle_for_seven_days_is_refused(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)

    await _refused(db, claims, NOW + timedelta(days=7))


@pytest.mark.parametrize(
    "values",
    [
        {"is_active": False},
        {"anonymized_at": NOW},
        {"credential_version": 1},
    ],
)
async def test_an_account_that_no_longer_qualifies_is_refused(
    db: AsyncSession, values: dict[str, Any]
) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)
    await _set_user(db, user, **values)

    await _refused(db, claims)


async def test_reactivation_does_not_revive_an_old_session(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)
    await _set_user(db, user, credential_version=1, is_active=False)
    await _set_session(db, claims, revoked_at=NOW)
    await _set_user(db, user, is_active=True)

    await _refused(db, claims)


async def test_the_loader_never_writes(db: AsyncSession) -> None:
    user = await add_user(db)
    claims = await _claims(db, user)

    await _loader(NOW + timedelta(days=1)).load(claims, db)

    assert not db.dirty
    assert not db.new
