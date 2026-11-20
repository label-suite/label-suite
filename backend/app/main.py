"""App assembly: ``create_app`` builds the FastAPI app from settings (design D2).

Run it with ``uv run uvicorn app.main:create_app --factory``. Nothing here reads
the environment at import time: ``create_app(None)`` does, through
``load_settings``, so the export command and the tests can import this module
with no environment at all.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, load_settings
from app.core.db import create_engine, create_sessionmaker
from app.core.errors import register_exception_handlers
from app.core.i18n import MessageCatalog
from app.core.middleware import (
    CORRELATION_ID_HEADER,
    CorrelationIdMiddleware,
    LocaleMiddleware,
    UnhandledExceptionMiddleware,
)
from app.core.openapi import (
    assert_unique_operation_ids,
    generate_operation_id,
    get_app_version,
    install_openapi,
)
from app.core.schemas import ErrorResponse
from app.modules.health.router import router as health_router

__all__ = ["API_V1_ERROR_RESPONSES", "API_V1_PREFIX", "create_api_router", "create_app"]

API_TITLE = "Label Suite API"
API_V1_PREFIX = "/api/v1"
API_V1_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorResponse} for status in (404, 405, 406, 500)
}
"""Error responses every ``/api/v1`` operation can return (api-contract §共用契約)."""

CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOWED_HEADERS = ["Content-Type", "Accept-Language", CORRELATION_ID_HEADER]
CORS_EXPOSED_HEADERS = [CORRELATION_ID_HEADER]


def create_api_router() -> APIRouter:
    """Return an empty ``/api/v1`` parent router with the shared error responses.

    Module routers are included into it and it is then included into the app,
    so every operation inherits the ``404``/``405``/``406``/``500`` declarations.
    """
    return APIRouter(prefix=API_V1_PREFIX, responses=API_V1_ERROR_RESPONSES)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create the engine and sessionmaker on start-up and dispose the engine on shutdown."""
    settings: Settings = app.state.settings
    engine = create_engine(settings)
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)
    try:
        yield
    finally:
        await engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API app.

    Args:
        settings: The settings to use; ``None`` reads them from the environment.

    Returns:
        The app with the four middlewares, the exception handlers, the
        ``/api/v1`` router with the health module mounted, and the
        post-processed ``app.openapi`` installed;
        ``info.version`` is ``[project].version`` of ``pyproject.toml``. The
        database engine is created by the lifespan, not here, so building the
        app opens no connection.

    Raises:
        ConfigError: When ``settings`` is ``None`` and the environment is not a
            valid configuration; the message names the variable, never its value.
        MessageCatalogError: When the message files are missing or out of sync.
        OperationIdCollisionError: When two operations share an operationId.
    """
    resolved = settings if settings is not None else load_settings(Settings)

    app = FastAPI(
        title=API_TITLE,
        version=get_app_version(),
        lifespan=_lifespan,
        generate_unique_id_function=generate_operation_id,
    )
    app.state.settings = resolved
    catalog = MessageCatalog.load()
    app.state.message_catalog = catalog

    # add_middleware puts each new layer outside the previous ones, so this runs
    # innermost first: Locale, Unhandled, CORS, Correlation (design D3).
    app.add_middleware(LocaleMiddleware, catalog=catalog)
    app.add_middleware(UnhandledExceptionMiddleware, catalog=catalog)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.cors_allowed_origins,
        allow_credentials=resolved.cors_allow_credentials,
        allow_methods=CORS_ALLOWED_METHODS,
        allow_headers=CORS_ALLOWED_HEADERS,
        expose_headers=CORS_EXPOSED_HEADERS,
    )
    app.add_middleware(CorrelationIdMiddleware)

    register_exception_handlers(app)
    api = create_api_router()
    api.include_router(health_router)
    app.include_router(api)
    assert_unique_operation_ids(app)
    install_openapi(app)
    return app
