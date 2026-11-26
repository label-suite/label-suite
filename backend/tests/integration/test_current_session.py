"""Integration tests for ``GET /api/v1/current-session`` (task 4.2, spec ``auth-guard``).

Steps 1 and 2 of authorization on the real app: the identity comes only from the
access cookie, every refusal is the same ``401 AUTH_REQUIRED``, and the account state
and role are read from the database on every request. Also the general codes of spec
``api-envelope`` and ``csrf-protection`` "讀取請求不驗 CSRF".
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_COOKIE
from app.core.tokens import AccessTokenCodec, TokenKeys
from app.modules.account.models import AccountSession, User
from tests.conftest import TEST_AUTH_SECRET
from tests.factories.accounts import PLAIN, add_user, sessions_of
from tests.support.browser import Browser

pytestmark = pytest.mark.integration

ME = "/api/v1/current-session"
KEYS = TokenKeys.derive(SecretStr(TEST_AUTH_SECRET))
HIDDEN_KEYS = ("hashedPassword", "googleSubject", "credentialVersion", "isSeeder", "isActive")


async def _signed_in(client: httpx.AsyncClient, email: str = "user@example.com") -> Browser:
    browser = Browser(client)
    assert (await browser.sign_in(email)).status_code == 201
    return browser


async def _set_user(db: AsyncSession, user: User, **values: Any) -> None:
    await db.execute(update(User).where(User.id == user.id).values(**values))
    await db.commit()


async def _assert_refused(response: httpx.Response) -> dict[str, Any]:
    body: dict[str, Any] = response.json()
    assert response.status_code == 401
    assert body["code"] == "AUTH_REQUIRED"
    assert body["data"] is None
    assert body["errors"] is None
    return body


async def test_a_member_reads_exactly_their_own_four_fields(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)

    response = await browser.me()

    assert response.status_code == 200
    assert response.json()["data"] == {
        "user": {"id": str(user.id), "name": "王小明", "email": "user@example.com", "role": "user"}
    }
    session_id = str((await sessions_of(account_db, user.id))[0].id)
    for hidden in (*HIDDEN_KEYS, session_id):
        assert hidden not in response.text


async def test_reads_need_no_csrf_header(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)

    response = await browser.request("GET", ME, csrf=False)

    assert response.status_code == 200


async def test_only_the_cookie_counts_not_the_authorization_header(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)
    access = browser.cookies[ACCESS_COOKIE]

    response = await client.get(ME, headers={"Authorization": f"Bearer {access}"})

    await _assert_refused(response)


async def test_every_unusable_session_gets_the_same_refusal(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    other = await add_user(account_db, email="other@example.com", name="李小華")
    signed_out = await _signed_in(client)
    stale = dict(signed_out.cookies)
    assert (await signed_out.sign_out()).status_code == 204
    others = await _signed_in(client, "other@example.com")
    await account_db.execute(
        update(AccountSession)
        .where(AccountSession.user_id == other.id)
        .values(revoked_at=datetime.now(UTC))
    )
    await account_db.commit()
    tampered = stale[ACCESS_COOKIE][:-4] + (
        "AAAA" if not stale[ACCESS_COOKIE].endswith("AAAA") else "BBBB"
    )

    responses = [
        await client.get(ME),
        await client.get(ME, headers={"Cookie": f"{ACCESS_COOKIE}={tampered}"}),
        await client.get(ME, headers={"Cookie": f"{ACCESS_COOKIE}={stale[ACCESS_COOKIE]}"}),
        await others.me(),
    ]

    bodies = [await _assert_refused(response) for response in responses]
    assert len({body["message"] for body in bodies}) == 1
    for response in responses:
        for leaked in ("@example.com", "王小明", "李小華", str(other.id)):
            assert leaked not in response.text


async def test_a_role_change_applies_on_the_next_request(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db, role="super_admin")
    browser = await _signed_in(client)
    await _set_user(account_db, user, role="user")

    response = await browser.me()

    assert response.status_code == 200
    assert response.json()["data"]["user"]["role"] == "user"


async def test_deactivation_refuses_every_device_and_sign_in(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    device_a = await _signed_in(client)
    device_b = await _signed_in(client)
    await _set_user(account_db, user, is_active=False)

    await _assert_refused(await device_a.me())
    await _assert_refused(await device_b.me())
    again = await Browser(client).sign_in()
    assert (again.status_code, again.json()["code"]) == (401, "ACCOUNT_INVALID_CREDENTIALS")


async def test_reactivation_does_not_revive_the_old_session(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await _set_user(account_db, user, credential_version=1, is_active=False)
    await account_db.execute(
        update(AccountSession)
        .where(AccountSession.user_id == user.id)
        .values(revoked_at=datetime.now(UTC))
    )
    await account_db.commit()
    await _set_user(account_db, user, is_active=True)

    await _assert_refused(await browser.me())
    assert (await Browser(client).sign_in()).status_code == 201


async def test_an_access_token_for_an_unknown_session_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    now = datetime.now(UTC)
    forged = AccessTokenCodec(KEYS.access).issue(
        user_id=user.id,
        session_id=uuid.uuid4(),
        credential_version=0,
        role="super_admin",
        issued_at=now,
        expires_at=now + timedelta(minutes=5),
    )

    await _assert_refused(await client.get(ME, headers={"Cookie": f"{ACCESS_COOKIE}={forged}"}))


async def test_an_access_token_signed_with_another_secret_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)
    claims = AccessTokenCodec(KEYS.access).decode(
        browser.cookies[ACCESS_COOKIE], now=datetime.now(UTC)
    )
    other_keys = TokenKeys.derive(SecretStr(secrets.token_urlsafe(48)))
    forged = AccessTokenCodec(other_keys.access).issue(
        user_id=claims.user_id,
        session_id=claims.session_id,
        credential_version=claims.credential_version,
        role=claims.role,
        issued_at=claims.issued_at,
        expires_at=claims.expires_at,
    )

    await _assert_refused(await client.get(ME, headers={"Cookie": f"{ACCESS_COOKIE}={forged}"}))


async def test_the_general_auth_and_csrf_codes_carry_no_prefix(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)

    unauthenticated = await client.get(ME)
    forged_write = await browser.request("POST", "/api/v1/health", csrf=False)

    assert (unauthenticated.status_code, unauthenticated.json()["code"]) == (401, "AUTH_REQUIRED")
    assert (forged_write.status_code, forged_write.json()["code"]) == (403, "CSRF_FAILED")


async def test_the_module_code_carries_the_account_prefix(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await Browser(client).sign_in("nobody@example.com", PLAIN)

    assert response.json()["code"].startswith("ACCOUNT_")
