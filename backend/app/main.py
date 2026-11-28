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

from app.core.auth_secret import resolve_auth_secret
from app.core.celery_app import create_celery_app
from app.core.config import Settings, load_settings
from app.core.csrf import CSRF_HEADER, CsrfMiddleware
from app.core.db import create_engine, create_sessionmaker
from app.core.errors import register_exception_handlers
from app.core.i18n import MessageCatalog
from app.core.log_config import configure_logging
from app.core.middleware import (
    CORRELATION_ID_HEADER,
    AccessLogMiddleware,
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
from app.core.paths import API_V1_PREFIX
from app.core.schemas import ErrorResponse
from app.core.tokens import AccessTokenCodec, TokenKeys
from app.mail import MailService
from app.modules.account.router import router as account_router
from app.modules.account.service import AccountPrincipalLoader
from app.modules.admin.service import AdminPermissionMatrixProvider
from app.modules.health.router import router as health_router

__all__ = ["API_V1_ERROR_RESPONSES", "OPENAPI_TAGS", "create_api_router", "create_app"]

API_TITLE = "Label Suite API"
API_V1_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorResponse} for status in (404, 405, 406, 500)
}
"""Error responses every ``/api/v1`` operation can return (api-contract §共用契約)."""

OPENAPI_TAGS: list[dict[str, str]] = [
    {"name": "account", "description": "Sign-in, sessions and the signed-in caller."},
    {"name": "health", "description": "Service and database availability check."},
]
"""One tag per backend module, in spec chapter order with ``health`` last (api-agent-rules A1).

The list order is the group order of the API docs. A new module adds its entry at its
chapter's position and is mounted with ``include_router(tags=["<module>"])``.
"""

CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOWED_HEADERS = ["Content-Type", "Accept-Language", CORRELATION_ID_HEADER, CSRF_HEADER]
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


def _attach_mail(app: FastAPI, settings: Settings) -> None:
    """Put the default Celery app and the ``MailService`` in ``app.state``; no connection."""
    celery_app = create_celery_app(settings)
    celery_app.set_default()
    app.state.celery_app = celery_app
    # Consumers' services take it from here and call it after their commit (B4).
    app.state.mail_service = MailService(settings, celery_app)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API app.

    Args:
        settings: The settings to use; ``None`` reads them from the environment.

    Side effects:
        Configures the process-wide log output from ``LOG_LEVEL``
        (``configure_logging``) once the settings are valid; a repeated call
        replaces this repository's root handler rather than adding a second one.
        Resolves ``AUTH_SECRET`` (``resolve_auth_secret``): on the Lite tier
        without it, reads or creates ``auth_secret`` next to the SQLite file.
        Derives the purpose keys from it into ``app.state.token_keys`` and puts the
        access-token codec in ``app.state.access_codec``, the account module's
        ``AccountPrincipalLoader`` in ``app.state.principal_loader`` and the admin
        module's ``AdminPermissionMatrixProvider`` in
        ``app.state.permission_matrix_provider``. Builds the Celery app
        (``create_celery_app``), makes it Celery's default app and puts it in
        ``app.state.celery_app``, and puts the mail entry's ``MailService`` in
        ``app.state.mail_service``; neither opens a connection. ``app.state.task_membership_reader``
        is not set: no module implements it yet, so a task-scoped permission check
        fails loudly with ``RuntimeError`` (authz-steps-3-4 design D7).

    Returns:
        The app with the six middlewares, the exception handlers, the
        ``/api/v1`` router with the health and account modules mounted under
        their module tags (declared in ``OPENAPI_TAGS``), and the
        post-processed ``app.openapi`` installed;
        ``info.version`` is ``[project].version`` of ``pyproject.toml``. The
        database engine is created by the lifespan, not here, so building the
        app opens no connection.

    Raises:
        ConfigError: When ``settings`` is ``None`` and the environment is not a
            valid configuration, or when ``AUTH_SECRET`` cannot be resolved (the
            production tier without it); the message names the variable, never
            its value.
        MessageCatalogError: When the message files are missing or out of sync.
        OperationIdCollisionError: When two operations share an operationId.
    """
    loaded = settings if settings is not None else load_settings(Settings)
    configure_logging(loaded)
    # Before any component is built, so every later reader sees the final secret.
    auth_secret = resolve_auth_secret(loaded)
    resolved = loaded.model_copy(update={"auth_secret": auth_secret})
    keys = TokenKeys.derive(auth_secret)
    codec = AccessTokenCodec(keys.access)

    app = FastAPI(
        title=API_TITLE,
        version=get_app_version(),
        lifespan=_lifespan,
        generate_unique_id_function=generate_operation_id,
        openapi_tags=OPENAPI_TAGS,
        # None leaves the four built-in routes unregistered, so they fall through
        # to the shared 404 envelope like any other unknown path.
        docs_url="/docs" if resolved.api_docs_enabled else None,
        redoc_url="/redoc" if resolved.api_docs_enabled else None,
        openapi_url="/openapi.json" if resolved.api_docs_enabled else None,
    )
    app.state.settings = resolved
    catalog = MessageCatalog.load()
    app.state.message_catalog = catalog
    app.state.token_keys = keys
    app.state.access_codec = codec
    # core.auth only defines the protocol; the account module implements it.
    app.state.principal_loader = AccountPrincipalLoader()
    # core.authz only defines the protocol; the admin module owns the matrix. The admin
    # router has no route yet, so it is not mounted and no admin tag is declared.
    app.state.permission_matrix_provider = AdminPermissionMatrixProvider()
    _attach_mail(app, resolved)

    # add_middleware puts each new layer outside the previous ones, so this runs
    # innermost first: Csrf, Locale, Unhandled, AccessLog, CORS, Correlation (design D3;
    # request-access-log design D1; login-auth-guard design D3). Csrf sits inside
    # Locale so its 403 is localised, and refuses before routing.
    app.add_middleware(CsrfMiddleware, codec=codec, csrf_key=keys.csrf, catalog=catalog)
    app.add_middleware(LocaleMiddleware, catalog=catalog)
    app.add_middleware(UnhandledExceptionMiddleware, catalog=catalog)
    # A successful health check is polled every 30 seconds and is not logged
    # (request-access-log clarification Q1); core code does not know its path.
    app.add_middleware(
        AccessLogMiddleware,
        quiet_success_routes=frozenset({f"{API_V1_PREFIX}/health"}),
    )
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
    # The module tag is given here, not in the module's APIRouter(), so each
    # operation carries exactly one tag (api-agent-rules A1).
    api.include_router(health_router, tags=["health"])
    api.include_router(account_router, tags=["account"])
    app.include_router(api)
    assert_unique_operation_ids(app)
    install_openapi(app)
    return app
