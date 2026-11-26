"""Who is calling: steps 1 and 2 of authorization (login-auth-guard system-design §權限檢查點).

``get_current_principal`` is the dependency every endpoint that needs a signed-in caller
uses. The identity comes only from the ``__Host-ls_at`` cookie; the ``Authorization``
header, the query string and the body are never read (security-agent-rules S1). The
access token is only the key to the session: the ``PrincipalLoader`` in
``app.state.principal_loader`` reads the session and the account from the database on
every request and decides (design D7, ADR-004 D2). The token's ``role`` claim is never
used for authorization (S3).

``app.core`` may not import the account module (contract ``Core does not depend on
modules``), so this module only defines the ``PrincipalLoader`` protocol; the account
module implements it and the assembly point ``app.main`` puts it in ``app.state``.

Every failure, whatever the reason, is the same ``AuthenticationRequiredError``
(``401 AUTH_REQUIRED``, one sentence), so a response never tells why it failed or whose
session it was. Steps 3 and 4 (the permission matrix and the per-operation conditions,
including answer isolation) come after this and are not built yet.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, Protocol
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import SessionCookies
from app.core.db import get_db
from app.core.errors import AppError
from app.core.tokens import AccessClaims, AccessTokenCodec, InvalidAccessTokenError

__all__ = [
    "AuthenticationRequiredError",
    "Principal",
    "PrincipalLoader",
    "SystemRole",
    "get_current_principal",
]

SystemRole = Literal["user", "super_admin"]
"""The two system roles; anything else read from the database is rejected."""


class AuthenticationRequiredError(AppError):
    """``401``: no usable login session; the same response for every reason."""

    status_code = 401
    code = "AUTH_REQUIRED"
    message_key = "common.auth_required"


@dataclass(frozen=True)
class Principal:
    """The signed-in caller, as read from the database for this request.

    Holds nothing that identifies the person beyond the account ID: no Email, no
    credential version.

    Attributes:
        user_id: The account.
        session_id: The login session this request belongs to.
        role: The system role read from the database for this request.
    """

    user_id: UUID
    session_id: UUID
    role: SystemRole


class PrincipalLoader(Protocol):
    """Turns verified access-token claims into a ``Principal`` by reading the database."""

    async def load(self, claims: AccessClaims, db: AsyncSession) -> Principal:
        """Return the caller when the session and the account still allow access.

        Implementations only read; they never write.

        Raises:
            AuthenticationRequiredError: When the session does not exist, belongs to
                another account, was revoked or expired, the account is inactive or
                anonymised, the credential version differs, or the stored role is not
                a ``SystemRole``.
        """
        ...


async def get_current_principal(
    request: Request,
    db: AsyncSession = Depends(get_db),  # noqa: B008 - FastAPI dependency
) -> Principal:
    """FastAPI dependency: return the signed-in caller or refuse the request.

    Args:
        request: The current request; only its ``__Host-ls_at`` cookie is read.
        db: The request's database session, passed to the loader.

    Returns:
        The ``Principal`` the loader built.

    Raises:
        AuthenticationRequiredError: When the cookie is absent, the token does not
            verify or has expired, or the loader refuses the session.
        RuntimeError: When the app was assembled without ``access_codec`` or
            ``principal_loader`` in ``app.state`` (a wiring error, not a caller error).
    """
    codec: AccessTokenCodec | None = getattr(request.app.state, "access_codec", None)
    loader: PrincipalLoader | None = getattr(request.app.state, "principal_loader", None)
    if codec is None or loader is None:
        raise RuntimeError("app.state.access_codec and app.state.principal_loader are required")
    raw = SessionCookies.read_access(request)
    if raw is None:
        raise AuthenticationRequiredError
    try:
        claims = codec.decode(raw, now=datetime.now(UTC))
    except InvalidAccessTokenError:
        raise AuthenticationRequiredError from None
    return await loader.load(claims, db)
