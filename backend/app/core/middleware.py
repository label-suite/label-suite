"""Pure-ASGI middlewares (design D3, ``system-design.md`` §請求穿過的層).

They are written as plain ASGI callables rather than ``BaseHTTPMiddleware`` so
context variables survive across tasks and streaming responses are not buffered.
"""

import logging
import re
import time
import traceback
import uuid
import weakref
from typing import Any

from fastapi.routing import iter_route_contexts
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.envelope import correlation_id_var, error_response
from app.core.errors import NotAcceptableError
from app.core.i18n import MessageCatalog, resolve_locale
from app.core.log_config import (
    ACCESS_LOGGER_NAME,
    UNMATCHED_ROUTE,
    is_error_logged,
    mark_error_logged,
)
from app.core.log_safety import escape_for_log
from app.core.paths import API_V1_PREFIX

__all__ = [
    "CORRELATION_ID_HEADER",
    "AccessLogMiddleware",
    "CorrelationIdMiddleware",
    "LocaleMiddleware",
    "UnhandledExceptionMiddleware",
]

logger = logging.getLogger(__name__)

CORRELATION_ID_HEADER = "X-Correlation-ID"

_ACCEPTED_CORRELATION_ID = re.compile(r"[A-Za-z0-9-]{8,64}")


def accept_or_generate(raw: str | None) -> str:
    """Return ``raw`` when it is a safe correlation ID, otherwise a new UUID4.

    A caller-supplied value is reused only when it fully matches
    ``^[A-Za-z0-9-]{8,64}$``; anything else is discarded without an error, so
    unvalidated input never reaches a log line or a response (Hard Rule 9).

    Args:
        raw: The incoming ``X-Correlation-ID`` header value, or ``None``.

    Returns:
        The accepted value or a lowercase, hyphenated UUID4.
    """
    if raw is not None and _ACCEPTED_CORRELATION_ID.fullmatch(raw):
        return raw
    return str(uuid.uuid4())


class CorrelationIdMiddleware:
    """Give every HTTP request a correlation ID and echo it on the response.

    The value is stored in ``scope["state"]["correlation_id"]`` and in
    ``correlation_id_var`` for the duration of the request, and set as the
    ``X-Correlation-ID`` header on ``http.response.start``. Mount it outermost so
    CORS preflight responses and ``500`` envelopes carry the header too.
    Non-HTTP scopes pass through unchanged.
    """

    def __init__(self, app: ASGIApp) -> None:
        """Wrap ``app``."""
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI connection."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        correlation_id = accept_or_generate(Headers(scope=scope).get(CORRELATION_ID_HEADER))
        scope.setdefault("state", {})["correlation_id"] = correlation_id

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[CORRELATION_ID_HEADER] = correlation_id
            await send(message)

        token = correlation_id_var.set(correlation_id)
        try:
            await self.app(scope, receive, send_with_header)
        finally:
            correlation_id_var.reset(token)


def format_exception_without_text(exc: BaseException) -> str:
    """Format ``exc`` as a traceback that keeps types and frames but drops messages.

    The message of an exception can carry request or database data (the input
    echoed by a pydantic ``ValidationError``, the statement and parameters in a
    ``DBAPIError``), so every exception in the chain, including ``__cause__``,
    ``__context__`` and exception-group members, is shown by its qualified type
    name only. Frame locals are never captured.

    Args:
        exc: The exception to format.

    Returns:
        A multi-line traceback ending without a trailing newline.
    """
    seen: set[int] = set()

    def render(error: BaseException) -> list[str]:
        if id(error) in seen:
            return []
        seen.add(id(error))
        lines: list[str] = []
        if error.__cause__ is not None:
            lines += render(error.__cause__)
            lines.append(
                "\nThe above exception was the direct cause of the following exception:\n\n"
            )
        elif error.__context__ is not None and not error.__suppress_context__:
            lines += render(error.__context__)
            lines.append(
                "\nDuring handling of the above exception, another exception occurred:\n\n"
            )
        lines.append("Traceback (most recent call last):\n")
        lines += traceback.StackSummary.extract(
            traceback.walk_tb(error.__traceback__), capture_locals=False
        ).format()
        error_type = type(error)
        lines.append(f"{error_type.__module__}.{error_type.__qualname__}\n")
        if isinstance(error, BaseExceptionGroup):
            for index, member in enumerate(error.exceptions, start=1):
                lines.append(f"+-- sub-exception {index} --\n")
                lines += render(member)
        return lines

    return "".join(render(exc)).rstrip("\n")


class UnhandledExceptionMiddleware:
    """Turn an unhandled exception into a ``500 INTERNAL_ERROR`` envelope.

    Sits inside CORS and the correlation middleware so the ``500`` still carries
    ``Access-Control-Allow-Origin`` and ``X-Correlation-ID`` (Starlette's
    ``ServerErrorMiddleware`` sits outside both). The response body holds only
    the generic message; the exception goes to one ``ERROR`` log record with the
    method and path (escaped by ``escape_for_log``) and a traceback of exception
    types and frames (``format_exception_without_text``), and never the
    exception messages, query, body, headers or cookies. The trace ID comes with
    the record (``trace_id``), not the message. Right after logging, the request
    is marked as already logged (``mark_error_logged``) so the access log writes
    nothing more for it.

    When the response has already started nothing can be rewritten, so the
    exception is logged, marked and re-raised. Non-HTTP scopes pass through
    unchanged.
    """

    def __init__(self, app: ASGIApp, *, catalog: MessageCatalog) -> None:
        """Wrap ``app``; ``catalog`` localises the ``500`` message."""
        self.app = app
        self.catalog = catalog

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI connection."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_tracking_start(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_tracking_start)
        except Exception as exc:
            # No exc_info: the standard formatter would print str(exc), which can
            # hold request or database data. The traceback keeps types and frames.
            logger.error(
                "Unhandled exception %s %s\n%s",
                escape_for_log(scope.get("method", "")),
                escape_for_log(scope.get("path", "")),
                format_exception_without_text(exc),
            )
            mark_error_logged(scope)
            if response_started:
                raise
            response = error_response(
                500,
                "INTERNAL_ERROR",
                "common.internal_error",
                catalog=self.catalog,
                state=scope.get("state"),
            )
            await response(scope, receive, send)


def _is_api_v1(path: str) -> bool:
    return path == API_V1_PREFIX or path.startswith(f"{API_V1_PREFIX}/")


# One entry per route object: (route, full template, compiled path regex or None).
_TemplateTable = dict[int, list[tuple[Any, str, re.Pattern[str] | None]]]
_template_tables: "weakref.WeakKeyDictionary[Any, _TemplateTable]" = weakref.WeakKeyDictionary()


def _build_template_table(app: Any) -> _TemplateTable:
    table: _TemplateTable = {}
    for context in iter_route_contexts(getattr(app, "routes", [])):
        template = context.path_format
        if template is None:
            continue
        regex = getattr(context, "path_regex", None)
        route = context.original_route
        table.setdefault(id(route), []).append((route, template, regex))
    return table


def _lookup_template(table: _TemplateTable, route: Any, route_path: str) -> str | None:
    candidates = [entry for entry in table.get(id(route), []) if entry[0] is route]
    if len(candidates) == 1:
        return candidates[0][1]
    for _, template, regex in candidates:
        if regex is not None and regex.match(route_path):
            return template
    return None


def route_template(scope: Scope) -> str | None:
    """Return the full route template the request matched, e.g. ``/api/v1/items/{item_id}``.

    Uses FastAPI's public ``iter_route_contexts`` on ``scope["app"]`` to map the
    route object routing put in ``scope["route"]`` to its template including the
    ``include_router`` prefixes (design D5); it never reads the private
    ``scope["fastapi"]``. The table is built on first use per app and cached; a
    miss rebuilds it once. When one route object is mounted under several
    prefixes, the template whose path regex matches the request path wins.

    Returns:
        The template, or ``None`` when no route matched (``404``, a ``406`` from
        ``LocaleMiddleware``) or the route cannot be found in the table.
    """
    route = scope.get("route")
    app = scope.get("app")
    if route is None or app is None:
        return None
    path: str = scope.get("path", "")
    root_path: str = scope.get("root_path", "")
    route_path = path[len(root_path) :] if root_path and path.startswith(root_path) else path

    table = _template_tables.get(app)
    if table is not None:
        template = _lookup_template(table, route, route_path)
        if template is not None:
            return template
    table = _build_template_table(app)
    _template_tables[app] = table
    return _lookup_template(table, route, route_path)


def level_for_status(status: int) -> int:
    """Return the access-log level: ``INFO`` below 400, ``WARNING`` for 4xx, ``ERROR`` above."""
    if status < 400:
        return logging.INFO
    if status < 500:
        return logging.WARNING
    return logging.ERROR


class AccessLogMiddleware:
    """Write one access-log line per ``/api/v1`` request (spec server-logging).

    Mount it inside CORS and outside ``UnhandledExceptionMiddleware`` (design
    D1), so it sees the final status, including the ``500`` that layer builds
    and the ``406`` of ``LocaleMiddleware``, while CORS preflights never reach
    it. Non-HTTP scopes and paths outside ``/api/v1`` pass through unlogged.

    Once the inner app is done it writes nothing when an inner layer already
    logged the error (``is_error_logged``) or when the status is 2xx and the
    route template is in ``quiet_success_routes``; otherwise it writes one record
    to the ``app.access`` logger at ``level_for_status``. The record's extras
    are ``http_method`` (escaped), ``http_route`` (the template or
    ``<unmatched>``), ``http_status`` and ``duration_ms`` (one decimal, from
    entering this layer to the last response body chunk, or to the inner app
    returning if that chunk was never sent). It never reads the query string,
    headers, client address or body.

    When the inner app raises, the same rules apply, with ``500`` as the
    status if no response had started, and the exception is re-raised.

    Args:
        app: The inner ASGI app.
        quiet_success_routes: Route templates whose 2xx responses are not
            logged; ``create_app`` passes the health check's, so core code does
            not hard-code module paths.
    """

    def __init__(self, app: ASGIApp, *, quiet_success_routes: frozenset[str]) -> None:
        self.app = app
        self.quiet_success_routes = quiet_success_routes
        self.logger = logging.getLogger(ACCESS_LOGGER_NAME)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI connection."""
        if scope["type"] != "http" or not _is_api_v1(scope["path"]):
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status: int | None = None
        finished: float | None = None

        async def send_tracking_response(message: Message) -> None:
            nonlocal status, finished
            if message["type"] == "http.response.start":
                status = int(message["status"])
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                finished = time.perf_counter()

        try:
            await self.app(scope, receive, send_tracking_response)
        except Exception:
            self._emit(scope, status if status is not None else 500, start, finished)
            raise
        self._emit(scope, status if status is not None else 500, start, finished)

    def _emit(self, scope: Scope, status: int, start: float, finished: float | None) -> None:
        if is_error_logged(scope):
            return
        template = route_template(scope)
        if 200 <= status < 300 and template in self.quiet_success_routes:
            return
        end = finished if finished is not None else time.perf_counter()
        self.logger.log(
            level_for_status(status),
            "request completed",
            extra={
                "http_method": escape_for_log(scope.get("method", "")),
                "http_route": template if template is not None else UNMATCHED_ROUTE,
                "http_status": status,
                "duration_ms": round((end - start) * 1000, 1),
            },
        )


class LocaleMiddleware:
    """Resolve ``Accept-Language`` for ``/api/v1`` requests (clarification Q2).

    Stores the chosen locale in ``scope["state"]["locale"]``, where the envelope
    builders read it, and sets ``Content-Language`` on ``http.response.start``.
    When every listed language is rejected it answers ``406 NOT_ACCEPTABLE``
    itself, always in zh-TW, without calling the app. Other paths and non-HTTP
    scopes pass through unchanged.
    """

    def __init__(self, app: ASGIApp, *, catalog: MessageCatalog) -> None:
        """Wrap ``app``; ``catalog`` builds the ``406`` envelope."""
        self.app = app
        self.catalog = catalog

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI connection."""
        if scope["type"] != "http" or not _is_api_v1(scope["path"]):
            await self.app(scope, receive, send)
            return

        try:
            locale = resolve_locale(Headers(scope=scope).get("accept-language"))
        except NotAcceptableError as exc:
            response = error_response(
                exc.status_code, exc.code, exc.message_key, catalog=self.catalog, state=None
            )
            await response(scope, receive, send)
            return

        scope.setdefault("state", {})["locale"] = locale

        async def send_with_content_language(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["Content-Language"] = locale
            await send(message)

        await self.app(scope, receive, send_with_content_language)
