"""URL path constants shared across the app.

It has no imports from ``app`` so ``app.main``, ``app.core.middleware`` and
``app.core.openapi`` can all use it without a cycle.
"""

__all__ = ["API_V1_PREFIX"]

API_V1_PREFIX = "/api/v1"
"""Path prefix of every versioned API operation (api-agent-rules A1)."""
