"""CSRF protection for writes made with the login cookie (login-auth-guard design D3).

Cross-site request forgery borrows the cookies a browser attaches by itself, so the check
applies to a ``POST``, ``PUT``, ``PATCH`` or ``DELETE`` that carries ``__Host-ls_at``:
the ``X-CSRF-Token`` header must equal the ``__Host-ls_csrf`` cookie and both must equal
``HMAC(csrf key, sid)``, where ``sid`` comes from that access token (signature verified,
expiry ignored). A write without the access cookie has no identity to borrow and goes to
routing unchecked; an endpoint that needs a caller refuses it with ``401``.

Four operations are exempt, listed here and nowhere else (system-design T2,
security-agent-rules S2): password sign-in, Google sign-in completion and refresh happen
before a session exists or after its access token expired, accept only JSON and so always
trigger a CORS preflight; sign-out must work even when the session no longer verifies.
Every write endpoint added later is checked by default.
"""

import hmac

from starlette.datastructures import Headers
from starlette.requests import HTTPConnection
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.cookies import SessionCookies
from app.core.envelope import error_response
from app.core.errors import AppError
from app.core.i18n import MessageCatalog
from app.core.tokens import AccessTokenCodec, InvalidAccessTokenError, csrf_value_for

__all__ = ["CSRF_EXEMPT_OPERATIONS", "CSRF_HEADER", "CsrfFailedError", "CsrfMiddleware"]

CSRF_HEADER = "X-CSRF-Token"
"""The request header the frontend copies the CSRF cookie into."""

CSRF_EXEMPT_OPERATIONS: frozenset[tuple[str, str]] = frozenset(
    {
        ("POST", "/api/v1/sessions"),
        ("POST", "/api/v1/session-refreshes"),
        ("POST", "/api/v1/google-sessions"),
        ("DELETE", "/api/v1/current-session"),
    }
)
"""The exact ``(method, path)`` pairs that are never checked (system-design T2)."""

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class CsrfFailedError(AppError):
    """``403``: a write carrying the login cookie failed the CSRF check."""

    status_code = 403
    code = "CSRF_FAILED"
    message_key = "common.csrf_failed"


class CsrfMiddleware:
    """Refuse a cookie-authenticated write whose CSRF value does not match, before routing.

    Mount it just inside ``LocaleMiddleware`` so the ``403`` envelope is localised and
    still passes through the access log, CORS and the correlation ID. Non-HTTP scopes,
    reads, writes without ``__Host-ls_at`` and the four exempt operations pass through
    unchanged.

    Args:
        app: The inner ASGI app.
        codec: Decodes the access cookie to find its ``sid``.
        csrf_key: ``TokenKeys.csrf``.
        catalog: Localises the ``403`` message.
    """

    def __init__(
        self, app: ASGIApp, *, codec: AccessTokenCodec, csrf_key: bytes, catalog: MessageCatalog
    ) -> None:
        self.app = app
        self.codec = codec
        self.csrf_key = csrf_key
        self.catalog = catalog

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI connection."""
        if scope["type"] != "http" or self._passes(scope):
            await self.app(scope, receive, send)
            return
        response = error_response(
            CsrfFailedError.status_code,
            CsrfFailedError.code,
            CsrfFailedError.message_key,
            catalog=self.catalog,
            state=scope.get("state"),
        )
        await response(scope, receive, send)

    def _passes(self, scope: Scope) -> bool:
        method: str = scope["method"]
        if method not in _WRITE_METHODS or (method, scope["path"]) in CSRF_EXEMPT_OPERATIONS:
            return True
        connection = HTTPConnection(scope)
        access = SessionCookies.read_access(connection)
        if access is None:
            return True
        header = Headers(scope=scope).get(CSRF_HEADER)
        cookie = SessionCookies.read_csrf(connection)
        if header is None or cookie is None:
            return False
        try:
            session_id = self.codec.decode_ignoring_expiry(access).session_id
        except InvalidAccessTokenError:
            return False
        expected = csrf_value_for(self.csrf_key, session_id).encode("utf-8")
        # Compare bytes: compare_digest rejects non-ASCII str, and both checks always run.
        header_ok = hmac.compare_digest(header.encode("utf-8"), expected)
        cookie_ok = hmac.compare_digest(cookie.encode("utf-8"), expected)
        return header_ok and cookie_ok
