"""``AdminPermissionMatrixProvider`` on the real database (authz-steps-3-4 design D5, D9).

The provider implements ``app.core.authz.PermissionMatrixProvider``: one read of the
version row and of the requested roles' cells for one key, nothing cached and nothing
written. Every test here changes the matrix, so every one uses ``matrix_db``.
"""

from collections.abc import AsyncIterator

import pytest
from sqlalchemy import delete, insert, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.sql import ColumnElement, Executable

from app.core.authz import MatrixLookup, PermissionMatrixProvider
from app.core.permissions import PermissionKey
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion
from app.modules.admin.service import AdminPermissionMatrixProvider

pytestmark = pytest.mark.integration

K = PermissionKey


@pytest.fixture
async def db(matrix_db: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with async_sessionmaker(matrix_db, expire_on_commit=False)() as session:
        yield session


async def _execute(engine: AsyncEngine, *statements: Executable) -> None:
    async with engine.begin() as conn:
        for statement in statements:
            await conn.execute(statement)


def _cell(role_type: str, role_key: str, key: str) -> ColumnElement[bool]:
    return (
        (AdminRolePermission.role_type == role_type)
        & (AdminRolePermission.role_key == role_key)
        & (AdminRolePermission.permission_key == key)
    )


def test_the_provider_implements_the_core_protocol() -> None:
    provider: PermissionMatrixProvider = AdminPermissionMatrixProvider()

    assert isinstance(provider, AdminPermissionMatrixProvider)


async def test_it_returns_the_version_and_the_requested_cells_only(db: AsyncSession) -> None:
    lookup = await AdminPermissionMatrixProvider().lookup(
        db, "task", K.TASK_DETAIL_VIEW, frozenset({"reviewer", "annotator"})
    )

    assert lookup == MatrixLookup(version=1, cells={"reviewer": True, "annotator": False})


async def test_it_reads_only_the_given_layer(db: AsyncSession) -> None:
    lookup = await AdminPermissionMatrixProvider().lookup(
        db, "system", K.TASK_DETAIL_VIEW, frozenset({"user", "super_admin"})
    )

    assert lookup.version == 1
    assert dict(lookup.cells) == {}


async def test_a_missing_version_row_reads_as_no_version(
    matrix_db: AsyncEngine, db: AsyncSession
) -> None:
    await _execute(matrix_db, delete(AdminRolePermissionVersion))

    lookup = await AdminPermissionMatrixProvider().lookup(
        db, "system", K.DASHBOARD_VIEW, frozenset({"user"})
    )

    assert lookup.version is None
    assert dict(lookup.cells) == {"user": True}


async def test_a_missing_row_is_absent_from_the_result(
    matrix_db: AsyncEngine, db: AsyncSession
) -> None:
    await _execute(
        matrix_db, delete(AdminRolePermission).where(_cell("system", "user", "task.create"))
    )

    lookup = await AdminPermissionMatrixProvider().lookup(
        db, "system", K.TASK_CREATE, frozenset({"user", "super_admin"})
    )

    assert dict(lookup.cells) == {"super_admin": True}


async def test_a_row_of_an_unknown_key_does_not_change_a_lookup(
    matrix_db: AsyncEngine, db: AsyncSession
) -> None:
    await _execute(
        matrix_db,
        insert(AdminRolePermission).values(
            role_type="system", role_key="user", permission_key="legacy.removed.view", allowed=True
        ),
    )

    lookup = await AdminPermissionMatrixProvider().lookup(
        db, "system", K.TASK_LIST_VIEW, frozenset({"user"})
    )

    assert lookup == MatrixLookup(version=1, cells={"user": True})


async def test_a_changed_cell_is_read_on_the_next_lookup(
    matrix_db: AsyncEngine, db: AsyncSession
) -> None:
    provider = AdminPermissionMatrixProvider()
    roles = frozenset({"user"})
    before = await provider.lookup(db, "system", K.TASK_CREATE, roles)
    await db.commit()

    await _execute(
        matrix_db,
        update(AdminRolePermission)
        .where(_cell("system", "user", "task.create"))
        .values(allowed=False),
        update(AdminRolePermissionVersion).values(version=2),
    )
    after = await provider.lookup(db, "system", K.TASK_CREATE, roles)

    assert before == MatrixLookup(version=1, cells={"user": True})
    assert after == MatrixLookup(version=2, cells={"user": False})


async def test_a_lookup_writes_nothing_and_leaves_no_pending_change(db: AsyncSession) -> None:
    await AdminPermissionMatrixProvider().lookup(
        db, "system", K.DASHBOARD_VIEW, frozenset({"user", "super_admin"})
    )

    assert not db.new
    assert not db.dirty
    assert not db.deleted
