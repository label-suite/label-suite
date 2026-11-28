"""Integration test for the database comment coverage check, PostgreSQL layer (issue #822).

After ``alembic upgrade head`` every table and column that the models declare must carry the
same comment in PostgreSQL's catalog (spec ``database-migration``; ADR-003 D7, B7). SQLite
stores no comments, so this file is skipped there: the skip is decided by ``skipif`` at
collection time, which means ``migrated_engine`` is never built and no database is opened.

The test only reads the system catalog; the table list comes from the model metadata alone,
so ``alembic_version`` is never looked at.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.db import Base
from tests.conftest import TEST_DATABASE_URL
from tests.support.db_comments import (
    comment_mismatches,
    load_all_models,
    metadata_tables,
    read_pg_comments,
)

pytestmark = pytest.mark.integration

requires_postgres = pytest.mark.skipif(
    TEST_DATABASE_URL is None, reason="needs TEST_DATABASE_URL (PostgreSQL)"
)


@pytest.mark.postgres
@requires_postgres
async def test_database_comments_match_model_comments(migrated_engine: AsyncEngine) -> None:
    load_all_models()

    async with migrated_engine.connect() as connection:
        stored = await read_pg_comments(connection, metadata_tables(Base.metadata))

    problems = comment_mismatches(Base.metadata, stored)
    assert not problems, "\n".join(problems)
    assert {"users", "admin_role_permission"} <= set(stored)
    assert "alembic_version" not in stored
