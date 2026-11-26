"""Unit tests for ``CsrfMiddleware`` around a recording ASGI app (task 3.3, design D3).

A write request (``POST``, ``PUT``, ``PATCH``, ``DELETE``) that carries ``__Host-ls_at``
must send ``X-CSRF-Token`` equal to ``__Host-ls_csrf`` and to the HMAC of the session in
that access token (expiry ignored). Without the access cookie the request goes straight
to the app. Four login-related operations are exempt, hard-coded in the middleware. The
assembled app is covered by ``tests/integration/test_csrf.py``.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from starlette.types import Receive, Scope, Send

from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.core.csrf import CSRF_EXEMPT_OPERATIONS, CSRF_HEADER, CsrfFailedError, CsrfMiddleware
from app.core.errors import AppError
from app.core.i18n import MessageCatalog
from app.core.tokens import AccessTokenCodec, TokenKeys, csrf_value_for

SESSION_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")


class RecordingApp:
    """The inner ASGI app: answers ``204`` and records every request it sees."""

    def __init__(self) -> None:
        self.seen: list[tuple[str, str]] = []

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            self.seen.append((scope["method"], scope["path"]))
            await send({"type": "http.response.start", "status": 204, "headers": []})
            await send({"type": "http.response.body", "body": b""})


class Harness:
    """A ``CsrfMiddleware`` over a ``RecordingApp`` plus the keys to forge requests."""

    def __init__(self) -> None:
        self.keys = TokenKeys.derive(SecretStr(secrets.token_urlsafe(48)))
        self.codec = AccessTokenCodec(self.keys.access)
        self.inner = RecordingApp()
        self.app = CsrfMiddleware(
            self.inner, codec=self.codec, csrf_key=self.keys.csrf, catalog=MessageCatalog.load()
        )

    def access(self, *, session_id: uuid.UUID = SESSION_ID, expired: bool = False) -> str:
        now = datetime.now(UTC)
        expires_at = now - timedelta(minutes=1) if expired else now + timedelta(minutes=15)
        return self.codec.issue(
            user_id=uuid.uuid4(),
            session_id=session_id,
            credential_version=0,
            role="user",
            issued_at=now - timedelta(minutes=20),
            expires_at=expires_at,
        )

    def csrf(self, session_id: uuid.UUID = SESSION_ID) -> str:
        return csrf_value_for(self.keys.csrf, session_id)

    async def send(
        self,
        method: str,
        path: str = "/api/v1/things",
        *,
        cookies: dict[str, str] | None = None,
        header: str | bytes | None = None,
    ) -> httpx.Response:
        headers: dict[str, str | bytes] = {}
        if cookies:
            headers["Cookie"] = "; ".join(f"{name}={value}" for name, value in cookies.items())
        if header is not None:
            headers[CSRF_HEADER] = header
        transport = httpx.ASGITransport(app=self.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path, headers=headers)

    def signed_in(self, **kwargs: Any) -> dict[str, str]:
        return {ACCESS_COOKIE: self.access(**kwargs), CSRF_COOKIE: self.csrf()}


def _assert_rejected(response: httpx.Response, harness: Harness) -> None:
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "CSRF_FAILED"
    assert body["data"] is None
    assert body["errors"] is None
    assert harness.inner.seen == []


def test_csrf_failed_error_maps_to_403() -> None:
    error = CsrfFailedError()

    assert isinstance(error, AppError)
    assert (error.status_code, error.code, error.message_key) == (
        403,
        "CSRF_FAILED",
        "common.csrf_failed",
    )


def test_the_header_name_and_the_exempt_list_are_fixed() -> None:
    assert CSRF_HEADER == "X-CSRF-Token"
    assert frozenset(CSRF_EXEMPT_OPERATIONS) == {
        ("POST", "/api/v1/sessions"),
        ("POST", "/api/v1/session-refreshes"),
        ("POST", "/api/v1/google-sessions"),
        ("DELETE", "/api/v1/current-session"),
    }


@pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS"])
async def test_reads_are_not_checked(method: str) -> None:
    harness = Harness()

    response = await harness.send(method, cookies={ACCESS_COOKIE: harness.access()})

    assert response.status_code == 204


@pytest.mark.parametrize("method", WRITE_METHODS)
async def test_a_write_without_the_access_cookie_is_not_checked(method: str) -> None:
    harness = Harness()

    response = await harness.send(method, cookies={CSRF_COOKIE: "anything"})

    assert response.status_code == 204


@pytest.mark.parametrize("method", WRITE_METHODS)
async def test_a_write_with_a_matching_token_reaches_the_app(method: str) -> None:
    harness = Harness()

    response = await harness.send(method, cookies=harness.signed_in(), header=harness.csrf())

    assert response.status_code == 204
    assert harness.inner.seen == [(method, "/api/v1/things")]


@pytest.mark.parametrize("method", WRITE_METHODS)
async def test_a_write_without_the_header_is_rejected(method: str) -> None:
    harness = Harness()

    _assert_rejected(await harness.send(method, cookies=harness.signed_in()), harness)


async def test_a_header_without_the_csrf_cookie_is_rejected() -> None:
    harness = Harness()

    response = await harness.send(
        "POST", cookies={ACCESS_COOKIE: harness.access()}, header=harness.csrf()
    )

    _assert_rejected(response, harness)


async def test_a_header_that_differs_from_the_cookie_is_rejected() -> None:
    harness = Harness()

    response = await harness.send(
        "POST", cookies=harness.signed_in(), header=harness.csrf(uuid.uuid4())
    )

    _assert_rejected(response, harness)


async def test_a_matching_pair_from_another_session_is_rejected() -> None:
    harness = Harness()
    foreign = harness.csrf(uuid.uuid4())

    response = await harness.send(
        "POST", cookies={ACCESS_COOKIE: harness.access(), CSRF_COOKIE: foreign}, header=foreign
    )

    _assert_rejected(response, harness)


async def test_a_pair_signed_with_another_key_is_rejected() -> None:
    harness = Harness()
    forged = Harness().csrf()

    response = await harness.send(
        "POST", cookies={ACCESS_COOKIE: harness.access(), CSRF_COOKIE: forged}, header=forged
    )

    _assert_rejected(response, harness)


@pytest.mark.parametrize("access", ["", "not-a-jwt"])
async def test_an_unreadable_access_cookie_is_rejected(access: str) -> None:
    harness = Harness()

    response = await harness.send(
        "POST", cookies={ACCESS_COOKIE: access, CSRF_COOKIE: harness.csrf()}, header=harness.csrf()
    )

    _assert_rejected(response, harness)


async def test_an_access_cookie_from_another_secret_is_rejected() -> None:
    harness = Harness()
    other = Harness()

    response = await harness.send(
        "POST",
        cookies={ACCESS_COOKIE: other.access(), CSRF_COOKIE: harness.csrf()},
        header=harness.csrf(),
    )

    _assert_rejected(response, harness)


async def test_a_non_ascii_header_is_rejected_not_an_error() -> None:
    harness = Harness()

    response = await harness.send("POST", cookies=harness.signed_in(), header="café".encode())

    _assert_rejected(response, harness)


async def test_an_expired_access_token_still_binds_the_session() -> None:
    harness = Harness()

    response = await harness.send(
        "POST", cookies=harness.signed_in(expired=True), header=harness.csrf()
    )

    assert response.status_code == 204


@pytest.mark.parametrize(("method", "path"), sorted(CSRF_EXEMPT_OPERATIONS))
async def test_the_exempt_operations_pass_without_the_header(method: str, path: str) -> None:
    harness = Harness()

    response = await harness.send(method, path, cookies=harness.signed_in())

    assert response.status_code == 204


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("DELETE", "/api/v1/sessions"),
        ("PUT", "/api/v1/session-refreshes"),
        ("POST", "/api/v1/current-session"),
        ("POST", "/api/v1/sessions/"),
        ("POST", "/api/v1/sessions/extra"),
        ("POST", "/api/v2/sessions"),
    ],
)
async def test_only_the_exact_exempt_pairs_are_exempt(method: str, path: str) -> None:
    harness = Harness()

    _assert_rejected(await harness.send(method, path, cookies=harness.signed_in()), harness)


async def test_the_rejection_message_is_localised_from_the_scope_state() -> None:
    harness = Harness()

    async def with_locale(scope: Scope, receive: Receive, send: Send) -> None:
        scope.setdefault("state", {})["locale"] = "en"
        await harness.app(scope, receive, send)

    transport = httpx.ASGITransport(app=with_locale)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/things", headers={"Cookie": f"{ACCESS_COOKIE}={harness.access()}"}
        )

    assert response.status_code == 403
    assert response.json()["message"] == (
        "This request could not be verified. Please reload the page and try again."
    )
    assert response.headers["Content-Language"] == "en"


async def test_non_http_scopes_pass_through() -> None:
    harness = Harness()
    seen: list[str] = []

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        seen.append(scope["type"])

    app = CsrfMiddleware(
        inner, codec=harness.codec, csrf_key=harness.keys.csrf, catalog=MessageCatalog.load()
    )

    async def receive() -> dict[str, Any]:
        return {"type": "lifespan.startup"}

    async def send(message: Any) -> None:
        return None

    await app({"type": "lifespan"}, receive, send)

    assert seen == ["lifespan"]
