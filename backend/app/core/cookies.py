"""The single place that sets, clears and reads the login cookies (security-agent-rules S2).

Attributes follow ``api-contract.md`` §共用約定: every cookie has the ``__Host-`` prefix,
so it is ``Secure`` with ``Path=/`` and no ``Domain``, and every one is ``SameSite=Lax``.
The access, refresh and flow cookies are ``HttpOnly``; the CSRF cookie is not, because
the frontend copies it into ``X-CSRF-Token`` (double submit, the one exception in S2).
No other file in ``app/`` writes a cookie; a unit test checks that.

``Secure`` cookies are only stored over HTTPS or on ``localhost`` (system-design T9).
"""

from datetime import datetime
from typing import Literal

from starlette.requests import HTTPConnection
from starlette.responses import Response

__all__ = [
    "ACCESS_COOKIE",
    "CSRF_COOKIE",
    "OIDC_FLOW_COOKIE",
    "OIDC_FLOW_MAX_AGE",
    "REFRESH_COOKIE",
    "SessionCookies",
]

ACCESS_COOKIE = "__Host-ls_at"
"""Carries the access JWT."""
REFRESH_COOKIE = "__Host-ls_rt"
"""Carries the opaque refresh token; the database stores only its hash."""
CSRF_COOKIE = "__Host-ls_csrf"
"""Carries ``HMAC(csrf key, sid)``; readable by scripts by design."""
OIDC_FLOW_COOKIE = "__Host-ls_oidc"
"""Carries the signed Google sign-in flow state (``state``, ``nonce``, PKCE verifier)."""
OIDC_FLOW_MAX_AGE = 600
"""The Google flow cookie lives ten minutes."""

_SAME_SITE: Literal["lax"] = "lax"
_SESSION_COOKIES = ((ACCESS_COOKIE, True), (REFRESH_COOKIE, True), (CSRF_COOKIE, False))
"""Each session cookie with whether it is ``HttpOnly``."""


def _set(response: Response, name: str, value: str, *, max_age: int, http_only: bool) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path="/",
        secure=True,
        httponly=http_only,
        samesite=_SAME_SITE,
    )


def _expire(response: Response, name: str, *, http_only: bool) -> None:
    # Browsers only accept the deletion of a __Host- cookie with the same attributes.
    response.delete_cookie(name, path="/", secure=True, httponly=http_only, samesite=_SAME_SITE)


class SessionCookies:
    """Set, clear and read the four login cookies. All methods are static."""

    @staticmethod
    def set_session(
        response: Response,
        *,
        access_value: str,
        refresh_value: str,
        csrf_value: str,
        expires_at: datetime,
        now: datetime,
    ) -> None:
        """Set the access, refresh and CSRF cookies on ``response``.

        All three live until ``expires_at``, the refresh token's expiry, so the CSRF
        check can still read the session from an access token whose own ``exp`` has
        passed (``api-contract.md`` §共用約定).

        Args:
            response: The response to add the ``Set-Cookie`` headers to.
            access_value: The access JWT.
            refresh_value: The raw refresh token.
            csrf_value: The CSRF value bound to the session.
            expires_at: When the refresh token expires (timezone-aware).
            now: The current time (timezone-aware); ``Max-Age`` is the whole seconds
                between the two, never below zero.

        Raises:
            ValueError: When ``expires_at`` or ``now`` is naive.
        """
        if expires_at.utcoffset() is None or now.utcoffset() is None:
            raise ValueError("expires_at and now must be timezone-aware")
        max_age = max(0, int((expires_at - now).total_seconds()))
        values = {
            ACCESS_COOKIE: access_value,
            REFRESH_COOKIE: refresh_value,
            CSRF_COOKIE: csrf_value,
        }
        for name, http_only in _SESSION_COOKIES:
            _set(response, name, values[name], max_age=max_age, http_only=http_only)

    @staticmethod
    def set_oidc_flow(response: Response, value: str) -> None:
        """Set the ``HttpOnly`` Google flow cookie for ten minutes."""
        _set(response, OIDC_FLOW_COOKIE, value, max_age=OIDC_FLOW_MAX_AGE, http_only=True)

    @staticmethod
    def clear(response: Response) -> None:
        """Expire the access, refresh and CSRF cookies (``Max-Age=0``)."""
        for name, http_only in _SESSION_COOKIES:
            _expire(response, name, http_only=http_only)

    @staticmethod
    def clear_oidc_flow(response: Response) -> None:
        """Expire the Google flow cookie (``Max-Age=0``)."""
        _expire(response, OIDC_FLOW_COOKIE, http_only=True)

    @staticmethod
    def read_access(connection: HTTPConnection) -> str | None:
        """Return the access cookie, or ``None`` when absent; nothing else is consulted."""
        return connection.cookies.get(ACCESS_COOKIE)

    @staticmethod
    def read_refresh(connection: HTTPConnection) -> str | None:
        """Return the refresh cookie, or ``None`` when absent."""
        return connection.cookies.get(REFRESH_COOKIE)

    @staticmethod
    def read_csrf(connection: HTTPConnection) -> str | None:
        """Return the CSRF cookie, or ``None`` when absent."""
        return connection.cookies.get(CSRF_COOKIE)

    @staticmethod
    def read_oidc_flow(connection: HTTPConnection) -> str | None:
        """Return the Google flow cookie, or ``None`` when absent."""
        return connection.cookies.get(OIDC_FLOW_COOKIE)
