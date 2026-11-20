"""Unit tests for the ``get_db`` request-session dependency (backend-agent-rules B4)."""

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.db import get_db


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
