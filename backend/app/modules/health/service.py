"""Business logic of the health module and its dependency factory (design D4)."""

import asyncio
import logging
from typing import Annotated, Protocol

from fastapi import Depends
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import POSTGRES_CONNECT_TIMEOUT_SECONDS, get_db
from app.core.envelope import current_trace_id
from app.core.errors import DatabaseUnavailableError
from app.modules.health.repository import HealthRepository
from app.modules.health.schemas import HealthData, HealthStatus

__all__ = ["HealthService", "get_health_service"]

logger = logging.getLogger(__name__)

_UNAVAILABLE_ERRORS = (OperationalError, DBAPIError, OSError, TimeoutError, PoolTimeoutError)
"""Connection failures and timeouts.

``OSError`` covers a refused connection, the built-in ``TimeoutError`` the
health-check bound and ``sqlalchemy.exc.TimeoutError`` an exhausted pool.
"""


class _Pinger(Protocol):
    async def ping(self) -> None: ...


class HealthService:
    """Reports whether the service and its database are usable.

    Args:
        repository: The data-access object whose ``ping`` queries the database.
    """

    def __init__(self, repository: _Pinger) -> None:
        self._repository = repository

    async def check(self) -> HealthData:
        """Query the database once and report the result.

        The whole query, including waiting for a pooled connection, is bounded
        by ``POSTGRES_CONNECT_TIMEOUT_SECONDS`` so a hung connection cannot hold
        the health check past the contract's limit; only this check is bounded,
        not the engine.

        Side effects:
            Logs one ``WARNING`` with the trace ID and the exception type when
            the database is unavailable; never the exception text, which can
            hold the connection string or driver details (S9).

        Returns:
            ``HealthData`` with both fields ``ok``.

        Raises:
            DatabaseUnavailableError: When the query fails with a connection
                error, exceeds the bound or finds the pool exhausted; the
                original exception is not chained.
        """
        try:
            async with asyncio.timeout(POSTGRES_CONNECT_TIMEOUT_SECONDS):
                await self._repository.ping()
        except _UNAVAILABLE_ERRORS as exc:
            logger.warning(
                "Database unavailable (traceId=%s): %s.%s",
                current_trace_id(),
                type(exc).__module__,
                type(exc).__qualname__,
            )
            raise DatabaseUnavailableError() from None
        return HealthData(status=HealthStatus.OK, database=HealthStatus.OK)


def get_health_service(db: Annotated[AsyncSession, Depends(get_db)]) -> HealthService:
    """FastAPI dependency: a ``HealthService`` over the request's session."""
    return HealthService(HealthRepository(db))
