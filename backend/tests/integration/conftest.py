"""Fixtures for the account and admin integration tests.

``account_db`` is a session on the same migrated test database the ``client`` app
uses (both are keyed on ``tmp_path``). PostgreSQL runs share one database, so the
three account tables are emptied before and after each test; only this test's rows
are ever removed. ``matrix_db`` rewrites the role permission matrix to the admin-group
migration's initial cells and version before and after each test that writes it.
``google_client`` is the production app with Google configured, and ``google`` puts
``FakeGoogle`` at the network boundary.
"""

import secrets
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import httpx
import pytest
from alembic.script import ScriptDirectory
from pydantic import SecretStr
from sqlalchemy import delete, insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.main import create_app
from app.modules.account.models import AccountRefreshToken, AccountSession, User
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion
from tests.conftest import alembic_config, make_test_settings
from tests.support.google_oidc import CLIENT_ID, REDIRECT_URI, FakeGoogle


async def clear_accounts(engine: AsyncEngine) -> None:
    """Delete every row of the three account tables, children first."""
    async with engine.begin() as conn:
        for model in (AccountRefreshToken, AccountSession, User):
            await conn.execute(delete(model))


@pytest.fixture
async def account_db(migrated_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Yield a session on the migrated test database with no account rows."""
    await clear_accounts(migrated_engine)
    async with async_sessionmaker(migrated_engine, expire_on_commit=False)() as session:
        yield session
    await clear_accounts(migrated_engine)


ACCOUNT_REVISION = "7bf0f909ce8f"
"""The account-group revision; the admin-group migration sits directly on top of it."""

ADMIN_REVISION = "4180e5b4471c"
"""The admin-group revision, whose literal seed ``reset_matrix`` writes back."""


def _admin_seed() -> Callable[[datetime], list[dict[str, object]]]:
    """Return the admin-group migration's own builder of the 62 initial cells."""
    script = ScriptDirectory.from_config(alembic_config()).get_revision(ADMIN_REVISION)
    assert script is not None
    return cast(Callable[[datetime], list[dict[str, object]]], script.module._initial_cells)


async def reset_matrix(engine: AsyncEngine) -> None:
    """Rewrite the two matrix tables to the 62 initial cells and version 1.

    Deletes every row of both tables and inserts the admin-group migration's literal
    seed again, so no migration runs and any later revision's tables and rows are left
    as they are (authz-steps-3-4 design D9).
    """
    now = datetime.now(UTC)
    async with engine.begin() as conn:
        await conn.execute(delete(AdminRolePermissionVersion))
        await conn.execute(delete(AdminRolePermission))
        await conn.execute(insert(AdminRolePermission), _admin_seed()(now))
        await conn.execute(
            insert(AdminRolePermissionVersion), [{"id": 1, "version": 1, "updated_at": now}]
        )


@pytest.fixture
async def matrix_db(migrated_engine: AsyncEngine) -> AsyncIterator[AsyncEngine]:
    """Yield the migrated test engine with the initial matrix, and restore it afterwards.

    Every test that updates, deletes or inserts matrix rows uses this fixture, so a
    PostgreSQL run that shares one database never carries a changed matrix into the
    next test.
    """
    await reset_matrix(migrated_engine)
    try:
        yield migrated_engine
    finally:
        await reset_matrix(migrated_engine)


@pytest.fixture
async def google_client(
    tmp_path: Path, migrated_engine: AsyncEngine
) -> AsyncIterator[httpx.AsyncClient]:
    settings = make_test_settings(tmp_path).model_copy(
        update={
            "google_client_id": CLIENT_ID,
            "google_client_secret": SecretStr(secrets.token_urlsafe(24)),
            "google_redirect_uri": REDIRECT_URI,
        }
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


@pytest.fixture
def google(monkeypatch: pytest.MonkeyPatch) -> FakeGoogle:
    fake = FakeGoogle()
    fake.install(monkeypatch)
    return fake
