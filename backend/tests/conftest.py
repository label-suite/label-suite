"""Shared fixtures: the test database.

The test database is PostgreSQL when ``TEST_DATABASE_URL`` is set and a SQLite
file under ``tmp_path`` otherwise (design D10). ``db_engine`` only provides an
engine; it does not run migrations.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DatabaseSettings
from app.core.db import create_engine

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or None


def make_test_database_settings(tmp_path: Path) -> DatabaseSettings:
    """Return database settings for the selected test database.

    Explicit keyword arguments override any ``DATABASE_URL`` or ``SQLITE_PATH``
    in the developer's environment, so only ``TEST_DATABASE_URL`` decides the tier.
    """
    return DatabaseSettings(database_url=TEST_DATABASE_URL, sqlite_path=tmp_path / "test.db")


@pytest.fixture
async def db_engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    """Yield an async engine on the test database without running migrations."""
    engine = create_engine(make_test_database_settings(tmp_path))
    try:
        yield engine
    finally:
        await engine.dispose()
