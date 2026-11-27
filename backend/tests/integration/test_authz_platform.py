"""Platform-layer authorization on the real app (authz-steps-3-4 design D9).

The probe routes of ``tests/authz_probe.py`` go through the production assembly: the
real login cookie, ``get_current_principal``, ``require_permission`` and the admin
module's ``AdminPermissionMatrixProvider`` on the test database. Covers spec
``permission-authorization`` for the platform layer, step 3 and the refusal envelope,
and spec ``api-envelope`` "權限不足的通用碼". Tests that change the matrix use
``matrix_db``, which restores the initial matrix before and after.
"""

import json
import re
from typing import Any

import httpx
import pytest
from sqlalchemy import delete, insert, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.sql import ColumnElement, Executable

from app.modules.account.models import User
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion
from tests.authz_probe import system_path, unknown_key_path
from tests.factories.accounts import add_user
from tests.support.browser import Browser, set_cookies

pytestmark = pytest.mark.integration

ERROR_KEYS = {"success", "code", "message", "data", "timestamp", "traceId", "errors"}
ZH_DENIED = "你沒有執行這個操作的權限"
EN_DENIED = "You do not have permission to perform this action."
MEMBER = "member@example.com"
ADMIN = "admin@example.com"


async def _signed_in(
    client: httpx.AsyncClient, db: AsyncSession, email: str, role: str, **extra: Any
) -> Browser:
    await add_user(db, email=email, role=role, **extra)
    browser = Browser(client)
    assert (await browser.sign_in(email)).status_code == 201
    return browser


async def _member(client: httpx.AsyncClient, db: AsyncSession) -> Browser:
    return await _signed_in(client, db, MEMBER, "user")


async def _admin(client: httpx.AsyncClient, db: AsyncSession) -> Browser:
    return await _signed_in(client, db, ADMIN, "super_admin")


async def _get(browser: Browser, key: str, **headers: str) -> httpx.Response:
    return await browser.request("GET", system_path(key), headers=headers)


def _cell(role_key: str, key: str) -> ColumnElement[bool]:
    return (
        (AdminRolePermission.role_type == "system")
        & (AdminRolePermission.role_key == role_key)
        & (AdminRolePermission.permission_key == key)
    )


async def _execute(engine: AsyncEngine, statement: Executable) -> None:
    async with engine.begin() as conn:
        await conn.execute(statement)


def _assert_granted(response: httpx.Response) -> None:
    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"granted": True}


def _assert_denied(response: httpx.Response) -> dict[str, Any]:
    body: dict[str, Any] = response.json()
    assert response.status_code == 403, response.text
    assert body["code"] == "PERMISSION_DENIED"
    assert body["data"] is None
    assert body["errors"] is None
    return body


# --- the platform-layer cell -----------------------------------------------------------


async def test_platform_operations_follow_the_system_role_cell(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    member = await _member(client, account_db)
    admin = await _admin(client, account_db)

    _assert_granted(await _get(member, "task.list.view"))
    _assert_granted(await _get(admin, "task.list.view"))
    _assert_granted(await _get(admin, "admin.user_management.view"))
    _assert_denied(await _get(member, "admin.user_management.view"))


async def test_the_seeder_admin_follows_the_system_admin_column(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    seeder = await _signed_in(client, account_db, ADMIN, "super_admin", is_seeder=True)

    _assert_granted(await _get(seeder, "admin.role_settings.manage"))


async def test_a_demoted_admin_is_refused_on_the_next_request(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    admin = await _admin(client, account_db)
    _assert_granted(await _get(admin, "admin.user_management.view"))

    await account_db.execute(update(User).where(User.email == ADMIN).values(role="user"))
    await account_db.commit()

    _assert_denied(await _get(admin, "admin.user_management.view"))


# --- keys the authorizer does not resolve ----------------------------------------------


async def test_a_key_outside_the_whitelist_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    admin = await _admin(client, account_db)

    _assert_denied(await admin.request("GET", unknown_key_path()))


async def test_a_pending_platform_key_is_refused_although_its_cell_is_on(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    admin = await _admin(client, account_db)

    _assert_denied(await _get(admin, "admin.platform_overview.view"))


async def test_a_task_layer_key_on_a_platform_operation_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    admin = await _admin(client, account_db)

    _assert_denied(await _get(admin, "task.detail.view"))


# --- the matrix as stored --------------------------------------------------------------


async def test_every_decision_is_refused_without_the_version_row(
    client: httpx.AsyncClient, account_db: AsyncSession, matrix_db: AsyncEngine
) -> None:
    admin = await _admin(client, account_db)
    await _execute(matrix_db, delete(AdminRolePermissionVersion))

    _assert_denied(await _get(admin, "dashboard.view"))


async def test_a_missing_cell_row_refuses_only_that_role(
    client: httpx.AsyncClient, account_db: AsyncSession, matrix_db: AsyncEngine
) -> None:
    member = await _member(client, account_db)
    admin = await _admin(client, account_db)
    await _execute(matrix_db, delete(AdminRolePermission).where(_cell("user", "task.create")))

    _assert_denied(await _get(member, "task.create"))
    _assert_granted(await _get(admin, "task.create"))


async def test_a_row_of_an_unknown_key_does_not_affect_other_decisions(
    client: httpx.AsyncClient, account_db: AsyncSession, matrix_db: AsyncEngine
) -> None:
    member = await _member(client, account_db)
    await _execute(
        matrix_db,
        insert(AdminRolePermission).values(
            role_type="system", role_key="user", permission_key="legacy.removed.view", allowed=True
        ),
    )

    _assert_granted(await _get(member, "task.list.view"))


async def test_a_cell_turned_off_refuses_the_next_request(
    client: httpx.AsyncClient, account_db: AsyncSession, matrix_db: AsyncEngine
) -> None:
    member = await _member(client, account_db)
    _assert_granted(await _get(member, "task.create"))

    await _execute(
        matrix_db,
        update(AdminRolePermission).where(_cell("user", "task.create")).values(allowed=False),
    )

    _assert_denied(await _get(member, "task.create"))


# --- the refusal envelope --------------------------------------------------------------


async def test_the_permission_denied_envelope_is_fixed_and_reveals_nothing(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    member = await _member(client, account_db)

    response = await _get(member, "admin.user_management.view", **{"Accept-Language": "zh-TW"})

    body = _assert_denied(response)
    assert set(body) == ERROR_KEYS
    assert body["success"] is False
    assert body["message"] == ZH_DENIED
    serialized = json.dumps(body, ensure_ascii=False)
    assert "admin.user_management.view" not in serialized
    assert "super_admin" not in serialized
    assert "set-cookie" not in response.headers
    assert set_cookies(response) == {}


async def test_the_permission_denied_message_is_localised_to_english(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    member = await _member(client, account_db)

    response = await _get(member, "admin.user_management.view", **{"Accept-Language": "en"})

    assert _assert_denied(response)["message"] == EN_DENIED


async def test_every_step_three_refusal_is_the_same_response(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    member = await _member(client, account_db)

    responses = [
        await member.request("GET", unknown_key_path()),
        await _get(member, "admin.platform_overview.view"),
        await _get(member, "task.detail.view"),
        await _get(member, "admin.role_settings.view"),
    ]

    outcomes = {(r.status_code, r.json()["code"], r.json()["message"]) for r in responses}
    assert outcomes == {(403, "PERMISSION_DENIED", ZH_DENIED)}


async def test_permission_denied_is_a_general_code_distinct_from_csrf_failed(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    member = await _member(client, account_db)

    body = _assert_denied(await _get(member, "admin.user_management.view"))

    assert re.fullmatch(r"[A-Z][A-Z0-9_]*", body["code"])
    assert not body["code"].startswith(("ACCOUNT_", "ADMIN_"))
    assert body["code"] != "CSRF_FAILED"


async def test_a_signed_out_caller_gets_auth_required_before_any_permission_check(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    response = await client.get(system_path("admin.user_management.view"))

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"
