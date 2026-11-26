"""Integration tests for Google sign-in (task 4.3, spec ``account-login``).

The app runs its real ``GoogleOidcClient``; ``FakeGoogle`` stands in for Google at the
network boundary only (design D5). Covers the four Google requirements: starting the
flow, signing in or linking an existing account only, the one rejection, and the
quiet ``400`` when the flow does not verify.
"""

import secrets
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.cookies import OIDC_FLOW_COOKIE
from app.main import create_app
from app.modules.account.repository import UserRepository
from tests.conftest import make_test_settings
from tests.factories.accounts import PLAIN, add_user, reload_user
from tests.support.browser import SESSION_COOKIES, Browser, cleared, set_cookies
from tests.support.google_oidc import CLIENT_ID, REDIRECT_URI, FakeGoogle

pytestmark = pytest.mark.integration

AUTHORIZE = "/api/v1/google-authorization"
COMPLETE = "/api/v1/google-sessions"
REJECTED = "無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。"


@pytest.fixture
async def google_client(
    tmp_path: Path, migrated_engine: AsyncEngine
) -> AsyncIterator[httpx.AsyncClient]:
    settings = make_test_settings(tmp_path).model_copy(
        update={
            "google_client_id": CLIENT_ID,
            "google_client_secret": SecretStr(secrets.token_urlsafe(24)),
            "google_redirect_uri": REDIRECT_URI,
        }
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


@pytest.fixture
def google(monkeypatch: pytest.MonkeyPatch) -> FakeGoogle:
    fake = FakeGoogle()
    fake.install(monkeypatch)
    return fake


async def _complete(browser: Browser, google: FakeGoogle, **override: str) -> httpx.Response:
    started = await browser.request("GET", AUTHORIZE)
    assert started.status_code == 200
    query = google.remember(started.json()["data"]["authorizationUrl"])
    body = {"code": "4/test-code", "state": query["state"], **override}
    return await browser.request("POST", COMPLETE, json=body)


async def _count(db: AsyncSession) -> int:
    return await UserRepository(db).count()


async def test_starting_returns_only_the_url_and_sets_the_flow_cookie(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    response = await google_client.get(AUTHORIZE)

    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data) == {"authorizationUrl"}
    query = google.remember(data["authorizationUrl"])
    assert data["authorizationUrl"].startswith("https://accounts.google.com/")
    assert query["code_challenge_method"] == "S256"
    assert query["client_id"] == CLIENT_ID
    assert query["redirect_uri"] == REDIRECT_URI
    assert query["state"] and query["nonce"] and query["code_challenge"]
    value, attributes = set_cookies(response)[OIDC_FLOW_COOKIE]
    assert attributes["max-age"] == "600"
    assert "httponly" in attributes and "secure" in attributes
    assert value not in response.text


async def test_without_google_configured_both_endpoints_refuse(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    started = await client.get(AUTHORIZE)
    completed = await client.post(COMPLETE, json={"code": "c", "state": "s"})

    for response in (started, completed):
        assert (response.status_code, response.json()["code"]) == (
            409,
            "ACCOUNT_GOOGLE_UNAVAILABLE",
        )
    assert OIDC_FLOW_COOKIE not in set_cookies(started)


async def test_a_linked_account_signs_in_even_with_another_email(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    await add_user(account_db, email="platform@example.com", google_subject="google-sub-1")
    google.email = "someone-else@gmail.com"
    browser = Browser(google_client)

    response = await _complete(browser, google)

    assert response.status_code == 201
    assert response.headers["Location"] == "/api/v1/current-session"
    assert response.json()["data"]["user"]["email"] == "platform@example.com"
    assert set(SESSION_COOKIES) <= set(set_cookies(response))
    assert OIDC_FLOW_COOKIE in cleared(response)
    assert (await browser.me()).status_code == 200
    (exchange,) = google.exchanges
    assert exchange["code"] == "4/test-code"
    assert exchange["code_verifier"]


async def test_a_verified_email_links_the_account_and_signs_other_devices_out(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    user = await add_user(account_db)
    other_device = Browser(google_client)
    assert (await other_device.sign_in()).status_code == 201
    browser = Browser(google_client)

    response = await _complete(browser, google)

    assert response.status_code == 201
    linked = await reload_user(account_db, user.id)
    assert linked.google_subject == "google-sub-1"
    assert linked.hashed_password is None
    assert linked.credential_version == 1
    assert (await browser.me()).status_code == 200
    assert (await other_device.me()).json()["code"] == "AUTH_REQUIRED"
    assert (await other_device.refresh()).json()["code"] == "ACCOUNT_SESSION_INVALID"
    password = await Browser(google_client).sign_in("user@example.com", PLAIN)
    assert password.json()["code"] == "ACCOUNT_INVALID_CREDENTIALS"


async def test_a_deactivated_account_with_the_same_email_is_not_linked(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    user = await add_user(account_db, is_active=False)

    response = await _complete(Browser(google_client), google)

    assert (response.status_code, response.json()["code"]) == (401, "ACCOUNT_GOOGLE_REJECTED")
    unchanged = await reload_user(account_db, user.id)
    assert unchanged.google_subject is None
    assert unchanged.hashed_password is not None


async def _rejection(
    google_client: httpx.AsyncClient, db: AsyncSession, google: FakeGoogle, case: str
) -> tuple[httpx.Response, int]:
    """Prepare ``case``, complete a sign-in and return the response and the prior count."""
    if case == "no account":
        google.email = "stranger@example.com"
    elif case == "unverified":
        await add_user(db)
        google.email_verified = False
    elif case == "linked but deactivated":
        await add_user(db, google_subject="google-sub-1", is_active=False)
    elif case == "linked but anonymised":
        await add_user(db, google_subject="google-sub-1", anonymized=True)
    elif case == "same email but deactivated":
        await add_user(db, is_active=False)
    before = await _count(db)
    return await _complete(Browser(google_client), google), before


REJECTIONS = [
    "no account",
    "unverified",
    "linked but deactivated",
    "linked but anonymised",
    "same email but deactivated",
]


@pytest.mark.parametrize("case", REJECTIONS)
async def test_every_rejection_is_the_same_401_and_creates_no_account(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle, case: str
) -> None:
    response, before = await _rejection(google_client, account_db, google, case)

    body = response.json()
    assert response.status_code == 401
    assert (body["code"], body["message"]) == ("ACCOUNT_GOOGLE_REJECTED", REJECTED)
    assert body["data"] is None and body["errors"] is None
    assert "@example.com" not in response.text
    assert not set(SESSION_COOKIES) & set(set_cookies(response))
    assert OIDC_FLOW_COOKIE in cleared(response)
    assert await _count(account_db) == before


async def test_an_unverified_email_does_not_link(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    await _rejection(google_client, account_db, google, "unverified")

    user = await UserRepository(account_db).get_by_email("user@example.com")
    assert user is not None
    assert (await reload_user(account_db, user.id)).google_subject is None


async def _assert_flow_invalid(response: httpx.Response) -> None:
    assert (response.status_code, response.json()["code"]) == (400, "ACCOUNT_GOOGLE_FLOW_INVALID")
    assert not set(SESSION_COOKIES) & set(set_cookies(response))
    assert OIDC_FLOW_COOKIE in cleared(response)


async def test_a_state_that_differs_from_the_flow_cookie_is_400(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    await add_user(account_db, google_subject="google-sub-1")

    await _assert_flow_invalid(await _complete(Browser(google_client), google, state="other"))
    assert google.exchanges == []


async def test_a_missing_or_forged_flow_cookie_is_400(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    browser = Browser(google_client)
    started = await browser.request("GET", AUTHORIZE)
    state = google.remember(started.json()["data"]["authorizationUrl"])["state"]
    body = {"code": "4/test-code", "state": state}
    forged = Browser(google_client)
    forged.cookies = {OIDC_FLOW_COOKIE: browser.cookies[OIDC_FLOW_COOKIE] + "x"}

    await _assert_flow_invalid(await Browser(google_client).request("POST", COMPLETE, json=body))
    await _assert_flow_invalid(await forged.request("POST", COMPLETE, json=body))


@pytest.mark.parametrize("failure", ["exchange", "audience", "nonce"])
async def test_an_answer_from_google_that_does_not_verify_is_400(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle, failure: str
) -> None:
    await add_user(account_db, google_subject="google-sub-1")
    browser = Browser(google_client)
    started = await browser.request("GET", AUTHORIZE)
    state = google.remember(started.json()["data"]["authorizationUrl"])["state"]
    if failure == "exchange":
        google.fail_exchange = True
    elif failure == "audience":
        google.audience = "someone-else.apps.googleusercontent.com"
    else:
        google.nonce = "not-the-nonce"

    response = await browser.request("POST", COMPLETE, json={"code": "c", "state": state})

    await _assert_flow_invalid(response)


async def test_the_completion_body_is_validated(
    google_client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await google_client.post(COMPLETE, json={"state": "s", "extra": 1})

    assert (response.status_code, response.json()["code"]) == (422, "VALIDATION_FAILED")
