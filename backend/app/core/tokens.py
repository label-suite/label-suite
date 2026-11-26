"""Keys, the access JWT, opaque tokens and signed values (login-auth-guard system-design T6).

One ``AUTH_SECRET`` signs three different things, so ``TokenKeys.derive`` turns it into
three keys with an HMAC per purpose label: the access JWT, the CSRF value and the Google
flow cookie. A value made for one purpose never verifies under another.

The access JWT carries ``sub``, ``sid``, ``credential_version``, ``role``, ``iat`` and
``exp`` (``api-contract.md`` §共用約定). Its ``role`` is for display only: authorization
reads the role from the database (security-agent-rules S3). Every way a token can be
wrong raises the same ``InvalidAccessTokenError``, which carries no detail.
"""

import base64
import binascii
import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import jwt
from pydantic import SecretStr

__all__ = [
    "AccessClaims",
    "AccessTokenCodec",
    "InvalidAccessTokenError",
    "TokenKeys",
    "csrf_value_for",
    "hash_token",
    "new_opaque_token",
    "sign_payload",
    "verify_payload",
]

_ALGORITHM = "HS256"
_REQUIRED_CLAIMS = ("sub", "sid", "credential_version", "role", "iat", "exp")
_OPAQUE_BYTES = 32  # token_urlsafe(32) is 43 characters, 256 bits
_PURPOSE_ACCESS = b"label-suite/access-jwt/v1"
_PURPOSE_CSRF = b"label-suite/csrf/v1"
_PURPOSE_OIDC_FLOW = b"label-suite/oidc-flow/v1"


@dataclass(frozen=True)
class TokenKeys:
    """The three purpose-bound keys derived from ``AUTH_SECRET``.

    The key bytes are left out of ``repr`` so a log line or a traceback never shows them.

    Attributes:
        access: Signs and verifies the access JWT.
        csrf: Computes the CSRF value bound to a session.
        oidc_flow: Signs the Google sign-in flow cookie.
    """

    access: bytes = field(repr=False)
    csrf: bytes = field(repr=False)
    oidc_flow: bytes = field(repr=False)

    @classmethod
    def derive(cls, secret: SecretStr) -> "TokenKeys":
        """Derive the three keys from ``secret``.

        Each key is ``HMAC-SHA256(secret, purpose label)``, so the same secret always
        gives the same keys and the keys differ from each other and from the secret.

        Args:
            secret: The resolved ``AUTH_SECRET``.

        Returns:
            The derived keys.
        """
        raw = secret.get_secret_value().encode("utf-8")
        return cls(
            access=hmac.new(raw, _PURPOSE_ACCESS, hashlib.sha256).digest(),
            csrf=hmac.new(raw, _PURPOSE_CSRF, hashlib.sha256).digest(),
            oidc_flow=hmac.new(raw, _PURPOSE_OIDC_FLOW, hashlib.sha256).digest(),
        )


class InvalidAccessTokenError(Exception):
    """The access token is missing a claim, malformed, badly signed or expired.

    Deliberately carries no detail: callers turn every case into the same response.
    """


@dataclass(frozen=True)
class AccessClaims:
    """The decoded claims of an access token.

    Attributes:
        user_id: ``sub``, the account the token was issued to.
        session_id: ``sid``, the login session it belongs to.
        credential_version: The account's credential version when the token was issued.
        role: The system role when the token was issued; for display only.
        issued_at: ``iat``.
        expires_at: ``exp``.
    """

    user_id: uuid.UUID
    session_id: uuid.UUID
    credential_version: int
    role: str
    issued_at: datetime
    expires_at: datetime


def _require_aware(*values: datetime) -> None:
    if any(value.tzinfo is None or value.utcoffset() is None for value in values):
        raise ValueError("datetimes must be timezone-aware")


class AccessTokenCodec:
    """Issue and decode the HS256 access JWT.

    Args:
        key: ``TokenKeys.access``.
    """

    def __init__(self, key: bytes) -> None:
        self._key = key

    def issue(
        self,
        *,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        credential_version: int,
        role: str,
        issued_at: datetime,
        expires_at: datetime,
    ) -> str:
        """Return a signed access token with the six contract claims.

        Raises:
            ValueError: When ``issued_at`` or ``expires_at`` is naive.
        """
        _require_aware(issued_at, expires_at)
        payload = {
            "sub": str(user_id),
            "sid": str(session_id),
            "credential_version": credential_version,
            "role": role,
            "iat": int(issued_at.timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        return jwt.encode(payload, self._key, algorithm=_ALGORITHM)

    def decode(self, token: str, *, now: datetime) -> AccessClaims:
        """Verify ``token`` and return its claims, rejecting it from ``exp`` on.

        Args:
            token: The value of the access cookie.
            now: The current time; the token is expired when ``now >= exp``.

        Raises:
            InvalidAccessTokenError: When the signature, a claim or the expiry is wrong.
        """
        claims = self.decode_ignoring_expiry(token)
        if now >= claims.expires_at:
            raise InvalidAccessTokenError
        return claims

    def decode_ignoring_expiry(self, token: str) -> AccessClaims:
        """Verify ``token``'s signature and claims but not its expiry.

        The CSRF check uses this: an expired access token still names the session the
        CSRF value is bound to (``api-contract.md`` §共用約定).

        Raises:
            InvalidAccessTokenError: When the signature or a claim is wrong.
        """
        try:
            payload = jwt.decode(
                token,
                self._key,
                algorithms=[_ALGORITHM],
                options={"verify_exp": False, "verify_iat": False, "require": [*_REQUIRED_CLAIMS]},
            )
            return _claims(payload)
        except (jwt.InvalidTokenError, ValueError, TypeError, OverflowError) as exc:
            raise InvalidAccessTokenError from exc


def _claims(payload: dict[str, Any]) -> AccessClaims:
    version = payload["credential_version"]
    role = payload["role"]
    sub, sid = payload["sub"], payload["sid"]
    iat, exp = payload["iat"], payload["exp"]
    if type(version) is not int or version < 0 or not isinstance(role, str):
        raise ValueError("malformed claims")
    if not isinstance(sub, str) or not isinstance(sid, str):
        raise ValueError("malformed claims")
    if type(iat) is not int or type(exp) is not int:
        raise ValueError("malformed claims")
    return AccessClaims(
        user_id=uuid.UUID(sub),
        session_id=uuid.UUID(sid),
        credential_version=version,
        role=role,
        issued_at=datetime.fromtimestamp(iat, UTC),
        expires_at=datetime.fromtimestamp(exp, UTC),
    )


def new_opaque_token() -> str:
    """Return a new random URL-safe value with 256 bits of entropy (refresh token, state)."""
    return secrets.token_urlsafe(_OPAQUE_BYTES)


def hash_token(value: str) -> str:
    """Return the SHA-256 hex digest the database stores instead of an opaque token.

    A plain hash is enough because the input is 256 random bits, not a password.
    """
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def csrf_value_for(key: bytes, session_id: uuid.UUID) -> str:
    """Return ``HMAC(key, sid)``, the CSRF value bound to one login session.

    Args:
        key: ``TokenKeys.csrf``.
        session_id: The session the value belongs to.

    Returns:
        A URL-safe base64 string without padding.
    """
    mac = hmac.new(key, session_id.bytes, hashlib.sha256).digest()
    return _b64encode(mac)


def sign_payload(key: bytes, payload: str) -> str:
    """Return ``<base64url payload>.<base64url HMAC>`` for a value a cookie carries.

    The payload is signed, not encrypted: anyone holding the value can read it.

    Args:
        key: ``TokenKeys.oidc_flow`` or another purpose key.
        payload: The text to sign.
    """
    body = _b64encode(payload.encode("utf-8"))
    mac = hmac.new(key, body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64encode(mac)}"


def verify_payload(key: bytes, signed: str) -> str | None:
    """Return the payload of a ``sign_payload`` value, or ``None`` when it does not verify.

    Args:
        key: The key it was signed with.
        signed: The value from the cookie.
    """
    body, separator, mac = signed.partition(".")
    if not separator:
        return None
    expected = _b64encode(hmac.new(key, body.encode("utf-8"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected.encode("utf-8"), mac.encode("utf-8")):
        return None
    try:
        return _b64decode(body).decode("utf-8")
    except (binascii.Error, ValueError):
        return None


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
