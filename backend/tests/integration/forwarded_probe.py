"""Test-only app factory that reports the client address and scheme (not collected).

Run by uvicorn as ``tests.integration.forwarded_probe:create_forwarded_probe_app
--factory``. It lives under ``tests/`` so production never loads it. uvicorn rewrites
``scope["client"]`` and ``scope["scheme"]`` before the app is called, so what the route
reads is what a real handler would see.
"""

from fastapi import FastAPI, Request

from app.main import create_app

FORWARDED_PROBE_PATH = "/api/v1/forwarded-probe"


def create_forwarded_probe_app() -> FastAPI:
    """Build the real app and add one route that echoes ``client`` and ``scheme``."""
    app = create_app()

    @app.get(FORWARDED_PROBE_PATH, include_in_schema=False)
    async def forwarded_probe(request: Request) -> dict[str, str | None]:
        return {
            "client": request.client.host if request.client else None,
            "scheme": request.url.scheme,
        }

    return app
