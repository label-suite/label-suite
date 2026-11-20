"""Integration tests for the Alembic environment and the baseline migration.

Covers spec ``database-migration``: upgrade, downgrade and upgrade again on the
selected test database, the baseline creating no business table, and migrations
reading the same database settings as the service.

PostgreSQL runs share one database, so every migration test starts with
``downgrade base`` and ends with ``upgrade head`` (design D9).
"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.conftest import alembic_config, run_alembic

pytestmark = pytest.mark.integration

BASELINE_DOWN_REVISION = None


def _script() -> ScriptDirectory:
    return ScriptDirectory.from_config(alembic_config())


def _version_rows(connection: Connection) -> list[str]:
    if not inspect(connection).has_table("alembic_version"):
        return []
    return list(connection.execute(text("SELECT version_num FROM alembic_version")).scalars())


def _table_names(connection: Connection) -> set[str]:
    return set(inspect(connection).get_table_names())


async def _versions(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as conn:
        return await conn.run_sync(_version_rows)


def test_there_is_exactly_one_baseline_revision_with_no_parent() -> None:
    script = _script()
    bases = script.get_bases()

    assert len(bases) == 1
    assert script.get_revision(bases[0]).down_revision is BASELINE_DOWN_REVISION


async def test_migrations_upgrade_downgrade_and_upgrade_again(db_engine: AsyncEngine) -> None:
    head = _script().get_current_head()
    await run_alembic(db_engine, "downgrade", "base")

    await run_alembic(db_engine, "upgrade", "head")
    assert await _versions(db_engine) == [head]

    await run_alembic(db_engine, "downgrade", "base")
    assert await _versions(db_engine) == []

    await run_alembic(db_engine, "upgrade", "head")
    assert await _versions(db_engine) == [head]


async def test_baseline_creates_no_business_table(db_engine: AsyncEngine) -> None:
    await run_alembic(db_engine, "downgrade", "base")

    await run_alembic(db_engine, "upgrade", "head")

    async with db_engine.connect() as conn:
        assert await conn.run_sync(_table_names) == {"alembic_version"}


async def test_migrated_engine_fixture_is_at_head(migrated_engine: AsyncEngine) -> None:
    assert await _versions(migrated_engine) == [_script().get_current_head()]


def test_migrations_use_the_service_database_settings(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    db_path = tmp_path / "m.db"
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    config = alembic_config()

    command.downgrade(config, "base")
    command.upgrade(config, "head")

    assert db_path.is_file()
    with closing(sqlite3.connect(db_path)) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    tables = {name for (name,) in rows}
    assert "alembic_version" in tables
