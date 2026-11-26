"""Unit tests for the ``get_db`` request-session dependency (backend-agent-rules B4)."""

from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine import Dialect

from app.core.config import DatabaseSettings
from app.core.db import UtcDateTime, create_engine, get_db


def _request_with_session(session: Any) -> Any:
    """Build a request stand-in whose ``app.state.sessionmaker`` yields ``session``."""
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=session)
    context.__aexit__ = AsyncMock(return_value=False)
    sessionmaker = MagicMock(return_value=context)
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(sessionmaker=sessionmaker)))


async def test_get_db_yields_one_session_and_closes_it_without_commit() -> None:
    session = AsyncMock()
    request = _request_with_session(session)
    dependency = get_db(request)

    yielded = await anext(dependency)
    with pytest.raises(StopAsyncIteration):
        await anext(dependency)

    assert yielded is session
    request.app.state.sessionmaker.assert_called_once_with()
    request.app.state.sessionmaker.return_value.__aexit__.assert_awaited_once()
    session.commit.assert_not_awaited()
    session.rollback.assert_not_awaited()


async def test_get_db_rolls_back_and_reraises_on_exception_without_commit() -> None:
    session = AsyncMock()
    request = _request_with_session(session)
    dependency = get_db(request)
    await anext(dependency)

    with pytest.raises(RuntimeError, match="boom"):
        await dependency.athrow(RuntimeError("boom"))

    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()
    request.app.state.sessionmaker.return_value.__aexit__.assert_awaited_once()


@pytest.mark.parametrize(
    "database_url", [None, "postgresql://u:pw@127.0.0.1:1/x"], ids=["lite", "production"]
)
async def test_engine_hides_bound_parameters_from_errors_and_logs(
    tmp_path: Path, database_url: str | None
) -> None:
    engine = create_engine(
        DatabaseSettings(database_url=database_url, sqlite_path=tmp_path / "x.db")
    )
    try:
        assert engine.sync_engine.hide_parameters is True
    finally:
        await engine.dispose()


SQLITE = sqlite.dialect()
POSTGRES = postgresql.dialect()
TAIPEI = timezone(timedelta(hours=8))


@pytest.mark.parametrize("dialect", [SQLITE, POSTGRES], ids=["sqlite", "postgresql"])
def test_utc_datetime_rejects_a_naive_value(dialect: Dialect) -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        UtcDateTime().process_bind_param(datetime(2026, 1, 1, 12, 0), dialect)


def test_utc_datetime_stores_utc_without_offset_on_sqlite() -> None:
    stored = UtcDateTime().process_bind_param(datetime(2026, 1, 1, 8, 0, tzinfo=TAIPEI), SQLITE)

    assert stored == datetime(2026, 1, 1, 0, 0)
    assert stored is not None and stored.tzinfo is None


def test_utc_datetime_stores_utc_with_offset_on_postgresql() -> None:
    stored = UtcDateTime().process_bind_param(datetime(2026, 1, 1, 8, 0, tzinfo=TAIPEI), POSTGRES)

    assert stored == datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    assert stored is not None and stored.tzinfo is UTC


@pytest.mark.parametrize(
    "raw",
    [datetime(2026, 1, 1, 0, 0), datetime(2026, 1, 1, 8, 0, tzinfo=TAIPEI)],
    ids=["naive-from-sqlite", "aware-from-postgresql"],
)
@pytest.mark.parametrize("dialect", [SQLITE, POSTGRES], ids=["sqlite", "postgresql"])
def test_utc_datetime_reads_back_an_aware_utc_value(raw: datetime, dialect: Dialect) -> None:
    loaded = UtcDateTime().process_result_value(raw, dialect)

    expected = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    if raw.tzinfo is not None:
        expected = raw.astimezone(UTC)
    assert loaded == expected
    assert loaded is not None and loaded.tzinfo is UTC


@pytest.mark.parametrize("dialect", [SQLITE, POSTGRES], ids=["sqlite", "postgresql"])
def test_utc_datetime_passes_none_through(dialect: Dialect) -> None:
    assert UtcDateTime().process_bind_param(None, dialect) is None
    assert UtcDateTime().process_result_value(None, dialect) is None


def test_utc_datetime_is_a_timezone_aware_column_type() -> None:
    assert UtcDateTime().impl.timezone is True
