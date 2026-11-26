"""Database engine, request sessions and the declarative base (ADR-003 D7).

The engine is built from ``DatabaseSettings`` so the API and Alembic derive the
URL through the same code (backend-agent-rules B10). The application creates
the engine and the sessionmaker in its lifespan and keeps them on ``app.state``;
nothing here is a module-level global (backend-agent-rules B3).

Transactions belong to the service layer: ``get_db`` opens one session per
request and rolls back on an exception, but never commits (backend-agent-rules B4).
"""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from fastapi import Request
from sqlalchemy import DateTime, MetaData, event
from sqlalchemy.engine import Dialect
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator

from app.core.config import DatabaseSettings

__all__ = [
    "NAMING_CONVENTION",
    "POSTGRES_CONNECT_TIMEOUT_SECONDS",
    "Base",
    "UtcDateTime",
    "create_engine",
    "create_sessionmaker",
    "get_db",
]

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
"""Constraint naming rules shared by SQLite and PostgreSQL.

Fixed names let batch-mode migrations find a constraint again when SQLite
rebuilds a table (backend-agent-rules B6).
"""

POSTGRES_CONNECT_TIMEOUT_SECONDS = 5
"""Seconds asyncpg waits for a connection before failing.

The health check also bounds its whole query by it (``HealthService.check``).
"""


class Base(DeclarativeBase):
    """Declarative base of every ORM model; its metadata carries ``NAMING_CONVENTION``."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UtcDateTime(TypeDecorator[datetime]):
    """A ``timestamptz`` column that only stores and returns UTC.

    Binding a naive ``datetime`` raises ``ValueError``, so no local time can slip
    in. Aware values are converted to UTC. PostgreSQL stores them as
    ``timestamptz``; SQLite has no time zone, so the UTC value is written without
    an offset in SQLAlchemy's fixed ``YYYY-MM-DD HH:MM:SS.ffffff`` text form, which
    keeps text comparison (CHECK constraints, ``ORDER BY``) in time order. Every
    value read back is an aware ``datetime`` in UTC on both tiers.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Convert an aware value to UTC, dropping the offset on SQLite.

        Raises:
            ValueError: ``value`` is a naive ``datetime``.
        """
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("UtcDateTime only accepts timezone-aware datetimes")
        utc = value.astimezone(UTC)
        if dialect.name == "sqlite":
            return utc.replace(tzinfo=None)
        return utc

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Return the stored value as an aware ``datetime`` in UTC."""
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    """Turn on foreign-key enforcement for each new SQLite connection."""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def create_engine(settings: DatabaseSettings) -> AsyncEngine:
    """Create the async engine for the tier that ``settings`` selects.

    Lite tier: creates the parent directory of ``SQLITE_PATH`` and enables
    ``PRAGMA foreign_keys`` on every connection. Production tier: bounds the
    connection attempt with ``POSTGRES_CONNECT_TIMEOUT_SECONDS`` and pings pooled
    connections before use so a restarted database does not fail the first request.
    Both tiers set ``hide_parameters`` so bound values never appear in a
    ``DBAPIError`` message or in SQL echo logs.

    Args:
        settings: The validated database settings.

    Returns:
        A new engine; the caller owns it and must ``dispose()`` it.
    """
    url = settings.async_database_url()
    if settings.is_lite():
        settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_async_engine(url, hide_parameters=True)
        event.listen(engine.sync_engine, "connect", _enable_sqlite_foreign_keys)
        return engine
    return create_async_engine(
        url,
        connect_args={"timeout": POSTGRES_CONNECT_TIMEOUT_SECONDS},
        pool_pre_ping=True,
        hide_parameters=True,
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create the request-session factory bound to ``engine``.

    ``expire_on_commit`` is off so objects a service has committed stay readable
    while the response is built.
    """
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding one ``AsyncSession`` per request.

    The session comes from ``request.app.state.sessionmaker``, which the
    application lifespan sets. On an exception the session is rolled back and the
    exception re-raised; the session is closed either way. It never commits:
    the service that owns the transaction does.

    Args:
        request: The current request.

    Yields:
        The request's session.
    """
    sessionmaker: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
    async with sessionmaker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
