"""Task-scoped authorization on the real app (authz-steps-3-4 design D7, D8, D9).

No module implements ``TaskMembershipReader`` yet, so each test puts a
``FakeTaskMembershipReader`` in ``app.state`` the way the assembly point will put the
real one; the login, ``require_permission`` and the matrix on the test database are all
real. Covers spec ``permission-authorization`` steps 2b and 4 for task-scoped operations,
answer isolation included. Tests that change the matrix use ``matrix_db``.
"""

import json
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.permissions import TaskRole
from app.modules.admin.models import AdminRolePermission
from tests.authz_probe import (
    EDIT_HIDDEN_CONDITION,
    PASSING_CONDITIONS,
    REFUSING_CONDITIONS,
    acting_path,
    answer_path,
    conditions_path,
    edit_hidden_path,
    passing_path,
    task_path,
)
from tests.factories.accounts import add_user
from tests.support.authz import FakeTaskMembershipReader
from tests.support.browser import Browser

pytestmark = pytest.mark.integration

TASK_T = uuid.uuid4()
TASK_U = uuid.uuid4()
MISSING = "/api/v1/no-such-resource"
ANSWER_WORDS = ("answer", "groundTruth", "isTestItem")


@pytest.fixture
def reader(app: FastAPI) -> FakeTaskMembershipReader:
    fake = FakeTaskMembershipReader()
    app.state.task_membership_reader = fake
    return fake


@pytest.fixture(autouse=True)
def clear_condition_calls() -> Iterator[None]:
    doubles = (*REFUSING_CONDITIONS.values(), *PASSING_CONDITIONS, EDIT_HIDDEN_CONDITION)
    for double in doubles:
        double.calls.clear()
    yield


async def _caller(
    client: httpx.AsyncClient,
    db: AsyncSession,
    reader: FakeTaskMembershipReader | None,
    email: str,
    *roles: TaskRole,
    system_role: str = "user",
) -> Browser:
    user = await add_user(db, email=email, role=system_role)
    if reader is not None and roles:
        reader.grant(TASK_T, user.id, *roles)
    browser = Browser(client)
    assert (await browser.sign_in(email)).status_code == 201
    return browser


async def _get(browser: Browser, path: str) -> httpx.Response:
    return await browser.request("GET", path)


def _assert_granted(response: httpx.Response) -> None:
    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"granted": True}


def _assert_status(response: httpx.Response, status: int, code: str) -> dict[str, Any]:
    body: dict[str, Any] = response.json()
    assert response.status_code == status, response.text
    assert body["code"] == code
    assert body["data"] is None
    return body


async def _not_found_message(browser: Browser) -> str:
    return str((await _get(browser, MISSING)).json()["message"])


# --- step 2b: the task membership ------------------------------------------------------


async def test_a_caller_without_membership_gets_not_found_rather_than_forbidden(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    outsider = await _caller(client, account_db, reader, "outsider@example.com")

    _assert_status(await _get(outsider, task_path("task.detail.edit", TASK_T)), 404, "NOT_FOUND")


async def test_inactive_and_absent_memberships_get_the_plain_not_found(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    # The reader returns no role for a disabled or an invited membership, exactly as for
    # someone who never joined; all three look the same here.
    callers = [
        await _caller(client, account_db, reader, f"{name}@example.com")
        for name in ("disabled", "invited", "never")
    ]

    for caller in callers:
        body = _assert_status(
            await _get(caller, task_path("task.detail.view", TASK_T)), 404, "NOT_FOUND"
        )
        assert body["message"] == await _not_found_message(caller)


async def test_a_system_admin_holds_no_task_role_by_default(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    admin = await _caller(
        client, account_db, reader, "admin@example.com", system_role="super_admin"
    )

    _assert_status(await _get(admin, task_path("task.detail.view", TASK_T)), 404, "NOT_FOUND")


async def test_switching_to_another_task_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    _assert_granted(await _get(leader, task_path("task.detail.view", TASK_T)))
    _assert_status(await _get(leader, task_path("task.detail.view", TASK_U)), 404, "NOT_FOUND")


async def test_a_malformed_task_id_is_not_found_rather_than_a_validation_error(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    _assert_status(
        await _get(leader, task_path("task.detail.view", "not-a-uuid")), 404, "NOT_FOUND"
    )


async def test_a_task_scoped_operation_without_a_reader_is_an_internal_error(
    client: httpx.AsyncClient, account_db: AsyncSession
) -> None:
    leader = await _caller(client, account_db, None, "leader@example.com")

    _assert_status(await _get(leader, task_path("task.detail.view", TASK_T)), 500, "INTERNAL_ERROR")


# --- step 3 for task roles: union and acting role --------------------------------------


async def test_a_task_page_takes_the_union_of_active_roles(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    both = await _caller(client, account_db, reader, "both@example.com", "reviewer", "annotator")

    _assert_granted(await _get(both, task_path("task.detail.view", TASK_T)))
    _assert_status(
        await _get(both, task_path("task.detail.edit", TASK_T)), 403, "PERMISSION_DENIED"
    )


async def test_a_cell_that_is_off_stops_before_any_condition_runs(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    reviewer = await _caller(client, account_db, reader, "reviewer@example.com", "reviewer")

    _assert_status(await _get(reviewer, edit_hidden_path(TASK_T)), 403, "PERMISSION_DENIED")
    assert EDIT_HIDDEN_CONDITION.calls == []


async def test_a_workspace_follows_only_the_acting_role(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    caller = await _caller(
        client, account_db, reader, "dual@example.com", "project_leader", "reviewer"
    )

    _assert_status(
        await _get(caller, acting_path("task.detail.edit", TASK_T, "reviewer")),
        403,
        "PERMISSION_DENIED",
    )
    _assert_granted(await _get(caller, acting_path("annotation.review", TASK_T, "reviewer")))


async def test_the_acting_role_is_stricter_than_the_union(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    caller = await _caller(
        client, account_db, reader, "dual@example.com", "project_leader", "reviewer"
    )

    _assert_granted(await _get(caller, task_path("task.detail.edit", TASK_T)))
    _assert_status(
        await _get(caller, acting_path("task.detail.edit", TASK_T, "reviewer")),
        403,
        "PERMISSION_DENIED",
    )


@pytest.mark.parametrize("role", ["annotator", "owner"])
async def test_a_path_role_cannot_create_an_identity(
    client: httpx.AsyncClient,
    account_db: AsyncSession,
    reader: FakeTaskMembershipReader,
    role: str,
) -> None:
    reviewer = await _caller(client, account_db, reader, "reviewer@example.com", "reviewer")

    response = await _get(reviewer, acting_path("annotation.annotate", TASK_T, role))

    _assert_status(response, 404, "NOT_FOUND")


async def test_a_platform_key_on_a_task_operation_is_refused(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    _assert_status(await _get(leader, task_path("task.create", TASK_T)), 403, "PERMISSION_DENIED")


async def test_a_pending_task_key_is_refused_although_the_leader_cell_is_on(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    _assert_status(await _get(leader, task_path("task.delete", TASK_T)), 403, "PERMISSION_DENIED")


# --- step 4: the declared conditions ---------------------------------------------------


async def test_authorization_has_to_pass_the_resource_condition(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    response = await _get(leader, conditions_path("task_ownership", TASK_T))

    _assert_status(response, 404, "NOT_FOUND")
    assert len(REFUSING_CONDITIONS["task_ownership"].calls) == 1


async def test_each_failing_condition_kind_refuses_although_the_cell_is_on(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    outcomes = {
        kind: (r.status_code, r.json()["code"])
        for kind in REFUSING_CONDITIONS
        for r in [await _get(leader, conditions_path(kind, TASK_T))]
    }

    assert outcomes == {
        "task_ownership": (404, "NOT_FOUND"),
        "task_state": (409, "PROBE_TASK_STATE_CONFLICT"),
        "assignment": (404, "NOT_FOUND"),
        "reviewer_identity": (404, "NOT_FOUND"),
        "dataset_visibility": (404, "NOT_FOUND"),
        "acting_role": (404, "NOT_FOUND"),
    }


async def test_an_operation_passes_only_when_every_condition_passes(
    client: httpx.AsyncClient, account_db: AsyncSession, reader: FakeTaskMembershipReader
) -> None:
    leader = await _caller(client, account_db, reader, "leader@example.com", "project_leader")

    _assert_granted(await _get(leader, passing_path(TASK_T)))
    assert [len(condition.calls) for condition in PASSING_CONDITIONS] == [1, 1]


# --- answer isolation (Hard Rule 6) ----------------------------------------------------


async def test_ground_truth_is_closed_to_every_role(
    client: httpx.AsyncClient,
    account_db: AsyncSession,
    matrix_db: AsyncEngine,
    reader: FakeTaskMembershipReader,
) -> None:
    async with matrix_db.begin() as conn:
        await conn.execute(
            update(AdminRolePermission)
            .where(
                AdminRolePermission.role_type == "task",
                AdminRolePermission.role_key == "annotator",
                AdminRolePermission.permission_key == "task.detail.view",
            )
            .values(allowed=True)
        )
    callers = [
        await _caller(
            client, account_db, reader, "admin@example.com", "project_leader",
            system_role="super_admin",
        ),
        await _caller(client, account_db, reader, "leader@example.com", "project_leader"),
        await _caller(client, account_db, reader, "reviewer@example.com", "reviewer"),
        await _caller(client, account_db, reader, "annotator@example.com", "annotator"),
    ]  # fmt: skip

    for caller in callers:
        _assert_granted(await _get(caller, task_path("task.detail.view", TASK_T)))
        response = await _get(caller, answer_path(TASK_T))
        body = _assert_status(response, 404, "NOT_FOUND")
        assert body["message"] == await _not_found_message(caller)
        serialized = json.dumps(body)
        for word in ANSWER_WORDS:
            assert word not in serialized
        assert str(TASK_T) not in serialized
