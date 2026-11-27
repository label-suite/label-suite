"""Fixtures for the account and admin integration tests.

``account_db`` is a session on the same migrated test database the ``client`` app
uses (both are keyed on ``tmp_path``). PostgreSQL runs share one database, so the
three account tables are emptied before and after each test; only this test's rows
are ever removed. ``matrix_db`` resets the role permission matrix to its initial
cells and version before and after each test that writes it. ``google_client`` is the
production app with Google configured, and ``google`` puts ``FakeGoogle`` at the network
boundary.
"""

import secrets
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.main import create_app
from app.modules.account.models import AccountRefreshToken, AccountSession, User
from tests.conftest import make_test_settings, run_alembic
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


async def reset_matrix(engine: AsyncEngine) -> None:
    """Re-run the admin-group migration so the matrix holds its 62 initial cells and version 1.

    Downgrading to ``ACCOUNT_REVISION`` drops only the two matrix tables, so the account
    tables and their rows are left as they are (authz-steps-3-4 design D9).
    """
    await run_alembic(engine, "downgrade", ACCOUNT_REVISION)
    await run_alembic(engine, "upgrade", "head")


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
