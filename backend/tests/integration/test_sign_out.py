"""Integration tests for ``DELETE /api/v1/current-session`` and the CSRF exemptions.

Spec ``login-session`` "從這一台登出", spec ``api-envelope`` "登出的 204 沒有 body", spec
``csrf-protection`` "放行清單不需 CSRF 標頭", and spec ``login-session`` "沒有登出別人裝置的
操作" (task 4.2).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_COOKIE
from app.core.tokens import AccessTokenCodec, TokenKeys
from tests.conftest import TEST_AUTH_SECRET
from tests.factories.accounts import add_user, sessions_of
from tests.support.browser import SESSION_COOKIES, Browser, cleared

pytestmark = pytest.mark.integration

KEYS = TokenKeys.derive(SecretStr(TEST_AUTH_SECRET))


async def _signed_in(client: httpx.AsyncClient) -> Browser:
    browser = Browser(client)
    assert (await browser.sign_in()).status_code == 201
    return browser


async def test_signing_out_ends_only_this_device(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    device_a = await _signed_in(client)
    device_b = await _signed_in(client)
    stale = dict(device_a.cookies)

    response = await device_a.sign_out()

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers["X-Correlation-ID"]
    assert cleared(response) == set(SESSION_COOKIES)
    replay = Browser(client)
    replay.cookies = stale
    assert (await replay.me()).json()["code"] == "AUTH_REQUIRED"
    assert (await device_b.me()).status_code == 200
    first, second = await sessions_of(account_db, user.id)
    assert first.logged_out_at is not None and first.logged_out_at == first.revoked_at
    assert second.revoked_at is None


async def test_signing_out_without_cookies_looks_the_same_and_records_nothing(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    signed_in = await _signed_in(client)
    verified = await signed_in.sign_out()
    await _signed_in(client)

    anonymous = await Browser(client).sign_out()

    assert anonymous.status_code == verified.status_code == 204
    assert anonymous.content == b""
    assert cleared(anonymous) == cleared(verified)
    assert _header_names(anonymous) == _header_names(verified)
    rows = await sessions_of(account_db, user.id)
    assert [row.logged_out_at is not None for row in rows] == [True, False]


def _header_names(response: httpx.Response) -> list[str]:
    return sorted({name.lower() for name in response.headers})


async def test_the_exempt_writes_need_no_csrf_header_even_with_an_expired_access_cookie(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)
    claims = AccessTokenCodec(KEYS.access).decode(
        browser.cookies[ACCESS_COOKIE], now=datetime.now(UTC)
    )
    browser.cookies[ACCESS_COOKIE] = AccessTokenCodec(KEYS.access).issue(
        user_id=claims.user_id,
        session_id=claims.session_id,
        credential_version=claims.credential_version,
        role=claims.role,
        issued_at=claims.issued_at - timedelta(minutes=30),
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )

    refreshed = await browser.refresh()
    browser.cookies[ACCESS_COOKIE] = "expired-or-garbage"
    signed_out = await browser.sign_out()

    assert refreshed.status_code == 201
    assert signed_out.status_code == 204


def _schema_fields(document: dict[str, Any], ref: str) -> set[str]:
    schema = document["components"]["schemas"][ref.rsplit("/", 1)[-1]]
    return set(schema.get("properties", {}))


def test_no_operation_ends_or_lists_someone_elses_sessions(app: FastAPI) -> None:
    document = app.openapi()

    for path, item in document["paths"].items():
        if "session" not in path:
            continue
        assert "{" not in path, path
        for operation in item.values():
            assert not operation.get("parameters"), path
            content = operation.get("requestBody", {}).get("content", {})
            for media in content.values():
                fields = _schema_fields(document, media["schema"]["$ref"])
                assert not {"id", "sid", "sessionId", "userId"} & fields, path
