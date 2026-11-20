"""Business logic of the health module and its dependency factory (design D4)."""

import logging
from typing import Annotated, Protocol

from fastapi import Depends
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.envelope import current_trace_id
from app.core.errors import DatabaseUnavailableError
from app.modules.health.repository import HealthRepository
from app.modules.health.schemas import HealthData, HealthStatus

__all__ = ["HealthService", "get_health_service"]

logger = logging.getLogger(__name__)

_UNAVAILABLE_ERRORS = (OperationalError, DBAPIError, OSError, TimeoutError)
"""Connection failures and timeouts; ``OSError`` covers a refused connection."""


class _Pinger(Protocol):
    async def ping(self) -> None: ...


class HealthService:
    """Reports whether the service and its database are usable."""

    def __init__(self, repository: _Pinger) -> None:
        self._repository = repository

    async def check(self) -> HealthData:
        """Query the database once and report the result.

        Side effects:
            Logs one ``WARNING`` with the trace ID and the exception type when
            the database is unavailable; never the exception text, which can
            hold the connection string or driver details (S9).

        Returns:
            ``HealthData`` with both fields ``ok``.

        Raises:
            DatabaseUnavailableError: When the query fails with a connection
                error or a timeout; the original exception is not chained.
        """
        try:
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
