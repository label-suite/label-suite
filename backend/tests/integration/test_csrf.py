"""Integration tests for CSRF protection on the assembled app (task 3.3, design D3).

Spec ``csrf-protection``: the scenarios that need no account endpoint, sent to the
existing ``/api/v1/health`` through the production middleware stack. The access token
is issued with the same ``AUTH_SECRET`` the harness gives ``create_app``, so the real
``CsrfMiddleware`` decodes it. The scenarios that need the login endpoints are in group 4.
"""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from pydantic import SecretStr

from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.core.csrf import CSRF_HEADER
from app.core.tokens import AccessTokenCodec, TokenKeys, csrf_value_for
from tests.conftest import ALLOWED_ORIGIN, TEST_AUTH_SECRET

pytestmark = pytest.mark.integration

HEALTH_PATH = "/api/v1/health"
KEYS = TokenKeys.derive(SecretStr(TEST_AUTH_SECRET))


def _access(session_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    return AccessTokenCodec(KEYS.access).issue(
        user_id=uuid.uuid4(),
        session_id=session_id,
        credential_version=0,
        role="user",
        issued_at=now,
        expires_at=now + timedelta(minutes=15),
    )


def _cookie_header(**cookies: str) -> str:
    return "; ".join(f"{name}={value}" for name, value in cookies.items())


def _signed_in(session_id: uuid.UUID, csrf_cookie: str) -> dict[str, str]:
    return {
        "Cookie": _cookie_header(**{ACCESS_COOKIE: _access(session_id), CSRF_COOKIE: csrf_cookie})
    }


def _assert_error(response: httpx.Response, status: int, code: str) -> None:
    body = response.json()
    assert response.status_code == status
    assert body["success"] is False
    assert body["code"] == code
    assert body["data"] is None
    assert body["errors"] is None


async def test_a_signed_in_write_without_the_csrf_header_is_blocked(
    client: httpx.AsyncClient,
) -> None:
    session_id = uuid.uuid4()

    response = await client.post(
        HEALTH_PATH, headers=_signed_in(session_id, csrf_value_for(KEYS.csrf, session_id))
    )

    _assert_error(response, 403, "CSRF_FAILED")
    assert response.json()["message"] == "無法確認這個請求，請重新整理頁面後再試"


async def test_a_csrf_value_from_another_session_is_blocked(client: httpx.AsyncClient) -> None:
    foreign = csrf_value_for(KEYS.csrf, uuid.uuid4())
    headers = _signed_in(uuid.uuid4(), foreign)
    headers[CSRF_HEADER] = foreign

    response = await client.post(HEALTH_PATH, headers=headers)

    _assert_error(response, 403, "CSRF_FAILED")


async def test_a_matching_csrf_write_reaches_routing(client: httpx.AsyncClient) -> None:
    session_id = uuid.uuid4()
    value = csrf_value_for(KEYS.csrf, session_id)
    headers = _signed_in(session_id, value)
    headers[CSRF_HEADER] = value

    response = await client.post(HEALTH_PATH, headers=headers)

    _assert_error(response, 405, "METHOD_NOT_ALLOWED")


async def test_a_write_without_any_cookie_reaches_routing(client: httpx.AsyncClient) -> None:
    response = await client.post(HEALTH_PATH)

    _assert_error(response, 405, "METHOD_NOT_ALLOWED")


async def test_the_csrf_rejection_is_localised(client: httpx.AsyncClient) -> None:
    session_id = uuid.uuid4()
    headers = _signed_in(session_id, csrf_value_for(KEYS.csrf, session_id))
    headers["Accept-Language"] = "en"

    response = await client.post(HEALTH_PATH, headers=headers)

    assert response.status_code == 403
    assert response.headers["Content-Language"] == "en"
    assert response.json()["message"] == (
        "This request could not be verified. Please reload the page and try again."
    )


async def test_the_csrf_rejection_carries_the_correlation_id_and_cors_headers(
    client: httpx.AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    headers = _signed_in(session_id, csrf_value_for(KEYS.csrf, session_id))
    headers["Origin"] = ALLOWED_ORIGIN

    response = await client.post(HEALTH_PATH, headers=headers)

    assert response.status_code == 403
    assert response.headers["X-Correlation-ID"] == response.json()["traceId"]
    assert response.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN


def _preflight(origin: str) -> dict[str, str]:
    return {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-csrf-token",
    }


async def test_an_allowed_origin_may_send_the_csrf_header(client: httpx.AsyncClient) -> None:
    response = await client.options("/api/v1/sessions", headers=_preflight(ALLOWED_ORIGIN))

    allowed = {
        h.strip().lower() for h in response.headers["Access-Control-Allow-Headers"].split(",")
    }
    assert response.status_code == 200
    assert "x-csrf-token" in allowed
    assert response.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN


async def test_an_unlisted_origin_gets_no_allow_origin(client: httpx.AsyncClient) -> None:
    response = await client.options("/api/v1/sessions", headers=_preflight("http://evil.example"))

    assert "Access-Control-Allow-Origin" not in response.headers
