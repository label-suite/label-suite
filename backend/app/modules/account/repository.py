"""Data access of the account module (backend-agent-rules B1, B4, B5).

Repositories only read and write through SQLAlchemy and never commit: the service that
owns the transaction does. The conditional updates (``consume_if_unused``,
``reissue_if_below``) are single ``UPDATE ... WHERE`` statements whose row count says
whether this caller won, so two tabs refreshing at once behave the same on SQLite and
PostgreSQL (system-design §元件清單).
"""

import uuid
from datetime import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.account.models import AccountRefreshToken, AccountSession, User

__all__ = ["AccountSessionRepository", "RefreshTokenRepository", "UserRepository"]


def _rowcount(result: object) -> int:
    """Return the affected-row count of an ``UPDATE`` result (always a ``CursorResult``)."""
    return int(cast("CursorResult[Any]", result).rowcount)


class UserRepository:
    """Reads and adds ``users`` rows.

    Args:
        session: The async session of the current request or command.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Return the account with this ID, or ``None``."""
        return await self._session.get(User, user_id)

    async def get_by_email(self, normalized: str) -> User | None:
        """Return the account whose stored (already normalised) Email equals ``normalized``."""
        result = await self._session.execute(select(User).where(User.email == normalized))
        return result.scalar_one_or_none()

    async def get_by_google_subject(self, subject: str) -> User | None:
        """Return the account linked to this Google ``sub``, or ``None``."""
        result = await self._session.execute(select(User).where(User.google_subject == subject))
        return result.scalar_one_or_none()

    async def get_seeder(self) -> User | None:
        """Return the Seeder admin, or ``None`` when there is none yet."""
        result = await self._session.execute(select(User).where(User.is_seeder.is_(True)))
        return result.scalar_one_or_none()

    async def count(self) -> int:
        """Return how many accounts exist."""
        result = await self._session.execute(select(func.count()).select_from(User))
        return int(result.scalar_one())

    def add(self, user: User) -> None:
        """Stage a new account for insertion at the next flush."""
        self._session.add(user)


class AccountSessionRepository:
    """Reads and changes ``account_session`` rows.

    Args:
        session: The async session of the current request.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, row: AccountSession) -> None:
        """Stage a new login session for insertion at the next flush."""
        self._session.add(row)

    async def get_with_user(self, session_id: uuid.UUID) -> tuple[AccountSession, User] | None:
        """Return the login session and its account in one query, or ``None``."""
        result = await self._session.execute(
            select(AccountSession, User)
            .join(User, User.id == AccountSession.user_id)
            .where(AccountSession.id == session_id)
        )
        row = result.one_or_none()
        return None if row is None else (row[0], row[1])

    async def touch(self, session_id: uuid.UUID, at: datetime) -> None:
        """Set ``last_seen_at`` of the session to ``at``."""
        await self._session.execute(
            update(AccountSession)
            .where(AccountSession.id == session_id)
            .values(last_seen_at=at)
            .execution_options(synchronize_session=False)
        )

    async def revoke(self, session_id: uuid.UUID, at: datetime, *, logged_out: bool) -> bool:
        """End one session that is still active.

        Args:
            session_id: The session to end.
            at: The time to record.
            logged_out: Whether this is an explicit, verifiable logout; only then is
                ``logged_out_at`` written as well.

        Returns:
            Whether a still-active session was ended.
        """
        values: dict[str, datetime] = {"revoked_at": at}
        if logged_out:
            values["logged_out_at"] = at
        result = await self._session.execute(
            update(AccountSession)
            .where(AccountSession.id == session_id, AccountSession.revoked_at.is_(None))
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        return _rowcount(result) == 1

    async def revoke_all_for_user(self, user_id: uuid.UUID, at: datetime) -> int:
        """End every active session of the account, without recording a logout.

        Returns:
            How many sessions were ended.
        """
        result = await self._session.execute(
            update(AccountSession)
            .where(AccountSession.user_id == user_id, AccountSession.revoked_at.is_(None))
            .values(revoked_at=at)
            .execution_options(synchronize_session=False)
        )
        return _rowcount(result)


class RefreshTokenRepository:
    """Reads and changes ``account_refresh_token`` rows.

    Args:
        session: The async session of the current request.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, row: AccountRefreshToken) -> None:
        """Stage a new refresh token for insertion at the next flush."""
        self._session.add(row)

    async def get_with_session(
        self, token_hash: str
    ) -> tuple[AccountRefreshToken, AccountSession, User] | None:
        """Return the token with this hash, its session and its account, or ``None``."""
        result = await self._session.execute(
            select(AccountRefreshToken, AccountSession, User)
            .join(AccountSession, AccountSession.id == AccountRefreshToken.session_id)
            .join(User, User.id == AccountSession.user_id)
            .where(AccountRefreshToken.token_hash == token_hash)
        )
        row = result.one_or_none()
        return None if row is None else (row[0], row[1], row[2])

    async def consume_if_unused(self, token_id: uuid.UUID, at: datetime) -> bool:
        """Mark the token consumed at ``at`` unless someone already did.

        Returns:
            Whether this call consumed it.
        """
        result = await self._session.execute(
            update(AccountRefreshToken)
            .where(AccountRefreshToken.id == token_id, AccountRefreshToken.consumed_at.is_(None))
            .values(consumed_at=at)
            .execution_options(synchronize_session=False)
        )
        return _rowcount(result) == 1

    async def consumed_at(self, token_id: uuid.UUID) -> datetime | None:
        """Return the token's current ``consumed_at``, read fresh from the database."""
        result = await self._session.execute(
            select(AccountRefreshToken.consumed_at).where(AccountRefreshToken.id == token_id)
        )
        return result.scalar_one_or_none()

    async def reissue_if_below(self, token_id: uuid.UUID, limit: int) -> bool:
        """Count one more grace-period reissue unless the token already had ``limit``.

        Returns:
            Whether this call may reissue.
        """
        result = await self._session.execute(
            update(AccountRefreshToken)
            .where(AccountRefreshToken.id == token_id, AccountRefreshToken.reissue_count < limit)
            .values(reissue_count=AccountRefreshToken.reissue_count + 1)
            .execution_options(synchronize_session=False)
        )
        return _rowcount(result) == 1
