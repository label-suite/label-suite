"""Unit tests for ``AccessLogMiddleware`` edge cases the assembled app cannot reach.

A failure after the response started, a client that never receives the last
body chunk, non-HTTP scopes, and the status-to-level policy (request-access-log
design D1, D2, D7).
"""

import logging
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

import pytest

from app.core.log_config import ACCESS_LOGGER_NAME, mark_error_logged
from app.core.middleware import AccessLogMiddleware, level_for_status

Message = MutableMapping[str, Any]
Scope = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]


def _scope(path: str = "/api/v1/x", method: str = "GET") -> Scope:
    return {"type": "http", "method": method, "path": path, "headers": [], "state": {}}


async def _receive() -> Message:
    return {"type": "http.request", "body": b"", "more_body": False}


async def _noop_send(message: Message) -> None:
    return None


def _access_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [record for record in caplog.records if record.name == ACCESS_LOGGER_NAME]


@pytest.mark.parametrize(
    ("status", "level"),
    [
        (101, logging.INFO),
        (200, logging.INFO),
        (204, logging.INFO),
        (302, logging.INFO),
        (399, logging.INFO),
        (400, logging.WARNING),
        (404, logging.WARNING),
        (499, logging.WARNING),
        (500, logging.ERROR),
        (503, logging.ERROR),
    ],
)
def test_level_follows_the_status_class(status: int, level: int) -> None:
    assert level_for_status(status) == level


async def test_streamed_response_is_timed_to_the_last_body_chunk(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER_NAME)

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        await send({"type": "http.response.start", "status": 201, "headers": []})
        await send({"type": "http.response.body", "body": b"a", "more_body": True})
        await send({"type": "http.response.body", "body": b"b"})

    await AccessLogMiddleware(inner, quiet_success_routes=frozenset())(
        _scope(method="POST\nFORGED"), _receive, _noop_send
    )

    (record,) = _access_records(caplog)
    assert record.levelno == logging.INFO
    assert record.http_status == 201  # type: ignore[attr-defined]
    assert record.http_route == "<unmatched>"  # type: ignore[attr-defined]
    assert record.http_method == "POST\\nFORGED"  # type: ignore[attr-defined]
    assert isinstance(record.duration_ms, float)  # type: ignore[attr-defined]
    assert record.duration_ms == round(record.duration_ms, 1)  # type: ignore[attr-defined]


async def test_failure_after_the_response_started_is_re_raised_without_a_second_record(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER_NAME)

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        await send({"type": "http.response.start", "status": 200, "headers": []})
        mark_error_logged(scope)
        raise RuntimeError("late")

    with pytest.raises(RuntimeError, match="late"):
        await AccessLogMiddleware(inner, quiet_success_routes=frozenset())(
            _scope(), _receive, _noop_send
        )

    assert _access_records(caplog) == []


async def test_failure_not_logged_by_an_inner_layer_still_writes_one_record(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER_NAME)

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        raise RuntimeError("unmarked")

    with pytest.raises(RuntimeError, match="unmarked"):
        await AccessLogMiddleware(inner, quiet_success_routes=frozenset())(
            _scope(), _receive, _noop_send
        )

    (record,) = _access_records(caplog)
    assert record.levelno == logging.ERROR
    assert record.http_status == 500  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    "scope",
    [{"type": "lifespan"}, _scope("/api/v10"), _scope("/docs")],
    ids=["lifespan", "api-v10", "docs"],
)
async def test_non_http_scopes_and_other_paths_are_not_logged(
    caplog: pytest.LogCaptureFixture, scope: Scope
) -> None:
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER_NAME)
    called = False

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        nonlocal called
        called = True

    await AccessLogMiddleware(inner, quiet_success_routes=frozenset())(scope, _receive, _noop_send)

    assert called is True
    assert _access_records(caplog) == []
