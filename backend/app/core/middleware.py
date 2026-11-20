"""Pure-ASGI middlewares (design D3, ``system-design.md`` §請求穿過的層).

They are written as plain ASGI callables rather than ``BaseHTTPMiddleware`` so
context variables survive across tasks and streaming responses are not buffered.
"""

import logging
import re
import traceback
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


def escape_for_log(value: object) -> str:
    """Return ``value`` as one log-safe line.

    Backslashes, control characters (``\\n``, ``\\r``, ``\\t``, ...) and non-ASCII
    characters are written as Python escape sequences, so a request-derived value
    can never start a forged log line (log injection, Hard Rule 9).

    Args:
        value: Any value; ``None`` and non-strings are converted with ``str``.

    Returns:
        The escaped, ASCII-only text.
    """
    return str(value).encode("unicode_escape").decode("ascii")


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
    trace ID, method and path (escaped by ``escape_for_log``) and a traceback of
    exception types and frames (``format_exception_without_text``), and never the
    exception messages, query, body, headers or cookies.

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
        except Exception as exc:
            # No exc_info: the standard formatter would print str(exc), which can
            # hold request or database data. The traceback keeps types and frames.
            logger.error(
                "Unhandled exception (traceId=%s) %s %s\n%s",
                escape_for_log(current_trace_id()),
                escape_for_log(scope.get("method", "")),
                escape_for_log(scope.get("path", "")),
                format_exception_without_text(exc),
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
