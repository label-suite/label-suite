"""The migrated matrix equals the registry's initial cells (authz-steps-3-4 design D4, D9).

The admin-group migration keeps its own literal copy of the 62 initial cells and never
imports ``app.core.permissions``; this test is what keeps the two in step. It also covers
the database side of spec ``role-permission-matrix`` "預設矩陣的平台層初始值", "預設矩陣
的任務層初始值" and "待啟用任務層鍵的種子值", spelled out from spec 06-02 rather than read
from the registry, so a wrong registry value and a wrong migration value both fail.

Nothing here writes the matrix; ``matrix_db`` is used so a matrix changed by an earlier
test on a shared PostgreSQL database is reset first.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.permissions import applicable_cells
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion

pytestmark = pytest.mark.integration

Cells = dict[tuple[str, str, str], bool]

ON, OFF = True, False

PLATFORM_INITIAL: dict[str, tuple[bool, bool]] = {
    "account.profile.view": (ON, ON),
    "account.profile.edit": (ON, ON),
    "dashboard.view": (ON, ON),
    "task.list.view": (ON, ON),
    "task.create": (ON, ON),
    "admin.user_management.view": (OFF, ON),
    "admin.user_management.manage": (OFF, ON),
    "admin.role_settings.view": (OFF, ON),
    "admin.role_settings.manage": (OFF, ON),
    "admin.platform_overview.view": (OFF, ON),
}
"""Platform-layer key -> (platform member, system admin), spec 06-02 §預設矩陣."""

TASK_INITIAL: dict[str, tuple[bool, bool, bool]] = {
    "task.detail.view": (ON, ON, OFF),
    "task.detail.edit": (ON, OFF, OFF),
    "task.members.manage": (ON, OFF, OFF),
    "dataset.export": (ON, OFF, OFF),
    "dataset.ingestion.create": (ON, OFF, OFF),
    "annotation.annotate": (OFF, OFF, ON),
    "annotation.review": (OFF, ON, OFF),
    "dataset.stats.view": (ON, ON, OFF),
    "dataset.quality.view": (ON, ON, OFF),
    "dataset.ingestion.view": (ON, ON, OFF),
}
"""Enabled task-layer key -> (project leader, reviewer, annotator), spec 06-02 §預設矩陣."""

TASK_ROLES = ("project_leader", "reviewer", "annotator")
PENDING_TASK_KEYS = (
    "task.lifecycle.manage",
    "task.delete",
    "annotation.exception.resolve",
    "annotation.dispute.adjudicate",
)


async def _stored(engine: AsyncEngine) -> Cells:
    async with engine.connect() as conn:
        rows = await conn.execute(
            select(
                AdminRolePermission.role_type,
                AdminRolePermission.role_key,
                AdminRolePermission.permission_key,
                AdminRolePermission.allowed,
            )
        )
        return {(t, r, k): bool(a) for t, r, k, a in rows}


async def test_the_migrated_matrix_equals_the_registry_cell_by_cell(
    matrix_db: AsyncEngine,
) -> None:
    expected: Cells = {(c.layer, c.role_key, str(c.key)): c.allowed for c in applicable_cells()}

    stored = await _stored(matrix_db)

    assert len(stored) == 62
    assert set(stored) == set(expected)
    assert {cell: value for cell, value in stored.items() if expected[cell] != value} == {}
    async with matrix_db.connect() as conn:
        versions = (await conn.execute(select(AdminRolePermissionVersion.version))).all()
    assert [tuple(row) for row in versions] == [(1,)]


async def test_the_platform_layer_starts_as_the_default_matrix(matrix_db: AsyncEngine) -> None:
    stored = await _stored(matrix_db)

    actual = {
        key: (stored[("system", "user", key)], stored[("system", "super_admin", key)])
        for key in PLATFORM_INITIAL
    }
    assert actual == PLATFORM_INITIAL


async def test_the_task_layer_starts_as_the_default_matrix(matrix_db: AsyncEngine) -> None:
    stored = await _stored(matrix_db)

    actual = {
        key: tuple(stored[("task", role, key)] for role in TASK_ROLES) for key in TASK_INITIAL
    }
    assert actual == TASK_INITIAL


async def test_the_pending_task_keys_are_seeded_for_the_project_leader_only(
    matrix_db: AsyncEngine,
) -> None:
    stored = await _stored(matrix_db)

    for key in PENDING_TASK_KEYS:
        assert stored[("task", "project_leader", key)] is True, key
        assert stored[("task", "reviewer", key)] is False, key
        assert stored[("task", "annotator", key)] is False, key
