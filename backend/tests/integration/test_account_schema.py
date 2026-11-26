"""Integration tests for the account tables migration (spec ``database-migration``).

Covers the ADDED requirement: ``users``, ``account_session`` and
``account_refresh_token`` exist after ``upgrade head`` with no account row, carry the
same constraint and index names on SQLite and PostgreSQL, allow at most one Seeder
admin, and disappear when downgrading to the baseline (design D9).

The name check compares each tier against one fixed expected set, so a SQLite run
and a PostgreSQL run that both pass have identical name sets.

PostgreSQL runs share one database, so every test starts from ``downgrade base``
plus ``upgrade head`` and leaves the schema at an empty head (design D9).
"""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection, Inspector, insert, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.db import Base
from app.modules.account.models import AccountRefreshToken, AccountSession, User
from tests.conftest import run_alembic

pytestmark = pytest.mark.integration

BASELINE_REVISION = "0dfb129ee036"
ACCOUNT_TABLES = {"users", "account_session", "account_refresh_token"}

EXPECTED_NAMES: dict[str, dict[str, set[str]]] = {
    "users": {
        "pk": {"pk_users"},
        "unique": {"uq_users_email", "uq_users_google_subject"},
        "check": {
            "ck_users_name_length",
            "ck_users_contact_info_length",
            "ck_users_role_allowed",
            "ck_users_credential_version_non_negative",
        },
        "fk": set(),
        "index": {"ix_users_is_seeder"},
    },
    "account_session": {
        "pk": {"pk_account_session"},
        "unique": {"uq_account_session_user_id_id"},
        "check": {"ck_account_session_logged_out_within_revocation"},
        "fk": {"fk_account_session_user_id_users"},
        "index": {"ix_account_session_user_id"},
    },
    "account_refresh_token": {
        "pk": {"pk_account_refresh_token"},
        "unique": {"uq_account_refresh_token_token_hash"},
        "check": {"ck_account_refresh_token_reissue_count_range"},
        "fk": {"fk_account_refresh_token_session_id_account_session"},
        "index": {"ix_account_refresh_token_session_id"},
    },
}


@pytest.fixture
async def account_engine(db_engine: AsyncEngine) -> AsyncIterator[AsyncEngine]:
    """Yield the test database at an empty head and leave it at an empty head."""
    await run_alembic(db_engine, "downgrade", "base")
    await run_alembic(db_engine, "upgrade", "head")
    try:
        yield db_engine
    finally:
        await run_alembic(db_engine, "downgrade", "base")
        await run_alembic(db_engine, "upgrade", "head")


def _names(connection: Connection) -> dict[str, dict[str, set[str]]]:
    inspector: Inspector = inspect(connection)
    found: dict[str, dict[str, set[str]]] = {}
    for table in ACCOUNT_TABLES:
        unique = {uc["name"] for uc in inspector.get_unique_constraints(table) if uc["name"]}
        indexes = {
            ix["name"]
            for ix in inspector.get_indexes(table)
            if ix["name"] and ix["name"] not in unique
        }
        found[table] = {
            "pk": {name} if (name := inspector.get_pk_constraint(table)["name"]) else set(),
            "unique": unique,
            "check": {ck["name"] for ck in inspector.get_check_constraints(table) if ck["name"]},
            "fk": {fk["name"] for fk in inspector.get_foreign_keys(table) if fk["name"]},
            "index": indexes,
        }
    return found


def _drift(connection: Connection) -> list[Any]:
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return list(compare_metadata(context, Base.metadata))


def _user_values(*, email: str, is_seeder: bool = False) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "id": uuid.uuid4(),
        "email": email,
        "name": "Seeder Example",
        "hashed_password": None,
        "role": "super_admin" if is_seeder else "user",
        "is_active": True,
        "is_seeder": is_seeder,
        "created_at": now,
        "updated_at": now,
    }


async def test_head_has_the_three_account_tables_and_no_account(
    account_engine: AsyncEngine,
) -> None:
    async with account_engine.connect() as conn:
        tables = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))
        users = (await conn.execute(select(User.id))).all()

    assert ACCOUNT_TABLES <= tables
    assert users == []


async def test_constraint_and_index_names_match_the_shared_set(
    account_engine: AsyncEngine,
) -> None:
    async with account_engine.connect() as conn:
        found = await conn.run_sync(_names)

    assert found == EXPECTED_NAMES


async def test_migration_matches_the_models(account_engine: AsyncEngine) -> None:
    async with account_engine.connect() as conn:
        drift = await conn.run_sync(_drift)

    assert drift == []


async def test_a_second_seeder_admin_is_rejected(account_engine: AsyncEngine) -> None:
    async with account_engine.begin() as conn:
        await conn.execute(
            insert(User), [_user_values(email="seeder-1@example.test", is_seeder=True)]
        )

    with pytest.raises(IntegrityError):
        async with account_engine.begin() as conn:
            await conn.execute(
                insert(User), [_user_values(email="seeder-2@example.test", is_seeder=True)]
            )


async def test_many_non_seeder_accounts_are_allowed(account_engine: AsyncEngine) -> None:
    async with account_engine.begin() as conn:
        await conn.execute(
            insert(User),
            [_user_values(email=f"member-{n}@example.test") for n in range(3)],
        )
        count = len((await conn.execute(select(User.id))).all())

    assert count == 3


async def test_email_is_unique(account_engine: AsyncEngine) -> None:
    async with account_engine.begin() as conn:
        await conn.execute(insert(User), [_user_values(email="same@example.test")])

    with pytest.raises(IntegrityError):
        async with account_engine.begin() as conn:
            await conn.execute(insert(User), [_user_values(email="same@example.test")])


async def test_role_outside_the_allowed_values_is_rejected(account_engine: AsyncEngine) -> None:
    values = _user_values(email="role@example.test") | {"role": "owner"}

    with pytest.raises(IntegrityError):
        async with account_engine.begin() as conn:
            await conn.execute(insert(User), [values])


async def test_timestamps_round_trip_as_utc(account_engine: AsyncEngine) -> None:
    taipei = timezone(timedelta(hours=8))
    written = datetime(2026, 11, 26, 9, 30, 15, 123456, tzinfo=taipei)
    values = _user_values(email="utc@example.test") | {"created_at": written}
    async with account_engine.begin() as conn:
        await conn.execute(insert(User), [values])
    async with account_engine.connect() as conn:
        read = (await conn.execute(select(User.created_at))).scalar_one()

    assert read == written
    assert read.tzinfo is UTC


async def _insert_session(conn: Any, **overrides: Any) -> uuid.UUID:
    user = _user_values(email=f"{uuid.uuid4().hex}@example.test")
    await conn.execute(insert(User), [user])
    now = datetime.now(UTC)
    session_id = uuid.uuid4()
    row = {
        "id": session_id,
        "user_id": user["id"],
        "started_at": now,
        "last_seen_at": now,
    } | overrides
    await conn.execute(insert(AccountSession), [row])
    return session_id


async def test_logout_later_than_revocation_is_rejected(account_engine: AsyncEngine) -> None:
    revoked = datetime(2026, 11, 26, 10, 0, tzinfo=UTC)

    with pytest.raises(IntegrityError):
        async with account_engine.begin() as conn:
            await _insert_session(
                conn, revoked_at=revoked, logged_out_at=revoked + timedelta(microseconds=1)
            )


async def test_logout_at_revocation_is_accepted(account_engine: AsyncEngine) -> None:
    revoked = datetime(2026, 11, 26, 10, 0, tzinfo=UTC)
    async with account_engine.begin() as conn:
        await _insert_session(conn, revoked_at=revoked, logged_out_at=revoked)


async def test_refresh_token_reissue_count_is_at_most_one(account_engine: AsyncEngine) -> None:
    now = datetime.now(UTC)

    with pytest.raises(IntegrityError):
        async with account_engine.begin() as conn:
            session_id = await _insert_session(conn)
            await conn.execute(
                insert(AccountRefreshToken),
                [
                    {
                        "id": uuid.uuid4(),
                        "session_id": session_id,
                        "token_hash": "0" * 64,
                        "issued_at": now,
                        "expires_at": now + timedelta(days=7),
                        "reissue_count": 2,
                    }
                ],
            )


async def test_downgrade_to_baseline_drops_the_account_tables(
    account_engine: AsyncEngine,
) -> None:
    await run_alembic(account_engine, "downgrade", BASELINE_REVISION)

    async with account_engine.connect() as conn:
        tables = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))

    assert tables.isdisjoint(ACCOUNT_TABLES)
