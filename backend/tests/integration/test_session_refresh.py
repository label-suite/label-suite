"""Integration tests for ``POST /api/v1/session-refreshes`` (task 4.2, spec ``login-session``).

Time is moved by rewriting ``started_at``, ``last_seen_at`` and ``consumed_at`` in the
test database, so the real clock of the app decides as it would in production.
"""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_COOKIE, REFRESH_COOKIE
from app.modules.account.models import AccountRefreshToken, AccountSession, User
from tests.factories.accounts import add_user, sessions_of, tokens_of
from tests.support.browser import SESSION_COOKIES, Browser, cleared, set_cookies

pytestmark = pytest.mark.integration

REFRESH = "/api/v1/session-refreshes"


async def _signed_in(client: httpx.AsyncClient) -> Browser:
    browser = Browser(client)
    assert (await browser.sign_in()).status_code == 201
    return browser


async def _shift(db: AsyncSession, user: User, *, started: timedelta, idle: timedelta) -> None:
    now = datetime.now(UTC)
    await db.execute(
        update(AccountSession)
        .where(AccountSession.user_id == user.id)
        .values(started_at=now - started, last_seen_at=now - idle)
    )
    await db.commit()


def _code(response: httpx.Response) -> tuple[int, str]:
    return response.status_code, response.json()["code"]


async def test_refresh_rotates_the_token_and_keeps_the_session(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)
    old_refresh = browser.cookies[REFRESH_COOKIE]

    response = await browser.refresh()

    assert response.status_code == 201
    assert response.headers["Location"] == "/api/v1/current-session"
    assert set(response.json()["data"]["user"]) == {"id", "name", "email", "role"}
    assert set(set_cookies(response)) == set(SESSION_COOKIES)
    assert browser.cookies[REFRESH_COOKIE] != old_refresh
    assert (await browser.me()).status_code == 200


async def test_refresh_without_a_refresh_cookie_is_auth_required(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await client.post(REFRESH, json={})

    assert _code(response) == (401, "AUTH_REQUIRED")
    assert response.headers.get_list("set-cookie") == []


async def test_refresh_only_takes_an_empty_object(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    browser = await _signed_in(client)

    response = await browser.request("POST", REFRESH, json={"sid": "x"})

    assert _code(response) == (422, "VALIDATION_FAILED")


async def test_a_deactivated_account_cannot_refresh(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await account_db.execute(update(User).where(User.id == user.id).values(is_active=False))
    await account_db.commit()

    response = await browser.refresh()

    assert _code(response) == (401, "ACCOUNT_SESSION_INVALID")
    assert cleared(response) == set(SESSION_COOKIES)
    (row,) = await sessions_of(account_db, user.id)
    assert len(await tokens_of(account_db, row.id)) == 1


async def test_an_invalid_token_is_refused_twenty_times_without_a_lockout(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    headers = {"Cookie": f"{REFRESH_COOKIE}=no-such-token"}

    codes = {_code(await client.post(REFRESH, json={}, headers=headers)) for _ in range(20)}

    assert codes == {(401, "ACCOUNT_SESSION_INVALID")}


async def test_the_absolute_limit_expires_the_session(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await _shift(account_db, user, started=timedelta(days=90), idle=timedelta(minutes=1))

    response = await browser.refresh()

    assert _code(response) == (401, "ACCOUNT_SESSION_EXPIRED")
    assert cleared(response) == set(SESSION_COOKIES)
    (row,) = await sessions_of(account_db, user.id)
    assert row.revoked_at is not None
    assert row.logged_out_at is None


async def test_seven_days_idle_expires_the_session(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await _shift(account_db, user, started=timedelta(days=8), idle=timedelta(days=7, minutes=1))

    response = await browser.refresh()

    assert _code(response) == (401, "ACCOUNT_SESSION_EXPIRED")
    (row,) = await sessions_of(account_db, user.id)
    assert row.logged_out_at is None


async def test_daily_use_keeps_the_session_alive_on_day_ten(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await _shift(account_db, user, started=timedelta(days=10), idle=timedelta(days=1))

    assert (await browser.refresh()).status_code == 201
    assert (await browser.me()).status_code == 200


async def test_extending_never_passes_the_absolute_limit(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    browser = await _signed_in(client)
    await _shift(account_db, user, started=timedelta(days=89), idle=timedelta(days=1))

    response = await browser.refresh()

    assert response.status_code == 201
    (row,) = await sessions_of(account_db, user.id)
    limit = row.started_at + timedelta(days=90)
    newest = (await tokens_of(account_db, row.id))[-1]
    assert newest.expires_at <= limit
    seconds_left = (limit - datetime.now(UTC)).total_seconds()
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        assert int(set_cookies(response)[name][1]["max-age"]) <= seconds_left + 1


async def test_two_tabs_refreshing_together_share_one_session(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    tab_a = await _signed_in(client)
    other_device = await _signed_in(client)
    tab_b = Browser(client)
    tab_b.cookies = dict(tab_a.cookies)

    first, second = await tab_a.refresh(), await tab_b.refresh()

    assert (first.status_code, second.status_code) == (201, 201)
    assert len(await sessions_of(account_db, user.id)) == 2
    assert (await tab_a.me()).status_code == 200
    assert (await tab_b.me()).status_code == 200
    assert (await other_device.me()).status_code == 200


async def test_a_third_use_within_the_grace_conflicts_without_touching_cookies(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    tab = await _signed_in(client)
    other_device = await _signed_in(client)
    stale = dict(tab.cookies)
    for _ in range(2):
        clone = Browser(client)
        clone.cookies = dict(stale)
        assert (await clone.refresh()).status_code == 201
    third = Browser(client)
    third.cookies = dict(stale)

    response = await third.refresh()

    assert _code(response) == (409, "ACCOUNT_REFRESH_CONFLICT")
    assert response.headers.get_list("set-cookie") == []
    assert all(row.revoked_at is None for row in await sessions_of(account_db, user.id))
    assert (await other_device.me()).status_code == 200


async def test_reuse_outside_the_grace_signs_every_device_out(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    user = await add_user(account_db)
    device_a = await _signed_in(client)
    device_b = await _signed_in(client)
    thief = Browser(client)
    thief.cookies = dict(device_a.cookies)
    assert (await device_a.refresh()).status_code == 201
    await account_db.execute(
        update(AccountRefreshToken)
        .where(AccountRefreshToken.consumed_at.is_not(None))
        .values(consumed_at=datetime.now(UTC) - timedelta(minutes=5))
    )
    await account_db.commit()

    response = await thief.refresh()

    assert _code(response) == (401, "ACCOUNT_SESSION_INVALID")
    for device in (device_a, device_b):
        assert _code(await device.me()) == (401, "AUTH_REQUIRED")
        assert _code(await device.refresh()) == (401, "ACCOUNT_SESSION_INVALID")
    rows = await sessions_of(account_db, user.id)
    assert all(row.revoked_at is not None and row.logged_out_at is None for row in rows)


async def test_a_signed_out_session_has_no_grace(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    await add_user(account_db)
    device_a = await _signed_in(client)
    device_b = await _signed_in(client)
    replay = Browser(client)
    replay.cookies = dict(device_a.cookies)
    assert (await device_a.sign_out()).status_code == 204

    response = await replay.refresh()

    assert _code(response) == (401, "ACCOUNT_SESSION_INVALID")
    assert (await device_b.me()).status_code == 200
