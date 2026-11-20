"""Domain errors and the exception handlers that turn errors into envelopes.

Each ``AppError`` carries the HTTP status, the ``UPPER_SNAKE_CASE`` error code
and the message-catalog key of the envelope ``message``; the exception handlers
turn it into an error envelope. Services never build HTTP responses themselves
(backend-agent-rules B1, api-agent-rules A7).

``register_exception_handlers`` maps ``AppError``, ``RequestValidationError`` and
Starlette's ``HTTPException`` (routing ``404``/``405``) to error envelopes (design
D4). ``ResponseValidationError`` deliberately has no handler: it falls through to
``UnhandledExceptionMiddleware`` and becomes ``500 INTERNAL_ERROR``.
"""

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.envelope import error_response
from app.core.log_safety import escape_for_log
from app.core.schemas import ErrorDetail

__all__ = [
    "AppError",
    "DatabaseUnavailableError",
    "NotAcceptableError",
    "NotFoundError",
    "register_exception_handlers",
    "validation_error_details",
]

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class of every error that maps to an error envelope.

    Subclasses set the class attributes ``status_code``, ``code`` and
    ``message_key``.

    Attributes:
        status_code: HTTP status of the error response.
        code: The application error code, e.g. ``NOT_FOUND``.
        message_key: Message-catalog key of the localised envelope message.
        params: Named values substituted into the localised message.
    """

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message_key: str = "common.internal_error"

    def __init__(self, params: Mapping[str, str] | None = None) -> None:
        """Create the error.

        Args:
            params: Optional named values for the message template. They end up
                in a response, so never pass internal identifiers or secrets.
        """
        super().__init__(self.code)
        self.params: dict[str, str] = dict(params or {})


class NotFoundError(AppError):
    """``404``: the resource does not exist or is deliberately hidden (S10)."""

    status_code = 404
    code = "NOT_FOUND"
    message_key = "common.not_found"


class NotAcceptableError(AppError):
    """``406``: every language in ``Accept-Language`` is unsupported or refused."""

    status_code = 406
    code = "NOT_ACCEPTABLE"
    message_key = "common.not_acceptable"


class DatabaseUnavailableError(AppError):
    """``503``: the database cannot be reached or the connection timed out."""

    status_code = 503
    code = "DATABASE_UNAVAILABLE"
    message_key = "common.database_unavailable"


class InternalError(AppError):
    """``500``: an unexpected failure; the message is always the generic one."""


_HTTP_STATUS_ERRORS: dict[int, tuple[str, str]] = {
    404: (NotFoundError.code, NotFoundError.message_key),
    405: ("METHOD_NOT_ALLOWED", "common.method_not_allowed"),
    406: (NotAcceptableError.code, NotAcceptableError.message_key),
}
"""Starlette ``HTTPException`` statuses with a defined envelope code and message."""


def validation_error_details(exc: RequestValidationError) -> list[ErrorDetail]:
    """Convert a ``RequestValidationError`` into ``ErrorDetail`` items.

    ``location`` is ``loc[0]`` and ``field`` the rest of ``loc`` joined with
    ``.`` (``""`` when the error covers the whole location). Only Pydantic's
    ``type`` and ``msg`` are kept: ``input``, ``ctx`` and ``url`` are dropped so
    submitted values are never echoed back (spec ``api-envelope``).

    Args:
        exc: The validation error FastAPI raised for the request.

    Returns:
        One detail per Pydantic error, in Pydantic's order.
    """
    return [_error_detail(error) for error in exc.errors()]


def _error_detail(error: Mapping[str, Any]) -> ErrorDetail:
    loc: Sequence[Any] = error.get("loc") or ()
    return ErrorDetail(
        location=str(loc[0]) if loc else "",
        field=".".join(str(part) for part in loc[1:]),
        code=str(error.get("type", "")),
        message=str(error.get("msg", "")),
    )


def _state(request: Request) -> Mapping[str, Any] | None:
    state: Mapping[str, Any] | None = request.scope.get("state")
    return state


async def handle_app_error(request: Request, exc: Exception) -> JSONResponse:
    """Turn an ``AppError`` into its error envelope."""
    assert isinstance(exc, AppError)  # noqa: S101 - registered for AppError only
    return error_response(
        exc.status_code,
        exc.code,
        exc.message_key,
        catalog=request.app.state.message_catalog,
        state=_state(request),
        params=exc.params,
    )


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    """Turn a ``RequestValidationError`` into a ``422 VALIDATION_FAILED`` envelope."""
    assert isinstance(exc, RequestValidationError)  # noqa: S101 - registered for it only
    return error_response(
        422,
        "VALIDATION_FAILED",
        "common.validation_failed",
        catalog=request.app.state.message_catalog,
        state=_state(request),
        errors=validation_error_details(exc),
    )


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    """Turn Starlette's ``HTTPException`` into an error envelope.

    ``404`` and ``405`` come from routing; the ``405`` keeps the exception's
    headers, including ``Allow``. A status with no defined envelope code is
    logged and answered as ``500 INTERNAL_ERROR`` rather than with an invented
    code.
    """
    assert isinstance(exc, HTTPException)  # noqa: S101 - registered for it only
    mapped = _HTTP_STATUS_ERRORS.get(exc.status_code)
    if mapped is None:
        logger.error(
            "HTTPException with unmapped status %s (traceId=%s) %s %s",
            exc.status_code,
            escape_for_log((_state(request) or {}).get("correlation_id")),
            escape_for_log(request.method),
            escape_for_log(request.url.path),
        )
        status_code, code, message_key = 500, InternalError.code, InternalError.message_key
        headers = None
    else:
        status_code = exc.status_code
        code, message_key = mapped
        headers = exc.headers
    return error_response(
        status_code,
        code,
        message_key,
        catalog=request.app.state.message_catalog,
        state=_state(request),
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register the envelope exception handlers on ``app``.

    Requires ``app.state.message_catalog`` (a loaded ``MessageCatalog``) to be
    set before the first request.
    """
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(HTTPException, handle_http_exception)
