"""Integration tests for ``POST /api/v1/sessions`` (task 4.2, spec ``account-login``).

Email-and-password sign-in through the real app on the test database: the success
response and its cookies (spec ``login-session``), the one shared failure, request
validation, the ``ACCOUNT_`` prefix (spec ``api-envelope``) and the CSRF exemption of
sign-in (spec ``csrf-protection``).
"""

import json

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE
from tests.factories.accounts import PLAIN, add_user, sessions_of
from tests.support.browser import SESSION_COOKIES, Browser, set_cookies

pytestmark = pytest.mark.integration

SESSIONS = "/api/v1/sessions"
ERROR_KEYS = {"success", "code", "message", "data", "timestamp", "traceId", "errors"}
INVALID = "帳號或密碼錯誤，請再試一次"


async def _post(client: httpx.AsyncClient, body: object, **kwargs: object) -> httpx.Response:
    return await client.post(SESSIONS, json=body, **kwargs)  # type: ignore[arg-type]


# --- success -----------------------------------------------------------------------------


async def test_sign_in_returns_201_with_the_four_user_fields(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)

    response = await _post(client, {"email": "user@example.com", "password": PLAIN})

    assert response.status_code == 201
    assert response.headers["Location"] == "/api/v1/current-session"
    body = response.json()
    assert body["success"] is True
    assert body["data"] == {
        "user": {"id": str(user.id), "name": "王小明", "email": "user@example.com", "role": "user"}
    }
    assert len(await sessions_of(account_db, user.id)) == 1


async def test_sign_in_sets_the_three_cookies_and_keeps_them_out_of_the_body(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)

    response = await _post(client, {"email": "user@example.com", "password": PLAIN})

    cookies = set_cookies(response)
    assert set(cookies) == set(SESSION_COOKIES)
    for name, (value, attributes) in cookies.items():
        assert "secure" in attributes
        assert attributes["path"] == "/"
        assert attributes["samesite"].lower() == "lax"
        assert "domain" not in attributes
        assert value not in response.text, name
    assert "httponly" in cookies[ACCESS_COOKIE][1]
    assert "httponly" in cookies[REFRESH_COOKIE][1]
    assert "httponly" not in cookies[CSRF_COOKIE][1]


async def test_sign_in_with_upper_case_email(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)

    response = await _post(client, {"email": "  USER@EXAMPLE.COM ", "password": PLAIN})

    assert response.status_code == 201
    assert response.json()["data"]["user"]["email"] == "user@example.com"


async def test_sign_in_does_not_check_password_composition(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db, plain="abcdef")

    response = await _post(client, {"email": "user@example.com", "password": "abcdef"})

    assert response.status_code == 201


async def test_a_signed_in_browser_may_sign_in_again_without_a_csrf_header(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = Browser(client)
    assert (await browser.sign_in()).status_code == 201

    again = await browser.sign_in()

    assert again.status_code == 201


# --- the one failure ---------------------------------------------------------------------


async def _assert_invalid(response: httpx.Response) -> None:
    body = response.json()
    assert response.status_code == 401
    assert set(body) == ERROR_KEYS
    assert body["code"] == "ACCOUNT_INVALID_CREDENTIALS"
    assert body["message"] == INVALID
    assert body["data"] is None
    assert body["errors"] is None
    assert response.headers.get_list("set-cookie") == []


async def test_unknown_email_and_wrong_password_fail_the_same_way(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)

    await _assert_invalid(await _post(client, {"email": "nobody@example.com", "password": PLAIN}))
    await _assert_invalid(await _post(client, {"email": "user@example.com", "password": "nope"}))


@pytest.mark.parametrize(
    "account",
    [
        {"is_active": False},
        {"anonymized": True},
        {"plain": None, "google_subject": "google-sub-1"},
    ],
    ids=["deactivated", "anonymised", "no-local-password"],
)
async def test_accounts_that_may_not_sign_in_fail_the_same_way(
    client: httpx.AsyncClient, account_db: AsyncSession, account: dict[str, object]
) -> None:
    user = await add_user(account_db, **account)  # type: ignore[arg-type]

    response = await _post(client, {"email": "user@example.com", "password": PLAIN})

    await _assert_invalid(response)
    for leaked in ("user@example.com", "王小明", str(user.id)):
        assert leaked not in response.text
    assert await sessions_of(account_db, user.id) == []


async def test_an_email_over_254_characters_after_normalising_is_401_not_422(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    email = "a" * (255 - len("@example.com")) + "@example.com"

    await _assert_invalid(await _post(client, {"email": email, "password": PLAIN}))


async def test_the_failure_is_localised(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await _post(
        client,
        {"email": "nobody@example.com", "password": PLAIN},
        headers={"Accept-Language": "en"},
    )

    assert response.json()["message"] == "Invalid email or password"


# --- validation --------------------------------------------------------------------------


async def test_blank_email_is_422_and_echoes_nothing(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await _post(client, {"email": "   ", "password": "CANARY-pw-1"})

    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "VALIDATION_FAILED"
    assert [error["field"] for error in body["errors"]] == ["email"]
    assert "CANARY-pw-1" not in response.text
    assert response.headers.get_list("set-cookie") == []


async def test_an_undeclared_field_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await _post(client, {"email": "a@example.com", "password": "x", "rememberMe": True})

    assert response.status_code == 422
    assert {"field": "rememberMe", "code": "extra_forbidden"}.items() <= response.json()["errors"][
        0
    ].items()


async def test_a_form_encoded_body_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await client.post(
        SESSIONS,
        content="email=a%40example.com&password=x",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "VALIDATION_FAILED"
    assert any(error["location"] == "body" for error in body["errors"])


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"email": "a" * 321, "password": "x"}, "email"),
        ({"email": "a@example.com", "password": "x" * 1025}, "password"),
        ({"email": "a@example.com", "password": ""}, "password"),
        ({"password": "x"}, "email"),
    ],
)
async def test_length_limits_and_missing_fields_are_422(
    client: httpx.AsyncClient, account_db: AsyncSession, body: dict[str, str], field: str
) -> None:
    response = await client.post(
        SESSIONS, content=json.dumps(body), headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert field in [error["field"] for error in response.json()["errors"]]


async def test_upper_and_lower_password_limits_are_accepted(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db, plain="x" * 1024)

    response = await _post(client, {"email": "user@example.com", "password": "x" * 1024})

    assert response.status_code == 201
