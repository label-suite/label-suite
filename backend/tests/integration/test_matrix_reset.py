"""``reset_matrix`` restores the initial matrix without migrating (authz-steps-3-4 D9).

The reset rewrites the rows of the two matrix tables only, so it does not depend on
which revision is head: a later migration's tables and rows are never dropped by it.
"""

from datetime import UTC, datetime

import pytest
from alembic import command
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.permissions import applicable_cells
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion
from tests.integration.conftest import reset_matrix

pytestmark = pytest.mark.integration

M = AdminRolePermission


def _no_migration(*_: object, **__: object) -> None:
    raise AssertionError("reset_matrix must not run an Alembic migration")


async def test_reset_restores_cells_and_version_without_running_a_migration(
    matrix_db: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = datetime.now(UTC)
    async with matrix_db.begin() as conn:
        await conn.execute(
            update(M)
            .where(M.role_type == "system", M.role_key == "user", M.permission_key == "task.create")
            .values(allowed=False, updated_at=now)
        )
        await conn.execute(
            delete(M).where(M.role_type == "task", M.permission_key == "dataset.export")
        )
        await conn.execute(
            insert(M),
            [
                {
                    "role_type": "task",
                    "role_key": "annotator",
                    "permission_key": "admin.role_settings.view",
                    "allowed": True,
                    "updated_at": now,
                }
            ],
        )
        await conn.execute(update(AdminRolePermissionVersion).values(version=7))
    monkeypatch.setattr(command, "upgrade", _no_migration)
    monkeypatch.setattr(command, "downgrade", _no_migration)

    await reset_matrix(matrix_db)

    async with matrix_db.connect() as conn:
        rows = await conn.execute(select(M.role_type, M.role_key, M.permission_key, M.allowed))
        cells = {(r.role_type, r.role_key, r.permission_key, r.allowed) for r in rows}
        versions = list((await conn.execute(select(AdminRolePermissionVersion.version))).scalars())
    assert cells == {(c.layer, c.role_key, str(c.key), c.allowed) for c in applicable_cells()}
    assert versions == [1]
