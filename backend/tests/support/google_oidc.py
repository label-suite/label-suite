"""A stand-in for Google at the network boundary (task 4.3, design D5, ADR-004 D5).

The app keeps its real ``GoogleOidcClient``; only ``httpx.AsyncClient.send`` is replaced,
and only for Google's token and key endpoints. Every other request (the test client
talking to the app) goes through untouched. The stand-in signs ``id_token`` with its own
RSA key, publishes the public half as the JWKS, and checks the PKCE verifier against the
challenge from the authorisation URL, as Google would.
"""

import base64
import hashlib
import json
import time
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from joserfc import jwt
from joserfc.jwk import KeySet, RSAKey

GOOGLE_EXCHANGE_URL = "https://oauth2.googleapis.com/token"
GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUER = "https://accounts.google.com"
CLIENT_ID = "label-suite-test.apps.googleusercontent.com"
REDIRECT_URI = "http://localhost:5173/account/google/callback"

_Send = Callable[..., Awaitable[httpx.Response]]


class FakeGoogle:
    """Answers the token and key requests of one sign-in at a time.

    Attributes:
        subject: The Google ``sub`` the next ``id_token`` carries.
        email: The Email the next ``id_token`` carries.
        email_verified: The ``email_verified`` claim.
        audience: The ``aud`` claim; the app's client ID unless a test changes it.
        fail_exchange: Answer the token request with ``400 invalid_grant``.
        exchanges: The form bodies of the token requests received.
    """

    def __init__(self) -> None:
        self.key = RSAKey.generate_key(2048, parameters={"kid": "test-key", "alg": "RS256"})
        self.subject = "google-sub-1"
        self.email = "user@example.com"
        self.email_verified: bool = True
        self.audience = CLIENT_ID
        self.fail_exchange = False
        self.exchanges: list[dict[str, str]] = []
        self.challenge: str | None = None
        self.nonce: str | None = None

    def remember(self, authorization_url: str) -> dict[str, str]:
        """Read ``state``, ``nonce`` and the challenge from the URL the app produced."""
        query = {k: v[0] for k, v in parse_qs(urlparse(authorization_url).query).items()}
        self.challenge = query.get("code_challenge")
        self.nonce = query.get("nonce")
        return query

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Route Google's two endpoints to this stand-in for the rest of the test."""
        original: _Send = httpx.AsyncClient.send

        async def send(client: httpx.AsyncClient, request: httpx.Request, **kwargs: Any) -> Any:
            url = str(request.url).split("?", 1)[0]
            if url == GOOGLE_EXCHANGE_URL:
                return self._exchange(request)
            if url == GOOGLE_KEYS_URL:
                return httpx.Response(200, json=self._jwks(), request=request)
            return await original(client, request, **kwargs)

        monkeypatch.setattr(httpx.AsyncClient, "send", send)

    def _jwks(self) -> dict[str, Any]:
        return KeySet([self.key]).as_dict(private=False)

    def _exchange(self, request: httpx.Request) -> httpx.Response:
        form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        self.exchanges.append(form)
        verifier = form.get("code_verifier", "")
        digest = hashlib.sha256(verifier.encode()).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        if self.fail_exchange or challenge != self.challenge:
            return httpx.Response(400, json={"error": "invalid_grant"}, request=request)
        now = int(time.time())
        claims = {
            "iss": GOOGLE_ISSUER,
            "aud": self.audience,
            "sub": self.subject,
            "email": self.email,
            "email_verified": self.email_verified,
            "iat": now,
            "exp": now + 600,
            "nonce": self.nonce,
        }
        signed = jwt.encode({"alg": "RS256", "kid": "test-key"}, claims, self.key)
        body = {
            "access_token": "ya29.test-access",
            "expires_in": 3599,
            "token_type": "Bearer",
            "scope": "openid email",
            "id_token": signed,
        }
        return httpx.Response(
            200,
            content=json.dumps(body).encode(),
            request=request,
            headers={"Content-Type": "application/json"},
        )
