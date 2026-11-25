"""Backend log output: trace IDs on every record and one ``key=value`` line each.

``configure_logging`` is the single place that sets up log output; ``create_app``
calls it right after reading the settings (request-access-log design D6). It

- installs a log-record factory that puts the current request's correlation ID
  on every record as ``trace_id`` (``-`` outside a request), so business code,
  this repository's infrastructure and third-party libraries all get it without
  passing anything (design D3);
- hangs one marked ``StreamHandler`` with ``KeyValueFormatter`` on the root
  logger at ``LOG_LEVEL``;
- pins the database engine, pool and driver loggers to ``WARNING`` so SQL text
  and parameters never reach the output, routes uvicorn's own records through
  the root handler and turns uvicorn's built-in access log off.

It also owns the "an error was already logged for this request" marker that the
access log reads (design D2). It imports only ``app.core.envelope`` and
``app.core.config`` from the app, so the middlewares and the exception handlers
can both use it without a cycle.
"""

import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any, TextIO

from starlette.types import Scope

from app.core.config import Settings
from app.core.envelope import current_correlation_id

__all__ = [
    "ACCESS_LOGGER_NAME",
    "NO_TRACE_ID",
    "UNMATCHED_ROUTE",
    "KeyValueFormatter",
    "configure_logging",
    "install_trace_id_record_factory",
    "is_error_logged",
    "is_repo_handler",
    "mark_error_logged",
]

ACCESS_LOGGER_NAME = "app.access"
"""Logger name of the one-line-per-request access log."""

NO_TRACE_ID = "-"
"""``trace_id`` of a record written outside any request (clarification Q7)."""

UNMATCHED_ROUTE = "<unmatched>"
"""``route`` of an access-log line whose request matched no route template (Q5)."""

PINNED_WARNING_LOGGERS = ("sqlalchemy", "aiosqlite", "asyncpg")
"""Database engine, pool and driver loggers that stay at ``WARNING`` whatever ``LOG_LEVEL`` is."""

_ERROR_LOGGED_KEY = "error_logged"
_REPO_HANDLER_ATTRIBUTE = "_label_suite_root_handler"
_ACCESS_FIELDS = (
    ("http_method", "method"),
    ("http_route", "route"),
    ("http_status", "status"),
    ("duration_ms", "durationMs"),
)
# C0 controls, DEL, C1 controls and the Unicode line and paragraph separators:
# anything a reader or a log collector could take as the end of a line.
_CONTROL_CHARACTERS = re.compile("[\x00-\x1f\x7f-\x9f  ]")
_NAMED_ESCAPES = {"\n": "\\n", "\r": "\\r", "\t": "\\t"}

_factory_installed = False


def install_trace_id_record_factory() -> None:
    """Make every new ``LogRecord`` carry ``trace_id``; idempotent.

    Wraps the current record factory once per process. The value is
    ``current_correlation_id()``, or ``NO_TRACE_ID`` outside a request; it never
    calls ``current_trace_id()``, which would mint a new UUID outside a request.

    Side effects:
        Replaces the process-wide record factory on the first call only.
    """
    global _factory_installed
    if _factory_installed:
        return
    previous = logging.getLogRecordFactory()

    def factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = previous(*args, **kwargs)
        record.trace_id = current_correlation_id() or NO_TRACE_ID
        return record

    logging.setLogRecordFactory(factory)
    _factory_installed = True


def _escape_controls(text: str) -> str:
    """Replace control characters with escape sequences; backslashes stay as they are."""

    def replace(match: re.Match[str]) -> str:
        char = match.group(0)
        named = _NAMED_ESCAPES.get(char)
        if named is not None:
            return named
        code = ord(char)
        return f"\\x{code:02x}" if code <= 0xFF else f"\\u{code:04x}"

    return _CONTROL_CHARACTERS.sub(replace, text)


class KeyValueFormatter(logging.Formatter):
    """Format a record as one ``key=value`` line (clarification Q2).

    Fields, in order: ``timestamp`` (UTC, milliseconds, ``Z``), ``level``,
    ``logger``, ``traceId``; then ``method``, ``route``, ``status`` and
    ``durationMs`` (one decimal) when the record carries the access-log extras
    ``http_method``, ``http_route``, ``http_status`` and ``duration_ms``; then
    ``excType`` when the record carries exception info; and ``msg`` last, holding
    the rest of the line unquoted.

    Control characters in every value become escape sequences, so a record never
    spans more than one line. Backslashes are left alone, so a value already
    escaped by ``escape_for_log`` is not escaped twice. Exception info is written
    as the exception's qualified type only: never its message (which can carry
    request or database data) and never the multi-line traceback (S9).
    """

    def formatTime(  # noqa: N802 - overrides logging.Formatter.formatTime
        self, record: logging.LogRecord, datefmt: str | None = None
    ) -> str:
        """Return the record time as UTC with milliseconds and ``Z``; ``datefmt`` is ignored."""
        created = datetime.fromtimestamp(record.created, UTC)
        return f"{created:%Y-%m-%dT%H:%M:%S}.{int(record.msecs):03d}Z"

    def format(self, record: logging.LogRecord) -> str:
        """Return ``record`` as one line; see the class docstring for the layout."""
        fields = [
            ("timestamp", self.formatTime(record)),
            ("level", record.levelname),
            ("logger", record.name),
            ("traceId", str(getattr(record, "trace_id", NO_TRACE_ID))),
        ]
        for attribute, key in _ACCESS_FIELDS:
            if hasattr(record, attribute):
                value = getattr(record, attribute)
                fields.append((key, f"{value:.1f}" if key == "durationMs" else str(value)))
        exc_type = record.exc_info[0] if record.exc_info else None
        if exc_type is not None:
            fields.append(("excType", f"{exc_type.__module__}.{exc_type.__qualname__}"))
        fields.append(("msg", record.getMessage()))
        return " ".join(f"{key}={_escape_controls(value)}" for key, value in fields)


def mark_error_logged(scope: Scope) -> None:
    """Record that a ``WARNING`` or ``ERROR`` was already logged for this request.

    Side effects:
        Sets ``scope["state"]["error_logged"]``, creating ``state`` if needed;
        ``Request.state`` reads the same dict. The marker never reaches a response.
    """
    scope.setdefault("state", {})[_ERROR_LOGGED_KEY] = True


def is_error_logged(scope: Scope) -> bool:
    """Return whether ``mark_error_logged`` ran for this request."""
    state = scope.get("state") or {}
    return bool(state.get(_ERROR_LOGGED_KEY, False))


def is_repo_handler(handler: logging.Handler) -> bool:
    """Return whether ``handler`` is the root handler ``configure_logging`` installed."""
    return bool(getattr(handler, _REPO_HANDLER_ATTRIBUTE, False))


def configure_logging(settings: Settings, *, stream: TextIO | None = None) -> None:
    """Set up the whole backend's log output; safe to call more than once.

    Args:
        settings: Supplies ``log_level``.
        stream: Where the root handler writes; ``sys.stderr`` when ``None``.
            Tests pass a ``StringIO`` to read the formatted output.

    Side effects:
        Installs the trace-ID record factory (once per process). Removes the
        root handler a previous call installed, never any other handler, then
        adds one ``StreamHandler`` with ``KeyValueFormatter``; the root logger
        and that handler are set to ``settings.log_level``. Sets the
        ``sqlalchemy``, ``aiosqlite`` and ``asyncpg`` loggers to ``WARNING``.
        Clears the ``uvicorn`` logger's handlers and makes it propagate, so
        uvicorn's records use the same format; clears ``uvicorn.access``'s
        handlers and stops it propagating, which turns uvicorn's built-in access
        log off (clarification Q10).
    """
    install_trace_id_record_factory()
    level = logging.getLevelNamesMapping()[settings.log_level]

    root = logging.getLogger()
    for existing in [handler for handler in root.handlers if is_repo_handler(handler)]:
        root.removeHandler(existing)
    handler = logging.StreamHandler(stream if stream is not None else sys.stderr)
    setattr(handler, _REPO_HANDLER_ATTRIBUTE, True)
    handler.setFormatter(KeyValueFormatter())
    handler.setLevel(level)
    root.addHandler(handler)
    root.setLevel(level)

    for name in PINNED_WARNING_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.handlers.clear()
    uvicorn_logger.propagate = True
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
