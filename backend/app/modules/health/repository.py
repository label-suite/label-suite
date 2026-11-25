"""Data access of the health module (B1, B5)."""

from sqlalchemy import literal, select
from sqlalchemy.ext.asyncio import AsyncSession

__all__ = ["HealthRepository"]


class HealthRepository:
    """Runs the health query on the request's session.

    Args:
        session: The request-scoped async session the query runs on.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def ping(self) -> None:
        """Run ``SELECT 1`` once against the current database.

        Raises:
            sqlalchemy.exc.DBAPIError, OSError, TimeoutError: Passed through
                unchanged when the database cannot be reached; the service
                decides what they mean.
        """
        await self._session.execute(select(literal(1)))
