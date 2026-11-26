"""Integration tests for the less common Google sign-in answers (task 4.3, spec ``account-login``).

A flow cookie that is signed but unreadable or expired, an answer from Google without an
``id_token`` or without an Email, an Email over 254 characters once normalised, and the
string form of ``email_verified`` that Google has used. The first four end in the same
quiet ``400`` or ``401`` as the main cases; the last one links like a boolean ``true``.
"""

import json
import time

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import OIDC_FLOW_COOKIE
from app.core.tokens import TokenKeys, sign_payload
from tests.conftest import TEST_AUTH_SECRET
from tests.factories.accounts import add_user, reload_user
from tests.support.browser import SESSION_COOKIES, Browser, cleared, set_cookies
from tests.support.google_oidc import CLIENT_ID, FakeGoogle

pytestmark = pytest.mark.integration

AUTHORIZE = "/api/v1/google-authorization"
COMPLETE = "/api/v1/google-sessions"
FLOW_KEY = TokenKeys.derive(SecretStr(TEST_AUTH_SECRET)).oidc_flow


async def _complete(browser: Browser, google: FakeGoogle) -> httpx.Response:
    started = await browser.request("GET", AUTHORIZE)
    state = google.remember(started.json()["data"]["authorizationUrl"])["state"]
    return await browser.request("POST", COMPLETE, json={"code": "4/c", "state": state})


def _code(response: httpx.Response) -> tuple[int, str]:
    return response.status_code, response.json()["code"]


@pytest.mark.parametrize(
    "payload",
    [
        "not json",
        json.dumps({"state": "s", "nonce": "n"}),
        json.dumps({"state": "s", "nonce": "n", "verifier": "v", "exp": "soon"}),
        json.dumps({"state": "s", "nonce": "n", "verifier": "v", "exp": int(time.time()) - 1}),
    ],
    ids=["not-json", "missing-fields", "bad-expiry", "expired"],
)
async def test_a_signed_flow_cookie_that_cannot_be_used_is_400(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle, payload: str
) -> None:
    browser = Browser(google_client)
    browser.cookies[OIDC_FLOW_COOKIE] = sign_payload(FLOW_KEY, payload)

    response = await browser.request("POST", COMPLETE, json={"code": "4/c", "state": "s"})

    assert _code(response) == (400, "ACCOUNT_GOOGLE_FLOW_INVALID")
    assert OIDC_FLOW_COOKIE in cleared(response)
    assert google.exchanges == []


@pytest.mark.parametrize("missing", ["id_token", "email"])
async def test_an_answer_without_an_identity_is_400(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle, missing: str
) -> None:
    await add_user(account_db, google_subject="google-sub-1")
    google.omit_id_token = missing == "id_token"
    google.omit_email = missing == "email"

    response = await _complete(Browser(google_client), google)

    assert _code(response) == (400, "ACCOUNT_GOOGLE_FLOW_INVALID")
    assert not set(SESSION_COOKIES) & set(set_cookies(response))


async def test_an_email_over_the_limit_after_normalising_is_rejected(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    google.email = "a" * 250 + "@x.org"

    response = await _complete(Browser(google_client), google)

    assert _code(response) == (401, "ACCOUNT_GOOGLE_REJECTED")


async def test_an_account_linked_to_another_google_account_is_not_relinked(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    user = await add_user(account_db, google_subject="google-sub-other")

    response = await _complete(Browser(google_client), google)

    assert _code(response) == (401, "ACCOUNT_GOOGLE_REJECTED")
    assert (await reload_user(account_db, user.id)).google_subject == "google-sub-other"


async def test_email_verified_as_the_string_true_links_the_account(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    user = await add_user(account_db)
    google.email = "USER@example.com"
    google.email_verified = "true"

    response = await _complete(Browser(google_client), google)

    assert response.status_code == 201
    assert (await reload_user(account_db, user.id)).google_subject == "google-sub-1"


async def test_a_token_for_another_audience_is_400_even_when_azp_names_us(
    google_client: httpx.AsyncClient, account_db: AsyncSession, google: FakeGoogle
) -> None:
    await add_user(account_db, google_subject="google-sub-1")
    google.audience = "someone-else.apps.googleusercontent.com"
    google.authorized_party = CLIENT_ID

    response = await _complete(Browser(google_client), google)

    assert _code(response) == (400, "ACCOUNT_GOOGLE_FLOW_INVALID")
    assert not set(SESSION_COOKIES) & set(set_cookies(response))


async def test_completing_without_google_configured_also_clears_the_flow_cookie(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    browser = Browser(client)
    browser.cookies[OIDC_FLOW_COOKIE] = sign_payload(FLOW_KEY, "left over")

    response = await browser.request("POST", COMPLETE, json={"code": "4/c", "state": "s"})

    assert _code(response) == (409, "ACCOUNT_GOOGLE_UNAVAILABLE")
    assert cleared(response) == {OIDC_FLOW_COOKIE}
