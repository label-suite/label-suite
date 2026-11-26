"""Email-and-password sign-in and the sign-in page options (spec ``account-login``)."""

from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.db import get_db
from app.core.email_identity import EmailTooLongError, normalize_email
from app.core.passwords import PasswordHasher
from app.modules.account.repository import UserRepository
from app.modules.account.schemas import LoginOptionsData
from app.modules.account.service.errors import InvalidCredentialsError
from app.modules.account.service.session import (
    IssuedSession,
    SessionService,
    SourceInfo,
    get_session_service,
)

__all__ = [
    "LoginOptionsService",
    "PasswordLoginService",
    "get_login_options_service",
    "get_password_login_service",
]


class PasswordLoginService:
    """Signs in with Email and password; owns the sign-in transaction.

    Args:
        db: The request's session.
        sessions: Starts the session on success.
        hasher: Verifies the password; a default ``PasswordHasher`` when omitted.
    """

    def __init__(
        self, db: AsyncSession, sessions: SessionService, hasher: PasswordHasher | None = None
    ) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._sessions = sessions
        self._hasher = hasher or PasswordHasher()

    async def login(
        self, email: str, password: str, source: SourceInfo, now: datetime
    ) -> IssuedSession:
        """Start a session when the Email and password belong to an account that may sign in.

        Every failure costs one full password verification, so timing does not tell an
        unknown Email from a wrong password. The login-lockout check (#726) will sit
        after normalising and before the account lookup.

        Side effects:
            On success, adds a session and its first refresh token and commits.

        Raises:
            InvalidCredentialsError: Unknown Email, Email over 254 characters once
                normalised, no local password, wrong password, inactive or anonymised
                account; the same error for all of them.
        """
        try:
            normalized = normalize_email(email)
        except EmailTooLongError:
            await self._hasher.verify_dummy(password)
            raise InvalidCredentialsError from None
        user = await self._users.get_by_email(normalized)
        if user is None or user.hashed_password is None:
            await self._hasher.verify_dummy(password)
            raise InvalidCredentialsError
        matches = await self._hasher.verify(user.hashed_password, password)
        if not matches or not user.is_active or user.anonymized_at is not None:
            raise InvalidCredentialsError
        issued = await self._sessions.start(user, source, now)
        await self._db.commit()
        return issued


class LoginOptionsService:
    """Reports the sign-in page switches; reads only the settings, never the database.

    Args:
        settings: The running app's settings.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get(self) -> LoginOptionsData:
        """Return whether self-registration (a mail service) and Google are available."""
        return LoginOptionsData(
            self_registration_enabled=self._settings.mail_configured(),
            google_enabled=self._settings.google_configured(),
        )


def get_password_login_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    sessions: Annotated[SessionService, Depends(get_session_service)],
) -> PasswordLoginService:
    """FastAPI dependency: a ``PasswordLoginService`` over the request's session."""
    return PasswordLoginService(db, sessions)


def get_login_options_service(request: Request) -> LoginOptionsService:
    """FastAPI dependency: a ``LoginOptionsService`` over ``app.state.settings``."""
    return LoginOptionsService(request.app.state.settings)
