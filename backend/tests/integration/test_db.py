"""Integration tests for the database engine and the constraint naming convention.

Covers spec ``database-migration`` "約束名稱依固定規則產生" on the selected test
database (SQLite by default, PostgreSQL with ``TEST_DATABASE_URL``), and the
Lite-tier ``PRAGMA foreign_keys`` setting.

The ``sample`` and ``owner`` tables exist only here, on their own ``MetaData``
with the production naming convention; they never touch ``Base.metadata`` or a
migration, and the fixture drops them even when a test fails (design D9).
"""

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import (
    Column,
    Connection,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    inspect,
    text,
)
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DatabaseSettings
from app.core.db import NAMING_CONVENTION, Base, create_engine

pytestmark = pytest.mark.integration

naming_metadata = MetaData(naming_convention=NAMING_CONVENTION)

owner_table = Table(
    "owner",
    naming_metadata,
    Column("id", Integer, primary_key=True),
)

sample_table = Table(
    "sample",
    naming_metadata,
    Column("id", Integer, primary_key=True),
    Column("code", String(32), unique=True, nullable=False),
    Column("owner_id", Integer, ForeignKey("owner.id"), nullable=False),
)


@pytest.fixture
async def naming_tables(db_engine: AsyncEngine) -> AsyncIterator[AsyncEngine]:
    """Create ``owner`` and ``sample`` on the test database and always drop them."""
    async with db_engine.begin() as conn:
        await conn.run_sync(naming_metadata.drop_all)
        await conn.run_sync(naming_metadata.create_all)
    try:
        yield db_engine
    finally:
        async with db_engine.begin() as conn:
            await conn.run_sync(naming_metadata.drop_all)


def _sample_constraints(connection: Connection) -> dict[str, Any]:
    inspector = inspect(connection)
    return {
        "pk": inspector.get_pk_constraint("sample")["name"],
        "uq": [uq["name"] for uq in inspector.get_unique_constraints("sample")],
        "fk": [fk["name"] for fk in inspector.get_foreign_keys("sample")],
    }


def test_base_metadata_uses_the_naming_convention() -> None:
    for key, template in NAMING_CONVENTION.items():
        assert Base.metadata.naming_convention[key] == template


async def test_constraint_names_follow_the_fixed_rules(naming_tables: AsyncEngine) -> None:
    async with naming_tables.connect() as conn:
        names = await conn.run_sync(_sample_constraints)

    assert names == {
        "pk": "pk_sample",
        "uq": ["uq_sample_code"],
        "fk": ["fk_sample_owner_id_owner"],
    }


async def test_lite_tier_enables_sqlite_foreign_keys_and_creates_the_parent_directory(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "missing" / "nested" / "lite.db"
    engine = create_engine(DatabaseSettings(database_url=None, sqlite_path=db_path))
    try:
        assert db_path.parent.is_dir()
        async with engine.connect() as conn:
            result = await conn.execute(text("PRAGMA foreign_keys"))
            assert result.scalar_one() == 1
        assert db_path.is_file()
    finally:
        await engine.dispose()
