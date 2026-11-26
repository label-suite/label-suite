"""Unit tests for ``app.core.log_config`` (request-access-log design D2, D3, D4, D6).

Covers the record and formatter layers of spec ``server-logging``: the fixed
``-`` trace ID outside a request, the trace ID on third-party records, the
one-line ``key=value`` output, ``excType`` without the exception text, and what
``configure_logging`` does to the root, uvicorn and database loggers.
"""

import io
import logging
import re
import sys
from collections.abc import Callable
from pathlib import Path
from types import TracebackType

import pytest

from app.core.config import LogLevel, Settings
from app.core.envelope import correlation_id_var
from app.core.log_config import (
    ACCESS_LOGGER_NAME,
    NO_TRACE_ID,
    UNMATCHED_ROUTE,
    KeyValueFormatter,
    configure_logging,
    install_trace_id_record_factory,
    is_error_logged,
    is_repo_handler,
    mark_error_logged,
)

UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
ExcInfo = tuple[type[BaseException], BaseException, TracebackType | None]
DATABASE_LOGGERS = ("sqlalchemy.engine", "sqlalchemy.pool", "aiosqlite", "asyncpg")


def _settings(tmp_path: Path, log_level: LogLevel = "INFO") -> Settings:
    return Settings(
        cors_allowed_origins=["http://localhost:5173"],
        cors_allow_credentials=True,
        api_docs_enabled=True,
        database_url=None,
        sqlite_path=tmp_path / "app.db",
        log_level=log_level,
    )


def _lines(buffer: io.StringIO) -> list[str]:
    return buffer.getvalue().splitlines()


def _field(line: str, key: str) -> str:
    match = re.search(rf"(?:^| ){key}=(\S*)", line)
    assert match is not None, line
    return match.group(1)


def _record(
    message: str = "hello",
    *,
    name: str = "thirdparty.lib",
    level: int = logging.WARNING,
    exc_info: ExcInfo | None = None,
) -> logging.LogRecord:
    install_trace_id_record_factory()
    return logging.getLogRecordFactory()(name, level, __file__, 1, message, None, exc_info)


# --- constants ------------------------------------------------------------------------


def test_constants_have_the_designed_values() -> None:
    assert ACCESS_LOGGER_NAME == "app.access"
    assert NO_TRACE_ID == "-"
    assert UNMATCHED_ROUTE == "<unmatched>"


# --- record factory -------------------------------------------------------------------


def test_records_written_outside_a_request_carry_the_fixed_marker(
    tmp_path: Path,
    capture_logs: Callable[[Settings], io.StringIO],
    caplog: pytest.LogCaptureFixture,
) -> None:
    output = capture_logs(_settings(tmp_path))

    logging.getLogger("app.startup").info("starting")
    logging.getLogger("app.startup").info("started")

    trace_ids = [getattr(record, "trace_id", None) for record in caplog.records]
    assert trace_ids == ["-", "-"]
    assert not any(UUID_PATTERN.match(str(trace_id)) for trace_id in trace_ids)
    lines = _lines(output)
    assert len(lines) == 2
    assert all(" traceId=- " in line for line in lines)


def test_third_party_records_carry_the_current_correlation_id() -> None:
    token = correlation_id_var.set("client-trace-0003")
    try:
        record = _record(name="thirdparty.lib")
    finally:
        correlation_id_var.reset(token)

    assert record.trace_id == "client-trace-0003"  # type: ignore[attr-defined]


def test_record_factory_is_wrapped_only_once() -> None:
    install_trace_id_record_factory()
    first = logging.getLogRecordFactory()

    install_trace_id_record_factory()

    assert logging.getLogRecordFactory() is first
    record = first("x", logging.INFO, __file__, 1, "m", None, None)
    assert record.trace_id == NO_TRACE_ID  # type: ignore[attr-defined]


# --- formatter ------------------------------------------------------------------------


def test_formatter_writes_the_fixed_fields_in_order() -> None:
    line = KeyValueFormatter().format(_record("plain message", name="app.x"))

    assert re.fullmatch(
        r"timestamp=\S+ level=WARNING logger=app\.x traceId=- msg=plain message", line
    )


def test_timestamp_is_utc_with_milliseconds_and_z() -> None:
    line = KeyValueFormatter().format(_record())

    assert TIMESTAMP_PATTERN.match(_field(line, "timestamp"))


def test_message_with_newlines_is_written_on_one_line() -> None:
    line = KeyValueFormatter().format(_record("first\nsecond\r\nthird\tfourth\x1bend"))

    assert len(line.splitlines()) == 1
    assert "\n" not in line and "\r" not in line and "\x1b" not in line
    assert line.endswith(r"msg=first\nsecond\r\nthird\tfourth\x1bend")


def test_already_escaped_backslashes_are_not_escaped_twice() -> None:
    line = KeyValueFormatter().format(_record(r"path /a\x0ab"))

    assert line.endswith(r"msg=path /a\x0ab")


def test_exception_info_is_written_as_its_type_only() -> None:
    try:
        raise ValueError("CANARY-exc")
    except ValueError:
        exc_info = sys.exc_info()

    line = KeyValueFormatter().format(_record("third-party failure", exc_info=exc_info))

    assert len(line.splitlines()) == 1
    assert " excType=builtins.ValueError msg=third-party failure" in line
    assert "CANARY-exc" not in line
    assert "Traceback" not in line


def test_access_fields_follow_trace_id_and_precede_msg() -> None:
    record = _record("request completed", name=ACCESS_LOGGER_NAME, level=logging.INFO)
    record.http_method = "GET"
    record.http_route = "/api/v1/items/{item_id}"
    record.http_status = 200
    record.duration_ms = 12.34

    line = KeyValueFormatter().format(record)

    assert re.fullmatch(
        r"timestamp=\S+ level=INFO logger=app\.access traceId=- method=GET "
        r"route=/api/v1/items/\{item_id\} status=200 durationMs=12\.3 msg=request completed",
        line,
    )


# --- error-logged marker --------------------------------------------------------------


def test_error_logged_marker_lives_in_scope_state() -> None:
    scope: dict[str, object] = {"type": "http"}

    assert is_error_logged(scope) is False
    mark_error_logged(scope)

    assert is_error_logged(scope) is True
    assert scope["state"] == {"error_logged": True}


# --- configure_logging ----------------------------------------------------------------


def test_configure_logging_twice_keeps_one_repo_handler_and_other_handlers(
    tmp_path: Path,
) -> None:
    root = logging.getLogger()
    other = logging.NullHandler()
    root.addHandler(other)
    try:
        configure_logging(_settings(tmp_path), stream=io.StringIO())
        configure_logging(_settings(tmp_path), stream=io.StringIO())

        repo_handlers = [handler for handler in root.handlers if is_repo_handler(handler)]
        assert len(repo_handlers) == 1
        assert other in root.handlers
        assert isinstance(repo_handlers[0].formatter, KeyValueFormatter)
    finally:
        root.removeHandler(other)


def test_configure_logging_defaults_to_stderr(tmp_path: Path) -> None:
    configure_logging(_settings(tmp_path))

    (handler,) = [h for h in logging.getLogger().handlers if is_repo_handler(h)]
    assert isinstance(handler, logging.StreamHandler)
    assert handler.stream is sys.stderr


@pytest.mark.parametrize("level", ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
def test_root_and_handler_follow_log_level(tmp_path: Path, level: LogLevel) -> None:
    configure_logging(_settings(tmp_path, level), stream=io.StringIO())

    root = logging.getLogger()
    (handler,) = [h for h in root.handlers if is_repo_handler(h)]
    assert root.level == logging.getLevelNamesMapping()[level]
    assert handler.level == logging.getLevelNamesMapping()[level]


def test_info_below_warning_level_is_not_written(
    tmp_path: Path, capture_logs: Callable[[Settings], io.StringIO]
) -> None:
    output = capture_logs(_settings(tmp_path, "WARNING"))
    # uvicorn sets its own error logger to INFO; the handler level must still drop it.
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)

    logging.getLogger("uvicorn.error").info("CANARY-uvicorn-info")
    logging.getLogger("app.x").info("CANARY-app-info")
    logging.getLogger("app.x").warning("kept")

    assert "CANARY" not in output.getvalue()
    assert "level=WARNING logger=app.x" in output.getvalue()


def test_database_loggers_stay_at_warning_under_debug(
    tmp_path: Path, capture_logs: Callable[[Settings], io.StringIO]
) -> None:
    output = capture_logs(_settings(tmp_path, "DEBUG"))

    for name in DATABASE_LOGGERS:
        logger = logging.getLogger(name)
        assert logger.getEffectiveLevel() == logging.WARNING, name
        logger.info("CANARY-db-info SELECT 1")
        logger.debug("CANARY-db-debug SELECT 1")

    logging.getLogger("app.x").debug("app debug kept")
    assert "CANARY" not in output.getvalue()
    assert "SELECT 1" not in output.getvalue()
    assert "level=DEBUG logger=app.x" in output.getvalue()


def test_uvicorn_logs_propagate_to_the_root_handler(
    tmp_path: Path, capture_logs: Callable[[Settings], io.StringIO]
) -> None:
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.addHandler(logging.NullHandler())
    uvicorn_logger.propagate = False

    output = capture_logs(_settings(tmp_path))
    logging.getLogger("uvicorn.error").info("Application startup complete.")

    assert uvicorn_logger.handlers == []
    assert uvicorn_logger.propagate is True
    assert re.search(
        r"level=INFO logger=uvicorn\.error traceId=- msg=Application startup complete\.$",
        output.getvalue(),
        re.MULTILINE,
    )


def test_uvicorn_access_log_is_turned_off(
    tmp_path: Path, capture_logs: Callable[[Settings], io.StringIO]
) -> None:
    access = logging.getLogger("uvicorn.access")
    access.addHandler(logging.StreamHandler(io.StringIO()))
    access.propagate = True

    output = capture_logs(_settings(tmp_path))
    access.info('127.0.0.1:5000 - "GET /api/v1/health?q=CANARY-query HTTP/1.1" 200')

    assert access.handlers == []
    assert access.propagate is False
    assert "CANARY-query" not in output.getvalue()
