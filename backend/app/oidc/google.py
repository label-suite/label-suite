"""Google sign-in over OpenID Connect; the only place that imports ``authlib`` (B12, T7).

``GoogleOidcClient`` builds the authorisation URL (PKCE S256, ``state``, ``nonce``) and
exchanges the code for an ``id_token``, which authlib verifies: signature against
Google's published keys, ``iss``, ``aud``, ``exp`` and ``nonce``. Google's endpoints are
fixed values rather than fetched from the discovery document, so one sign-in makes two
outbound calls (token and keys). Network access goes through authlib's own HTTP client;
this package never imports an HTTP library itself.

Any failure on the way surfaces as ``GoogleOidcError`` with no detail: the caller turns
it into one quiet response, and nothing from Google's answer is logged.
"""

from dataclasses import dataclass
from typing import Any

# authlib ships no type information; everything it returns is treated as Any and
# checked here before it leaves this module.
from authlib.integrations.base_client import BaseApp  # type: ignore[import-untyped]
from authlib.integrations.base_client.async_app import (  # type: ignore[import-untyped]
    AsyncOAuth2Mixin,
)
from authlib.integrations.base_client.async_openid import (  # type: ignore[import-untyped]
    AsyncOpenIDMixin,
)
from authlib.integrations.httpx_client import AsyncOAuth2Client  # type: ignore[import-untyped]

__all__ = ["GoogleIdentity", "GoogleOidcClient", "GoogleOidcError"]

_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_EXCHANGE_URL = "https://oauth2.googleapis.com/token"
_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]
_TIMEOUT_SECONDS = 10.0


class GoogleOidcError(Exception):
    """The Google exchange or the ``id_token`` did not verify; carries no detail."""


@dataclass(frozen=True)
class GoogleIdentity:
    """What a verified ``id_token`` says about the person.

    Attributes:
        subject: Google's stable account ID (``sub``).
        email: The Email Google reports, as Google wrote it.
        email_verified: Whether Google says the Email is verified.
    """

    subject: str
    email: str
    email_verified: bool


class _GoogleApp(AsyncOAuth2Mixin, AsyncOpenIDMixin, BaseApp):  # type: ignore[misc]
    """authlib's framework-neutral OAuth 2 and OpenID client, without a session store."""

    client_cls = AsyncOAuth2Client


class GoogleOidcClient:
    """Talks to Google for one deployment's client registration.

    Args:
        client_id: ``GOOGLE_CLIENT_ID``.
        client_secret: ``GOOGLE_CLIENT_SECRET``.
        redirect_uri: ``GOOGLE_REDIRECT_URI``, the frontend callback route.
    """

    def __init__(self, *, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self._client_id = client_id
        self._redirect_uri = redirect_uri
        metadata: dict[str, Any] = {
            "authorization_endpoint": _AUTHORIZATION_URL,
            "token_endpoint": _EXCHANGE_URL,
            "jwks_uri": _KEYS_URL,
            "issuer": _ISSUERS[0],
            "id_token_signing_alg_values_supported": ["RS256"],
        }
        self._app = _GoogleApp(
            None,
            name="google",
            client_id=client_id,
            client_secret=client_secret,
            client_kwargs={
                "scope": "openid email",
                "code_challenge_method": "S256",
                "timeout": _TIMEOUT_SECONDS,
            },
            **metadata,
        )

    async def authorization_url(self, *, state: str, nonce: str, code_verifier: str) -> str:
        """Return Google's authorisation URL carrying ``state``, ``nonce`` and the challenge.

        Makes no network call.
        """
        created = await self._app.create_authorization_url(
            self._redirect_uri, state=state, nonce=nonce, code_verifier=code_verifier
        )
        url: str = created["url"]
        return url

    async def exchange(self, *, code: str, code_verifier: str, nonce: str) -> GoogleIdentity:
        """Exchange ``code`` and verify the ``id_token`` Google returns.

        Side effects:
            Two HTTPS requests to Google: the token endpoint and its signing keys.

        Raises:
            GoogleOidcError: The exchange failed or timed out, or the ``id_token`` is
                missing or fails any check (signature, ``iss``, ``aud``, ``exp``,
                ``nonce``), or lacks ``sub`` or ``email``. The original exception is
                not chained, so nothing from Google reaches a log.
        """
        try:
            answer = await self._app.fetch_access_token(
                self._redirect_uri, code=code, code_verifier=code_verifier
            )
            # authlib accepts any aud when azp names this client, so aud is pinned here.
            claims = await self._app.parse_id_token(
                answer,
                nonce=nonce,
                claims_options={
                    "iss": {"values": _ISSUERS},
                    "aud": {"essential": True, "value": self._client_id},
                },
            )
        except Exception:
            raise GoogleOidcError from None
        return _identity(claims)


def _identity(claims: Any) -> GoogleIdentity:
    if claims is None:
        raise GoogleOidcError
    subject, email = claims.get("sub"), claims.get("email")
    if not isinstance(subject, str) or not subject or not isinstance(email, str) or not email:
        raise GoogleOidcError
    verified = claims.get("email_verified")
    return GoogleIdentity(
        subject=subject,
        email=email,
        email_verified=verified is True or verified == "true",
    )
