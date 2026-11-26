"""Request and response schemas of the account module (``api-contract.md``).

Requests accept camelCase only and refuse undeclared fields (``RequestModel``). The
only account data any response carries is ``SessionUserData``: the caller's own ``id``,
``name``, ``email`` and ``role``. Password hashes, the Google link, the credential
version, the Seeder flag and session identifiers are not in any schema, so they cannot
be returned (security-agent-rules S4). Tokens travel only in cookies.
"""

from typing import Annotated

from pydantic import Field, StringConstraints

from app.core.auth import SystemRole
from app.core.schemas import RequestModel, ResponseModel

__all__ = [
    "GoogleAuthorizationData",
    "GoogleSessionRequest",
    "LoginOptionsData",
    "LoginRequest",
    "RefreshRequest",
    "SessionData",
    "SessionUserData",
]


class LoginRequest(RequestModel):
    """Email-and-password sign-in.

    Attributes:
        email: 1 to 320 characters once surrounding whitespace is removed; the format
            is not checked (spec 01-01 §資料欄位).
        password: 1 to 1024 characters, taken as typed: not trimmed, no composition
            rule (spec 01-01 Q8).
    """

    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)]
    password: Annotated[str, Field(min_length=1, max_length=1024)]


class RefreshRequest(RequestModel):
    """The body of a refresh: always the empty object ``{}``."""


class GoogleSessionRequest(RequestModel):
    """Completing Google sign-in with what Google sent back to the frontend.

    Attributes:
        code: The authorisation code, passed on as received.
        state: Must equal the ``state`` in the flow cookie.
    """

    code: Annotated[str, Field(min_length=1, max_length=2048)]
    state: Annotated[str, Field(min_length=1, max_length=512)]


class SessionUserData(ResponseModel):
    """The signed-in account, as shown by the landing page.

    Attributes:
        id: The account ID.
        name: The display name.
        email: The stored, normalised Email.
        role: The system role read from the database for this request; display only.
    """

    id: str
    name: str
    email: str
    role: SystemRole


class SessionData(ResponseModel):
    """``data`` of the sign-in, refresh and current-session responses."""

    user: SessionUserData


class LoginOptionsData(ResponseModel):
    """What the sign-in page offers on this deployment.

    Attributes:
        self_registration_enabled: Whether a mail service is configured.
        google_enabled: Whether all three Google settings are set.
    """

    self_registration_enabled: bool
    google_enabled: bool


class GoogleAuthorizationData(ResponseModel):
    """The Google authorisation URL the browser navigates to.

    Attributes:
        authorization_url: Includes ``state``, ``nonce``, the S256 PKCE challenge and
            ``redirect_uri``; the verifier stays in the flow cookie.
    """

    authorization_url: str
