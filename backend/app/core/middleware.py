"""Pure-ASGI middlewares (design D3, ``system-design.md`` §請求穿過的層).

They are written as plain ASGI callables rather than ``BaseHTTPMiddleware`` so
context variables survive across tasks and streaming responses are not buffered.
"""

import logging
import re
import uuid

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.envelope import correlation_id_var, current_trace_id, error_response
from app.core.errors import NotAcceptableError
from app.core.i18n import MessageCatalog, resolve_locale

__all__ = [
    "CORRELATION_ID_HEADER",
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


class UnhandledExceptionMiddleware:
    """Turn an unhandled exception into a ``500 INTERNAL_ERROR`` envelope.

    Sits inside CORS and the correlation middleware so the ``500`` still carries
    ``Access-Control-Allow-Origin`` and ``X-Correlation-ID`` (Starlette's
    ``ServerErrorMiddleware`` sits outside both). The response body holds only
    the generic message; the exception goes to one ``ERROR`` log record with the
    trace ID, method and path, and never the query, body, headers or cookies.

    When the response has already started nothing can be rewritten, so the
    exception is logged and re-raised. Non-HTTP scopes pass through unchanged.
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
        except Exception:
            logger.error(
                "Unhandled exception (traceId=%s) %s %s",
                current_trace_id(),
                scope.get("method"),
                scope.get("path"),
                exc_info=True,
            )
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


API_V1_PATH = "/api/v1"


def _is_api_v1(path: str) -> bool:
    return path == API_V1_PATH or path.startswith(f"{API_V1_PATH}/")


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
