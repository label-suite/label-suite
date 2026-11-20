"""Unit tests for the ``get_db`` request-session dependency (backend-agent-rules B4)."""

from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import DatabaseSettings
from app.core.db import create_engine, get_db


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
