"""Success and error envelopes (api-agent-rules A1, A7, A8).

This module also owns the request's correlation-ID context variable:
``CorrelationIdMiddleware`` writes it and the envelope reads it for ``traceId``.
It lives here rather than in ``app.core.middleware`` because the other
middlewares build envelopes, so the dependency only points middleware -> envelope.
"""

from contextvars import ContextVar

__all__ = ["correlation_id_var", "current_correlation_id"]

correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
"""The current request's correlation ID; set and reset by ``CorrelationIdMiddleware``."""


def current_correlation_id() -> str | None:
    """Return the current request's correlation ID, or ``None`` outside a request."""
    return correlation_id_var.get()
