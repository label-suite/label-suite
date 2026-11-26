"""Concurrent refreshes with one refresh token (task 4.2, design D2, spec ``login-session``).

The other refresh tests send the uses one after another. Here two or three tabs send the
same refresh token at the same moment through ``asyncio.gather``, so the conditional
``UPDATE``s really race on the database. The design's outcome: the first use and one
grace reissue get ``201`` for the same session, any further use gets ``409
ACCOUNT_REFRESH_CONFLICT``, nothing is revoked and nothing answers ``500``.
"""

import asyncio
from collections import Counter

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.accounts import add_user, sessions_of, tokens_of
from tests.support.browser import Browser

pytestmark = pytest.mark.integration


async def _tabs(client: httpx.AsyncClient, count: int) -> tuple[Browser, list[Browser]]:
    signed_in = Browser(client)
    assert (await signed_in.sign_in()).status_code == 201
    tabs = []
    for _ in range(count):
        tab = Browser(client)
        tab.cookies = dict(signed_in.cookies)
        tabs.append(tab)
    return signed_in, tabs


@pytest.mark.parametrize(
    ("tabs", "expected"),
    [(2, {201: 2}), (3, {201: 2, 409: 1})],
    ids=["two-tabs", "three-tabs"],
)
async def test_tabs_refreshing_the_same_token_at_once(
    client: httpx.AsyncClient, account_db: AsyncSession, tabs: int, expected: dict[int, int]
) -> None:
    user = await add_user(account_db)
    other_device = Browser(client)
    assert (await other_device.sign_in()).status_code == 201
    _, browsers = await _tabs(client, tabs)

    responses = await asyncio.gather(*(tab.refresh() for tab in browsers))

    assert Counter(response.status_code for response in responses) == expected
    for response in responses:
        if response.status_code == 409:
            assert response.json()["code"] == "ACCOUNT_REFRESH_CONFLICT"
            assert response.headers.get_list("set-cookie") == []
    sessions = await sessions_of(account_db, user.id)
    assert len(sessions) == 2
    assert all(row.revoked_at is None for row in sessions)
    for tab, response in zip(browsers, responses, strict=True):
        if response.status_code == 201:
            assert (await tab.me()).status_code == 200
    assert (await other_device.me()).status_code == 200
    issued = [await tokens_of(account_db, row.id) for row in sessions]
    (tokens,) = [found for found in issued if len(found) > 1]
    assert len(tokens) == 3, "one consumed token and the two it gave"
    assert tokens[0].consumed_at is not None
    assert tokens[0].reissue_count == 1
