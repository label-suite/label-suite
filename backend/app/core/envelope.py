"""Success and error envelopes (api-agent-rules A1, A7, A8).

Routers build success envelopes with ``ok``; exception handlers and middlewares
build error responses with ``error_response``. Both fill in ``timestamp`` (UTC,
milliseconds, ``Z``), ``traceId`` from the correlation-ID context variable and
the ``message`` localised to the locale in ``scope["state"]``, falling back to
zh-TW when the scope has none. Services never call this module.

This module also owns the correlation-ID context variable:
``CorrelationIdMiddleware`` writes it and the envelope reads it for ``traceId``.
It lives here rather than in ``app.core.middleware`` because the other
middlewares build envelopes, so the dependency only points middleware -> envelope.
"""

import uuid
from collections.abc import Mapping
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.schemas import ApiResponse, ErrorDetail, ErrorResponse

if TYPE_CHECKING:
    from app.core.i18n import MessageCatalog

__all__ = [
    "SUCCESS_CODE",
    "correlation_id_var",
    "current_correlation_id",
    "current_trace_id",
    "error_response",
    "ok",
    "success",
]

SUCCESS_CODE = "OK"
_SUCCESS_MESSAGE_KEY = "common.ok"

correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
"""The current request's correlation ID; set and reset by ``CorrelationIdMiddleware``."""


def current_correlation_id() -> str | None:
    """Return the current request's correlation ID, or ``None`` outside a request."""
    return correlation_id_var.get()


def current_trace_id() -> str:
    """Return the ``traceId`` for an envelope built now.

    Inside a request this is the correlation ID that ``CorrelationIdMiddleware``
    put on the context, which is also the ``X-Correlation-ID`` header. Outside
    one (no middleware ran) a fresh UUID4 keeps ``traceId`` non-empty.
    """
    return current_correlation_id() or str(uuid.uuid4())


def _locale(catalog: "MessageCatalog", state: Mapping[str, Any] | None) -> str:
    return catalog.effective_locale((state or {}).get("locale"))


def success[T](
    data: T,
    *,
    catalog: "MessageCatalog",
    state: Mapping[str, Any] | None,
    message_key: str = _SUCCESS_MESSAGE_KEY,
) -> ApiResponse[T]:
    """Build a success envelope around ``data``.

    Args:
        data: The endpoint payload.
        catalog: The loaded message catalog.
        state: The request's ``scope["state"]``; its ``locale`` picks the
            message language, zh-TW when absent.
        message_key: Catalog key of the message; ``common.ok`` by default.

    Returns:
        The envelope with ``success`` true and ``code`` ``OK``.

    Raises:
        KeyError: When ``message_key`` is not in the catalog.
    """
    return ApiResponse(
        success=True,
        code=SUCCESS_CODE,
        message=catalog.translate(message_key, _locale(catalog, state)),
        data=data,
        timestamp=datetime.now(UTC),
        trace_id=current_trace_id(),
    )


def ok[T](data: T, request: Request, message_key: str = _SUCCESS_MESSAGE_KEY) -> ApiResponse[T]:
    """Build a success envelope for ``request``; the form routers use.

    Reads the catalog from ``request.app.state.message_catalog`` (set by
    ``create_app``) and the locale from the request scope. See ``success``.
    """
    catalog: MessageCatalog = request.app.state.message_catalog
    return success(data, catalog=catalog, state=request.scope.get("state"), message_key=message_key)


def error_response(
    status_code: int,
    code: str,
    message_key: str,
    *,
    catalog: "MessageCatalog",
    state: Mapping[str, Any] | None,
    errors: list[ErrorDetail] | None = None,
    params: Mapping[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Build an error-envelope response.

    The body has ``success`` false, ``data`` null and ``errors`` (null unless
    given). ``Content-Language`` is set to the language actually used, so a
    response built outside ``LocaleMiddleware`` (a ``500``, a ``406``) still
    carries it.

    Args:
        status_code: HTTP status.
        code: The ``UPPER_SNAKE_CASE`` error code.
        message_key: Catalog key of the localised message.
        catalog: The loaded message catalog.
        state: The request's ``scope["state"]``; its ``locale`` picks the
            message language, zh-TW when absent or unsupported.
        errors: Field-level details, only for ``422``.
        params: Named values for the message template; they reach the client,
            so never pass internal identifiers.
        headers: Extra response headers, e.g. ``Allow`` for ``405``.

    Returns:
        The JSON response.

    Raises:
        KeyError: When ``message_key`` is not in the catalog.
    """
    locale = _locale(catalog, state)
    body = ErrorResponse(
        success=False,
        code=code,
        message=catalog.translate(message_key, locale, params),
        data=None,
        timestamp=datetime.now(UTC),
        trace_id=current_trace_id(),
        errors=errors,
    )
    response = JSONResponse(
        body.model_dump(mode="json"), status_code=status_code, headers=dict(headers or {})
    )
    response.headers["Content-Language"] = locale
    return response
