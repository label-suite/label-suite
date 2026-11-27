"""Unit tests for step 2b and task-layer step 3 (authz-steps-3-4 D9, design D7, D8).

A task-scoped operation first reads the caller's active task roles through the
``TaskMembershipReader``: none, or an acting role the caller does not hold, is
``404 NOT_FOUND`` before the matrix is read. With several roles and no acting role the
cells are a union; with an acting role only that role counts. ``require_permission``
takes the task ID and the acting role only from path parameters: a value it cannot
convert is ``404`` (not ``422``), and a missing reader is a wiring ``RuntimeError``.
"""

import uuid
from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import UUID

import httpx
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, SystemRole, get_current_principal
from app.core.authz import AccessGrant, Authorizer, PermissionDeniedError, require_permission
from app.core.db import get_db
from app.core.errors import NotFoundError, register_exception_handlers
from app.core.i18n import MessageCatalog
from app.core.permissions import PermissionKey
from tests.support.authz import FakePermissionMatrixProvider, FakeTaskMembershipReader

DB = cast(AsyncSession, object())
TASK_T = uuid.UUID("44444444-4444-4444-8444-444444444444")
TASK_U = uuid.UUID("55555555-5555-4555-8555-555555555555")
K = PermissionKey


def _principal(role: SystemRole = "user") -> Principal:
    return Principal(user_id=uuid.uuid4(), session_id=uuid.uuid4(), role=role)


def _setup(
    *roles: Any, system_role: SystemRole = "user"
) -> tuple[Principal, FakeTaskMembershipReader, FakePermissionMatrixProvider, Authorizer]:
    principal = _principal(system_role)
    reader = FakeTaskMembershipReader()
    if roles:
        reader.grant(TASK_T, principal.user_id, *roles)
    matrix = FakePermissionMatrixProvider()
    return principal, reader, matrix, Authorizer(matrix, reader)


async def test_no_membership_is_not_found_before_the_matrix_is_read() -> None:
    principal, reader, matrix, authorizer = _setup()

    with pytest.raises(NotFoundError):
        await authorizer.authorize(principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T)
    assert reader.calls == [(TASK_T, principal.user_id)]
    assert matrix.calls == []


async def test_disabled_and_invited_members_read_as_no_roles_and_are_not_found() -> None:
    reader = FakeTaskMembershipReader()
    disabled, invited = _principal(), _principal()
    reader.grant(TASK_T, disabled.user_id)
    reader.grant(TASK_T, invited.user_id)
    authorizer = Authorizer(FakePermissionMatrixProvider(), reader)

    for principal in (disabled, invited):
        with pytest.raises(NotFoundError):
            await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)


async def test_a_system_admin_without_a_task_role_gets_no_task_key() -> None:
    principal, _, matrix, authorizer = _setup(system_role="super_admin")

    with pytest.raises(NotFoundError):
        await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)
    assert matrix.calls == []


async def test_switching_to_another_task_is_not_found() -> None:
    principal, _, _, authorizer = _setup("project_leader")

    grant = await authorizer.authorize(principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T)
    assert grant.task_id == TASK_T
    with pytest.raises(NotFoundError):
        await authorizer.authorize(principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_U)


async def test_without_an_acting_role_the_cells_of_all_active_roles_are_a_union() -> None:
    principal, _, matrix, authorizer = _setup("reviewer", "annotator")

    grant = await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)

    assert grant.task_roles == frozenset({"reviewer", "annotator"})
    assert grant.effective_roles == frozenset({"reviewer", "annotator"})
    assert grant.acting_role is None
    assert matrix.calls == [("task", "task.detail.view", frozenset({"reviewer", "annotator"}))]


async def test_a_union_whose_cells_are_all_off_is_refused() -> None:
    principal, _, _, authorizer = _setup("reviewer", "annotator")

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T)


async def test_a_union_with_one_missing_cell_is_refused() -> None:
    principal, _, matrix, authorizer = _setup("reviewer", "annotator")
    matrix.remove("task", "annotator", "task.detail.view")

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)


async def test_an_acting_role_narrows_the_check_to_that_role() -> None:
    principal, _, matrix, authorizer = _setup("project_leader", "reviewer")

    grant = await authorizer.authorize(
        principal, K.ANNOTATION_REVIEW, DB, task_id=TASK_T, acting_role="reviewer"
    )

    assert grant.task_roles == frozenset({"project_leader", "reviewer"})
    assert grant.effective_roles == frozenset({"reviewer"})
    assert grant.acting_role == "reviewer"
    assert matrix.calls == [("task", "annotation.review", frozenset({"reviewer"}))]


async def test_an_acting_role_is_stricter_than_the_union() -> None:
    principal, _, _, authorizer = _setup("project_leader", "reviewer")

    await authorizer.authorize(principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T)
    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(
            principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T, acting_role="reviewer"
        )


async def test_an_acting_role_the_caller_does_not_hold_is_not_found() -> None:
    principal, _, matrix, authorizer = _setup("reviewer")

    with pytest.raises(NotFoundError):
        await authorizer.authorize(
            principal, K.ANNOTATION_ANNOTATE, DB, task_id=TASK_T, acting_role="annotator"
        )
    assert matrix.calls == []


async def test_a_task_operation_without_a_membership_reader_is_a_wiring_error() -> None:
    with pytest.raises(RuntimeError):
        await Authorizer(FakePermissionMatrixProvider()).authorize(
            _principal(), K.TASK_DETAIL_VIEW, DB, task_id=TASK_T
        )


# --- require_permission ---------------------------------------------------------------

CALLER = _principal()


def _app(*, reader: FakeTaskMembershipReader | None) -> FastAPI:
    app = FastAPI()
    app.state.message_catalog = MessageCatalog.load()
    app.state.permission_matrix_provider = FakePermissionMatrixProvider()
    if reader is not None:
        app.state.task_membership_reader = reader
    register_exception_handlers(app)

    async def fake_db() -> AsyncIterator[Any]:
        yield DB

    async def caller() -> Principal:
        return CALLER

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_principal] = caller

    view = require_permission(K.TASK_DETAIL_VIEW, task_id_param="taskId")
    acting = require_permission(
        K.TASK_DETAIL_EDIT, task_id_param="taskId", acting_role_param="actingRole"
    )
    misdeclared = require_permission(K.TASK_DETAIL_VIEW, task_id_param="task")

    @app.get("/tasks/{taskId}")
    async def detail(taskId: UUID, grant: AccessGrant = Depends(view)) -> dict[str, Any]:  # noqa: N803, B008
        return {"task": str(grant.task_id), "roles": sorted(grant.effective_roles)}

    @app.get("/tasks/{taskId}/as/{actingRole}")
    async def as_role(grant: AccessGrant = Depends(acting)) -> dict[str, Any]:  # noqa: B008
        return {"roles": sorted(grant.effective_roles), "acting": grant.acting_role}

    @app.get("/broken/{taskId}")
    async def broken(grant: AccessGrant = Depends(misdeclared)) -> dict[str, str]:  # noqa: B008
        return {}

    return app


def _member_reader(*roles: Any) -> FakeTaskMembershipReader:
    reader = FakeTaskMembershipReader()
    reader.grant(TASK_T, CALLER.user_id, *roles)
    return reader


async def _get(app: FastAPI, path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


async def test_require_permission_takes_the_task_id_from_the_path() -> None:
    reader = _member_reader("reviewer")

    response = await _get(_app(reader=reader), f"/tasks/{TASK_T}?taskId={TASK_U}")

    assert response.status_code == 200
    assert response.json() == {"task": str(TASK_T), "roles": ["reviewer"]}
    assert reader.calls == [(TASK_T, CALLER.user_id)]


async def test_a_task_id_that_is_not_a_uuid_is_not_found_rather_than_422() -> None:
    reader = _member_reader("project_leader")

    response = await _get(_app(reader=reader), "/tasks/not-a-uuid")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert response.json()["errors"] is None
    assert reader.calls == []


async def test_an_acting_role_that_is_not_a_task_role_is_not_found() -> None:
    response = await _get(
        _app(reader=_member_reader("project_leader")), f"/tasks/{TASK_T}/as/super_admin"
    )

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


async def test_the_acting_role_comes_from_the_path() -> None:
    app = _app(reader=_member_reader("project_leader", "reviewer"))

    union = await _get(app, f"/tasks/{TASK_T}/as/project_leader?actingRole=reviewer")
    narrowed = await _get(app, f"/tasks/{TASK_T}/as/reviewer")

    assert union.json() == {"roles": ["project_leader"], "acting": "project_leader"}
    assert narrowed.status_code == 403
    assert narrowed.json()["code"] == "PERMISSION_DENIED"


async def test_a_query_role_is_not_read_when_no_acting_role_is_declared() -> None:
    response = await _get(
        _app(reader=_member_reader("reviewer", "annotator")),
        f"/tasks/{TASK_T}?actingRole=annotator",
    )

    assert response.json()["roles"] == ["annotator", "reviewer"]


async def test_require_permission_without_a_membership_reader_raises() -> None:
    with pytest.raises(RuntimeError):
        await _get(_app(reader=None), f"/tasks/{TASK_T}")


async def test_a_declared_parameter_missing_from_the_path_raises() -> None:
    with pytest.raises(RuntimeError):
        await _get(_app(reader=_member_reader("reviewer")), f"/broken/{TASK_T}")


def test_an_acting_role_parameter_needs_a_task_id_parameter() -> None:
    with pytest.raises(ValueError, match="task_id_param"):
        require_permission(K.ANNOTATION_REVIEW, acting_role_param="actingRole")
