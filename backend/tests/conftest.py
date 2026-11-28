"""Shared fixtures: the test database, the migrated test database and the API client.

The test database is PostgreSQL when ``TEST_DATABASE_URL`` is set and a SQLite
file under ``tmp_path`` otherwise (design D10). ``db_engine`` only provides an
engine; ``migrated_engine`` builds on it and runs ``alembic upgrade head``.

``app`` is the production assembly from ``create_app`` with the test-only probe
router added under the same ``/api/v1`` parent router; ``client`` runs its
lifespan and talks to it through ``httpx.ASGITransport`` (design D8).

``create_app`` configures process-wide logging, so ``restore_logging`` puts the
root logger and the uvicorn and database loggers back after every test, and
``capture_logs`` re-points this repository's root handler at an in-memory stream
so a test can assert on the real one-line ``key=value`` output
(request-access-log design D6, §Risks item 1).
"""

import io
import logging
import os
import secrets
from collections.abc import AsyncIterator, Callable, Iterator
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from pydantic import SecretStr
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DatabaseSettings, Settings
from app.core.db import create_engine
from app.core.log_config import configure_logging, is_repo_handler
from app.main import create_api_router, create_app
from tests.probe import probe_router

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or None

_CONFIGURED_LOGGERS = (
    "uvicorn",
    "uvicorn.access",
    "sqlalchemy",
    "aiosqlite",
    "asyncpg",
    "httpx",
    "httpcore",
)
"""The named loggers ``configure_logging`` changes besides the root logger."""


@pytest.fixture(autouse=True)
def restore_logging() -> Iterator[None]:
    """Undo ``configure_logging`` after each test.

    Only the handler ``configure_logging`` marks is removed from the root logger:
    pytest swaps its own capture handlers per test phase, so restoring a
    snapshot of the root handler list would leave a stale pytest handler behind.
    """
    root = logging.getLogger()
    root_level = root.level
    saved = {
        name: (logger.level, list(logger.handlers), logger.propagate)
        for name in _CONFIGURED_LOGGERS
        for logger in [logging.getLogger(name)]
    }
    try:
        yield
    finally:
        for handler in [h for h in root.handlers if is_repo_handler(h)]:
            root.removeHandler(handler)
        root.setLevel(root_level)
        for name, (level, handlers, propagate) in saved.items():
            logger = logging.getLogger(name)
            logger.setLevel(level)
            logger.handlers[:] = handlers
            logger.propagate = propagate


@pytest.fixture
def capture_logs() -> Callable[[Settings], io.StringIO]:
    """Return a function that re-runs ``configure_logging`` writing to a new buffer.

    Call it after ``create_app`` (which configures logging to stderr); the
    returned ``StringIO`` then receives exactly what this repository's root
    handler writes, formatted by ``KeyValueFormatter``.
    """

    def capture(settings: Settings) -> io.StringIO:
        buffer = io.StringIO()
        configure_logging(settings, stream=buffer)
        return buffer

    return capture


def make_test_database_settings(tmp_path: Path) -> DatabaseSettings:
    """Return database settings for the selected test database.

    Explicit keyword arguments override any ``DATABASE_URL`` or ``SQLITE_PATH``
    in the developer's environment, so only ``TEST_DATABASE_URL`` decides the tier.
    """
    return DatabaseSettings(database_url=TEST_DATABASE_URL, sqlite_path=tmp_path / "test.db")


@pytest.fixture
async def db_engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    """Yield an async engine on the test database without running migrations."""
    engine = create_engine(make_test_database_settings(tmp_path))
    try:
        yield engine
    finally:
        await engine.dispose()


BACKEND_DIR = Path(__file__).resolve().parent.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def alembic_config(connection: Connection | None = None) -> Config:
    """Return an Alembic config for ``backend/alembic.ini``.

    Args:
        connection: When given, ``env.py`` migrates over this connection instead
            of building its own engine from ``DatabaseSettings``.
    """
    config = Config(ALEMBIC_INI)
    # Keep pytest's logging intact; env.py would otherwise apply alembic.ini's loggers.
    config.attributes["configure_logging"] = False
    if connection is not None:
        config.attributes["connection"] = connection
    return config


def _run_alembic(connection: Connection, action: str, revision: str) -> None:
    config = alembic_config(connection)
    if action == "upgrade":
        command.upgrade(config, revision)
    else:
        command.downgrade(config, revision)


async def run_alembic(engine: AsyncEngine, action: str, revision: str) -> None:
    """Run ``alembic upgrade`` or ``alembic downgrade`` on ``engine`` and commit."""
    async with engine.begin() as conn:
        await conn.run_sync(_run_alembic, action, revision)


@pytest.fixture
async def migrated_engine(db_engine: AsyncEngine) -> AsyncEngine:
    """Return the test database engine after ``alembic upgrade head``."""
    await run_alembic(db_engine, "upgrade", "head")
    return db_engine


ALLOWED_ORIGIN = "http://localhost:5173"

TEST_AUTH_SECRET = secrets.token_urlsafe(48)
"""A per-run ``AUTH_SECRET`` for the harness, generated so no secret is written down
(Hard Rule 8); the production tier refuses to start without one."""


def make_test_settings(tmp_path: Path) -> Settings:
    """Return full app settings on the selected test database.

    Every field is passed explicitly so nothing in the developer's environment
    leaks in. ``AUTH_SECRET`` is set on both tiers, so neither run writes the
    Lite-tier secret file.
    """
    return Settings(
        cors_allowed_origins=[ALLOWED_ORIGIN],
        cors_allow_credentials=True,
        api_docs_enabled=True,
        database_url=TEST_DATABASE_URL,
        sqlite_path=tmp_path / "test.db",
        auth_secret=SecretStr(TEST_AUTH_SECRET),
        redis_url="redis://localhost:6379",
        resend_api_key=None,
        mail_from=None,
        celery_task_always_eager=False,
    )


@pytest.fixture
def app(tmp_path: Path) -> FastAPI:
    """Return ``create_app(test settings)`` with the probe router under ``/api/v1``."""
    application = create_app(make_test_settings(tmp_path))
    api = create_api_router()
    api.include_router(probe_router)
    application.include_router(api)
    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """Yield an HTTP client for ``app`` with its lifespan running."""
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http
