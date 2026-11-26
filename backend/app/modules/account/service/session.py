"""Login sessions: start, refresh, logout, revoke, and the principal loader (design D2).

Every state change of a session and its refresh tokens is decided here
(system-design §登入狀態與 refresh token 的狀態, backend-agent-rules B1). The limits live
in ``SessionPolicy``. ``SessionService.start`` leaves the commit to the sign-in service
that owns the transaction; ``refresh`` and ``logout`` own theirs and commit.
"""

import json
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, get_args

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticationRequiredError, Principal, SystemRole
from app.core.db import get_db
from app.core.tokens import (
    AccessClaims,
    AccessTokenCodec,
    csrf_value_for,
    hash_token,
    new_opaque_token,
)
from app.modules.account.models import AccountRefreshToken, AccountSession, User
from app.modules.account.repository import (
    AccountSessionRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.modules.account.schemas import SessionData, SessionUserData
from app.modules.account.service.errors import (
    RefreshConflictError,
    SessionExpiredError,
    SessionInvalidError,
)

__all__ = [
    "AccountPrincipalLoader",
    "IssuedSession",
    "SessionPolicy",
    "SessionService",
    "SourceInfo",
    "get_session_service",
    "may_sign_in",
    "session_data",
]

_ADDRESS_LIMIT = 64
_USER_AGENT_LIMIT = 512
_ROLES: frozenset[str] = frozenset(get_args(SystemRole))


@dataclass(frozen=True)
class SessionPolicy:
    """The session limits (spec 01-05 §登入狀態能撐多久; system-design T5).

    Attributes:
        absolute_limit: How long a session lasts from sign-in, whatever happens.
        idle_limit: How long a session survives without a refresh.
        access_ttl: How long one access token lasts.
        refresh_grace: How long after a refresh token's first use a second use still
            counts as another tab of the same browser.
        max_grace_reissue: How many extra tokens one refresh token may give within the
            grace period.
    """

    absolute_limit: timedelta = timedelta(days=90)
    idle_limit: timedelta = timedelta(days=7)
    access_ttl: timedelta = timedelta(minutes=15)
    refresh_grace: timedelta = timedelta(seconds=30)
    max_grace_reissue: int = 1

    def is_expired(self, started_at: datetime, last_seen_at: datetime, now: datetime) -> bool:
        """Return whether either limit has been reached at ``now``."""
        return now >= started_at + self.absolute_limit or now >= last_seen_at + self.idle_limit

    def refresh_expiry(self, started_at: datetime, now: datetime) -> datetime:
        """Return when a refresh token issued at ``now`` expires; never past 90 days."""
        return min(now + self.idle_limit, started_at + self.absolute_limit)

    def access_expiry(self, started_at: datetime, now: datetime) -> datetime:
        """Return when an access token issued at ``now`` expires; never past 90 days."""
        return min(now + self.access_ttl, started_at + self.absolute_limit)

    def within_grace(self, consumed_at: datetime, now: datetime) -> bool:
        """Return whether ``now`` is within the grace period after ``consumed_at``."""
        return now - consumed_at <= self.refresh_grace


@dataclass(frozen=True)
class SourceInfo:
    """Where a sign-in came from; stored as personal data on the session.

    Attributes:
        address: The client address as seen by the API (after trusted proxies).
        user_agent: The ``User-Agent`` header, possibly empty.
    """

    address: str
    user_agent: str

    def serialise(self) -> str:
        """Return the truncated JSON text stored in ``account_session.source_info``."""
        return json.dumps(
            {
                "address": self.address[:_ADDRESS_LIMIT],
                "userAgent": self.user_agent[:_USER_AGENT_LIMIT],
            },
            ensure_ascii=False,
        )


@dataclass(frozen=True)
class IssuedSession:
    """The credentials of a session just started or refreshed; the router sets the cookies.

    Attributes:
        session_id: The login session.
        access_token: The access JWT.
        refresh_token: The raw refresh token; only its hash is stored.
        csrf_token: The CSRF value bound to the session.
        expires_at: When the refresh token expires; the cookies live until then.
        user: The account, so the router can build the four response fields.
    """

    session_id: uuid.UUID
    access_token: str
    refresh_token: str
    csrf_token: str
    expires_at: datetime
    user: User


class SessionService:
    """Starts, refreshes and ends login sessions.

    Args:
        db: The request's session.
        codec: Issues the access JWT.
        csrf_key: ``TokenKeys.csrf``.
        policy: The limits; the defaults are the spec's.
    """

    def __init__(
        self,
        db: AsyncSession,
        *,
        codec: AccessTokenCodec,
        csrf_key: bytes,
        policy: SessionPolicy | None = None,
    ) -> None:
        self._db = db
        self._sessions = AccountSessionRepository(db)
        self._tokens = RefreshTokenRepository(db)
        self._codec = codec
        self._csrf_key = csrf_key
        self._policy = policy or SessionPolicy()

    async def start(self, user: User, source: SourceInfo, now: datetime) -> IssuedSession:
        """Begin a new session for ``user`` with its first refresh token.

        Side effects:
            Stages one ``account_session`` and one ``account_refresh_token`` row and
            flushes; does not commit (the caller owns the transaction).
        """
        row = AccountSession(
            id=uuid.uuid4(),
            user_id=user.id,
            started_at=now,
            last_seen_at=now,
            source_info=source.serialise(),
        )
        self._sessions.add(row)
        # No ORM relationship orders the inserts, so the session row goes in first.
        await self._db.flush()
        return await self._issue(user, row, now)

    async def refresh(self, raw_refresh: str, now: datetime) -> IssuedSession:
        """Extend the session that ``raw_refresh`` belongs to and rotate the token.

        The order matters: an ended session never gets a grace period, and only an
        active one is checked for reuse (system-design §安全撤銷的登入狀態沒有寬限資格).

        Side effects:
            Commits. On success: consumes the token (or counts a grace reissue), adds
            the next token and moves ``last_seen_at``. On expiry: ends the session
            without recording a logout. On reuse outside the grace period: ends every
            session of the account; this is committed before raising, because the
            request session rolls back on an exception.

        Raises:
            SessionInvalidError: Unknown token, ended session, inactive or anonymised
                account, or reuse outside the grace period.
            SessionExpiredError: The 90-day or 7-day limit has been reached.
            RefreshConflictError: A third use within the grace period; nothing changes.
        """
        found = await self._tokens.get_with_session(hash_token(raw_refresh))
        if found is None:
            raise SessionInvalidError
        token, session, user = found
        if session.revoked_at is not None or not may_sign_in(user):
            raise SessionInvalidError
        if self._policy.is_expired(session.started_at, session.last_seen_at, now):
            await self._sessions.revoke(session.id, now, logged_out=False)
            await self._db.commit()
            raise SessionExpiredError
        if not await self._tokens.consume_if_unused(token.id, now):
            await self._second_use(token, user, now)
        await self._sessions.touch(session.id, now)
        issued = await self._issue(user, session, now)
        await self._db.commit()
        return issued

    async def _second_use(self, token: AccountRefreshToken, user: User, now: datetime) -> None:
        consumed_at = await self._tokens.consumed_at(token.id)
        if consumed_at is not None and self._policy.within_grace(consumed_at, now):
            if await self._tokens.reissue_if_below(token.id, self._policy.max_grace_reissue):
                return
            raise RefreshConflictError
        await self._sessions.revoke_all_for_user(user.id, now)
        # Committed here because get_db rolls back when the error propagates.
        await self._db.commit()
        raise SessionInvalidError

    async def logout(self, raw_refresh: str | None, now: datetime) -> None:
        """End the session ``raw_refresh`` belongs to and record the logout.

        Does nothing, and records nothing, when the token is absent or unknown, or its
        session has already ended or expired: only a verifiable logout of an active
        session is a logout (spec 01-05 §登出紀錄只記真正的登出).

        Side effects:
            Commits when a session was ended.
        """
        if not raw_refresh:
            return
        found = await self._tokens.get_with_session(hash_token(raw_refresh))
        if found is None:
            return
        _, session, _ = found
        if session.revoked_at is not None:
            return
        if self._policy.is_expired(session.started_at, session.last_seen_at, now):
            return
        if await self._sessions.revoke(session.id, now, logged_out=True):
            await self._db.commit()

    async def current(self, principal: Principal) -> SessionData:
        """Return the four response fields of the caller ``get_current_principal`` found.

        Raises:
            AuthenticationRequiredError: When the account vanished in between.
        """
        user = await UserRepository(self._db).get_by_id(principal.user_id)
        if user is None:
            raise AuthenticationRequiredError
        return session_data(user, role=principal.role)

    async def revoke_all(self, user_id: uuid.UUID, now: datetime) -> int:
        """End every active session of the account without recording a logout.

        Side effects:
            Stages the update; does not commit.

        Returns:
            How many sessions were ended.
        """
        return await self._sessions.revoke_all_for_user(user_id, now)

    async def _issue(self, user: User, session: AccountSession, now: datetime) -> IssuedSession:
        raw = new_opaque_token()
        expires_at = self._policy.refresh_expiry(session.started_at, now)
        self._tokens.add(
            AccountRefreshToken(
                id=uuid.uuid4(),
                session_id=session.id,
                token_hash=hash_token(raw),
                issued_at=now,
                expires_at=expires_at,
            )
        )
        await self._db.flush()
        access = self._codec.issue(
            user_id=user.id,
            session_id=session.id,
            credential_version=user.credential_version,
            role=user.role,
            issued_at=now,
            expires_at=self._policy.access_expiry(session.started_at, now),
        )
        return IssuedSession(
            session_id=session.id,
            access_token=access,
            refresh_token=raw,
            csrf_token=csrf_value_for(self._csrf_key, session.id),
            expires_at=expires_at,
            user=user,
        )


def may_sign_in(user: User) -> bool:
    """Return whether the account may sign in at all: active and never anonymised."""
    return user.is_active and user.anonymized_at is None


def _system_role(stored: str) -> SystemRole:
    if stored not in _ROLES:
        raise AuthenticationRequiredError
    return "super_admin" if stored == "super_admin" else "user"


def session_data(user: User, *, role: SystemRole | None = None) -> SessionData:
    """Return the response ``data`` for ``user``: exactly ``id``, ``name``, ``email``, ``role``.

    Args:
        user: The account.
        role: The role this request authorised with; read from ``user`` when omitted.

    Raises:
        AuthenticationRequiredError: When the stored role is not a ``SystemRole``.
    """
    return SessionData(
        user=SessionUserData(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=role if role is not None else _system_role(user.role),
        )
    )


def get_session_service(
    request: Request, db: Annotated[AsyncSession, Depends(get_db)]
) -> SessionService:
    """FastAPI dependency: a ``SessionService`` over the request's session.

    Reads the codec and the CSRF key ``create_app`` put in ``app.state``.
    """
    return SessionService(
        db, codec=request.app.state.access_codec, csrf_key=request.app.state.token_keys.csrf
    )


class AccountPrincipalLoader:
    """Implements ``app.core.auth.PrincipalLoader`` for the account tables.

    One query reads the session and its account; nothing is written (system-design T3,
    T10). Every reason to refuse raises the same ``AuthenticationRequiredError``.

    Args:
        policy: The session limits.
        clock: Returns the current time; replaced in tests.
    """

    def __init__(
        self,
        *,
        policy: SessionPolicy | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._policy = policy or SessionPolicy()
        self._clock = clock or (lambda: datetime.now(UTC))

    async def load(self, claims: AccessClaims, db: AsyncSession) -> Principal:
        """Return the caller when the session and the account still allow access.

        Raises:
            AuthenticationRequiredError: Session missing, of another account, ended or
                expired; account inactive or anonymised; credential version changed;
                stored role not a ``SystemRole``.
        """
        found = await AccountSessionRepository(db).get_with_user(claims.session_id)
        if found is None:
            raise AuthenticationRequiredError
        session, user = found
        now = self._clock()
        if (
            session.user_id != claims.user_id
            or session.revoked_at is not None
            or self._policy.is_expired(session.started_at, session.last_seen_at, now)
            or not may_sign_in(user)
            or user.credential_version != claims.credential_version
        ):
            raise AuthenticationRequiredError
        return Principal(user_id=user.id, session_id=session.id, role=_system_role(user.role))
