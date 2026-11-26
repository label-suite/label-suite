"""Google sign-in: start the flow and complete it (spec ``account-login``, ADR-004 D5).

Google only signs in to, or links, an existing account; it never creates one. The flow
state (``state``, ``nonce``, PKCE verifier and an expiry) travels in a signed, ``HttpOnly``
cookie, so the server keeps nothing between the two requests. The exchange with Google
happens before the transaction opens; a failure there opens none.
"""

import hmac
import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.cookies import OIDC_FLOW_MAX_AGE
from app.core.db import get_db
from app.core.email_identity import EmailTooLongError, normalize_email
from app.core.tokens import new_opaque_token, sign_payload, verify_payload
from app.modules.account.models import User
from app.modules.account.repository import UserRepository
from app.modules.account.service.errors import (
    GoogleFlowInvalidError,
    GoogleLoginRejectedError,
    GoogleUnavailableError,
)
from app.modules.account.service.session import (
    IssuedSession,
    SessionService,
    SourceInfo,
    get_session_service,
    may_sign_in,
)
from app.oidc.google import GoogleIdentity, GoogleOidcClient, GoogleOidcError

__all__ = ["GoogleAuthorization", "GoogleLoginService", "get_google_login_service"]


@dataclass(frozen=True)
class GoogleAuthorization:
    """The start of a Google sign-in.

    Attributes:
        url: Google's authorisation URL for the browser.
        flow_cookie: The signed flow state for ``__Host-ls_oidc``.
    """

    url: str
    flow_cookie: str


@dataclass(frozen=True)
class _Flow:
    state: str
    nonce: str
    verifier: str


class GoogleLoginService:
    """Starts and completes Google sign-in; owns the completion transaction.

    Args:
        db: The request's session.
        sessions: Starts the session and revokes the old ones on linking.
        settings: The running app's settings.
        flow_key: ``TokenKeys.oidc_flow``.
    """

    def __init__(
        self, db: AsyncSession, sessions: SessionService, settings: Settings, flow_key: bytes
    ) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._sessions = sessions
        self._settings = settings
        self._flow_key = flow_key

    def _client(self) -> GoogleOidcClient:
        settings = self._settings
        if (
            settings.google_client_id is None
            or settings.google_client_secret is None
            or settings.google_redirect_uri is None
        ):
            raise GoogleUnavailableError
        return GoogleOidcClient(
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret.get_secret_value(),
            redirect_uri=settings.google_redirect_uri,
        )

    async def begin(self) -> GoogleAuthorization:
        """Create a fresh flow and Google's authorisation URL for it.

        Raises:
            GoogleUnavailableError: This deployment has no Google sign-in.
        """
        client = self._client()
        flow = _Flow(
            state=new_opaque_token(), nonce=new_opaque_token(), verifier=new_opaque_token()
        )
        payload = json.dumps(
            {
                "state": flow.state,
                "nonce": flow.nonce,
                "verifier": flow.verifier,
                "exp": int(time.time()) + OIDC_FLOW_MAX_AGE,
            }
        )
        url = await client.authorization_url(
            state=flow.state, nonce=flow.nonce, code_verifier=flow.verifier
        )
        return GoogleAuthorization(url=url, flow_cookie=sign_payload(self._flow_key, payload))

    async def complete(
        self, code: str, state: str, flow_cookie: str | None, source: SourceInfo, now: datetime
    ) -> IssuedSession:
        """Finish Google sign-in and start a session on this device.

        An account already linked to this Google account wins, whatever its Email. With
        none, a Google-verified Email that matches an active, never-anonymised account
        with no Google link links it in the same transaction: the Google ``sub`` is
        stored, the local password removed, the credential version raised and every
        existing session ended (ADR-004 D5). Nothing tells the user it happened.

        Side effects:
            Two calls to Google before the transaction; on success, commits the link (if
            any) and the new session.

        Raises:
            GoogleUnavailableError: This deployment has no Google sign-in.
            GoogleFlowInvalidError: The flow cookie is missing, forged or expired, the
                ``state`` differs, or Google's answer does not verify.
            GoogleLoginRejectedError: No account may sign in with this Google account;
                one error for every reason.
        """
        client = self._client()
        flow = self._read_flow(flow_cookie, state)
        try:
            identity = await client.exchange(
                code=code, code_verifier=flow.verifier, nonce=flow.nonce
            )
        except GoogleOidcError:
            raise GoogleFlowInvalidError from None
        user = await self._account_for(identity, now)
        issued = await self._sessions.start(user, source, now)
        await self._db.commit()
        return issued

    def _read_flow(self, flow_cookie: str | None, state: str) -> _Flow:
        payload = None if flow_cookie is None else verify_payload(self._flow_key, flow_cookie)
        if payload is None:
            raise GoogleFlowInvalidError
        try:
            data: dict[str, Any] = json.loads(payload)
            flow = _Flow(state=data["state"], nonce=data["nonce"], verifier=data["verifier"])
            expired = int(data["exp"]) <= int(time.time())
        except (ValueError, KeyError, TypeError):
            raise GoogleFlowInvalidError from None
        if expired or not hmac.compare_digest(flow.state.encode(), state.encode()):
            raise GoogleFlowInvalidError
        return flow

    async def _account_for(self, identity: GoogleIdentity, now: datetime) -> User:
        linked = await self._users.get_by_google_subject(identity.subject)
        if linked is not None:
            if not may_sign_in(linked):
                raise GoogleLoginRejectedError
            return linked
        if not identity.email_verified:
            raise GoogleLoginRejectedError
        try:
            normalized = normalize_email(identity.email)
        except EmailTooLongError:
            raise GoogleLoginRejectedError from None
        user = await self._users.get_by_email(normalized)
        if user is None or not may_sign_in(user) or user.google_subject is not None:
            raise GoogleLoginRejectedError
        user.google_subject = identity.subject
        user.hashed_password = None
        user.credential_version += 1
        await self._sessions.revoke_all(user.id, now)
        return user


def get_google_login_service(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    sessions: Annotated[SessionService, Depends(get_session_service)],
) -> GoogleLoginService:
    """FastAPI dependency: a ``GoogleLoginService`` over the request's session."""
    return GoogleLoginService(
        db, sessions, request.app.state.settings, request.app.state.token_keys.oidc_flow
    )
