"""Fixtures for the account integration tests.

``account_db`` is a session on the same migrated test database the ``client`` app
uses (both are keyed on ``tmp_path``). PostgreSQL runs share one database, so the
three account tables are emptied before and after each test; only this test's rows
are ever removed.
"""

from collections.abc import AsyncIterator

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.modules.account.models import AccountRefreshToken, AccountSession, User


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
