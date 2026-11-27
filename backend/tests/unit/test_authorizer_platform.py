"""Unit tests for ``Authorizer`` step 3 on platform-layer operations (authz-steps-3-4 D9).

Steps 3a-3d in order: the key must be whitelisted and enabled, its layer must match the
operation's scope, the matrix version row must exist, and every effective role's cell
must exist with at least one on. Every refusal is the same ``PermissionDeniedError``.
The matrix is ``FakePermissionMatrixProvider``, which starts as the 06-02 initial matrix.
"""

import uuid
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, SystemRole
from app.core.authz import Authorizer, PermissionDeniedError
from app.core.errors import AppError
from app.core.permissions import PermissionKey
from tests.support.authz import FakePermissionMatrixProvider, FakeTaskMembershipReader

DB = cast(AsyncSession, object())
TASK_ID = uuid.UUID("33333333-3333-4333-8333-333333333333")


def _principal(role: SystemRole) -> Principal:
    return Principal(user_id=uuid.uuid4(), session_id=uuid.uuid4(), role=role)


def _unknown(key: str) -> PermissionKey:
    """Bypass the type so a value outside the whitelist reaches the authorizer."""
    return cast(PermissionKey, key)


def test_permission_denied_error_is_a_403_with_a_fixed_message_and_no_params() -> None:
    error = PermissionDeniedError()

    assert isinstance(error, AppError)
    assert (error.status_code, error.code, error.message_key) == (
        403,
        "PERMISSION_DENIED",
        "common.permission_denied",
    )
    assert error.params == {}


@pytest.mark.parametrize("role", ["user", "super_admin"])
async def test_a_platform_key_passes_on_the_system_roles_cell(role: SystemRole) -> None:
    matrix = FakePermissionMatrixProvider()
    principal = _principal(role)

    grant = await Authorizer(matrix).authorize(principal, PermissionKey.TASK_LIST_VIEW, DB)

    assert grant.principal is principal
    assert grant.key is PermissionKey.TASK_LIST_VIEW
    assert grant.task_id is None
    assert grant.task_roles == frozenset()
    assert grant.effective_roles == frozenset({role})
    assert grant.acting_role is None
    assert grant.matrix_version == 1
    assert matrix.calls == [("system", "task.list.view", frozenset({role}))]


async def test_an_admin_key_passes_for_the_system_admin_and_is_refused_for_a_member() -> None:
    matrix = FakePermissionMatrixProvider()
    authorizer = Authorizer(matrix)
    key = PermissionKey.ADMIN_USER_MANAGEMENT_VIEW

    grant = await authorizer.authorize(_principal("super_admin"), key, DB)
    assert grant.effective_roles == frozenset({"super_admin"})

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(_principal("user"), key, DB)


async def test_a_seeder_admin_is_judged_by_the_system_admin_column() -> None:
    grant = await Authorizer(FakePermissionMatrixProvider()).authorize(
        _principal("super_admin"), PermissionKey.ADMIN_ROLE_SETTINGS_MANAGE, DB
    )

    assert grant.effective_roles == frozenset({"super_admin"})


async def test_an_unknown_key_is_refused_without_reading_the_matrix() -> None:
    matrix = FakePermissionMatrixProvider()
    matrix.set("system", "super_admin", "admin.unknown.view", True)

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix).authorize(
            _principal("super_admin"), _unknown("admin.unknown.view"), DB
        )
    assert matrix.calls == []


async def test_a_pending_key_is_refused_like_an_unknown_key_even_when_its_cell_is_on() -> None:
    matrix = FakePermissionMatrixProvider()
    assert matrix.cells[("system", "super_admin", "admin.platform_overview.view")] is True

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix).authorize(
            _principal("super_admin"), PermissionKey.ADMIN_PLATFORM_OVERVIEW_VIEW, DB
        )
    assert matrix.calls == []


async def test_a_task_key_on_an_operation_outside_any_task_is_refused() -> None:
    matrix = FakePermissionMatrixProvider()

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix).authorize(
            _principal("super_admin"), PermissionKey.TASK_DETAIL_VIEW, DB
        )
    assert matrix.calls == []


async def test_a_platform_key_on_a_task_scoped_operation_is_refused() -> None:
    principal = _principal("user")
    reader = FakeTaskMembershipReader()
    reader.grant(TASK_ID, principal.user_id, "project_leader")
    matrix = FakePermissionMatrixProvider()

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix, reader).authorize(
            principal, PermissionKey.TASK_CREATE, DB, task_id=TASK_ID
        )
    assert matrix.calls == []


async def test_a_missing_version_row_refuses_everything() -> None:
    matrix = FakePermissionMatrixProvider(version=None)

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix).authorize(
            _principal("super_admin"), PermissionKey.DASHBOARD_VIEW, DB
        )


async def test_a_missing_cell_refuses_only_the_role_it_belongs_to() -> None:
    matrix = FakePermissionMatrixProvider()
    matrix.remove("system", "user", "task.create")
    authorizer = Authorizer(matrix)

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(_principal("user"), PermissionKey.TASK_CREATE, DB)
    grant = await authorizer.authorize(_principal("super_admin"), PermissionKey.TASK_CREATE, DB)
    assert grant.effective_roles == frozenset({"super_admin"})


async def test_a_cell_that_is_off_refuses() -> None:
    matrix = FakePermissionMatrixProvider()
    matrix.set("system", "user", "task.create", False)

    with pytest.raises(PermissionDeniedError):
        await Authorizer(matrix).authorize(_principal("user"), PermissionKey.TASK_CREATE, DB)


async def test_rows_of_keys_outside_the_whitelist_do_not_affect_other_keys() -> None:
    matrix = FakePermissionMatrixProvider()
    matrix.set("system", "user", "legacy.removed.view", True)
    authorizer = Authorizer(matrix)

    grant = await authorizer.authorize(_principal("user"), PermissionKey.TASK_LIST_VIEW, DB)
    assert grant.matrix_version == 1
    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(_principal("user"), _unknown("legacy.removed.view"), DB)


async def test_every_decision_reads_the_matrix_again() -> None:
    matrix = FakePermissionMatrixProvider()
    authorizer = Authorizer(matrix)
    principal = _principal("user")

    await authorizer.authorize(principal, PermissionKey.TASK_CREATE, DB)
    matrix.set("system", "user", "task.create", False)
    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(principal, PermissionKey.TASK_CREATE, DB)
    assert len(matrix.calls) == 2


async def test_the_grant_carries_the_version_that_was_read() -> None:
    matrix = FakePermissionMatrixProvider(version=7)

    grant = await Authorizer(matrix).authorize(_principal("user"), PermissionKey.DASHBOARD_VIEW, DB)

    assert grant.matrix_version == 7


async def test_a_platform_operation_needs_no_membership_reader() -> None:
    grant = await Authorizer(FakePermissionMatrixProvider(), None).authorize(
        _principal("user"), PermissionKey.ACCOUNT_PROFILE_VIEW, DB
    )

    assert grant.task_id is None
