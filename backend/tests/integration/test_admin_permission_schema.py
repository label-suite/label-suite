"""Integration tests for the admin-group migration (authz-steps-3-4 design D9).

Covers spec ``database-migration``'s ADDED requirement for the two matrix tables, and
the structure and constraints of spec ``role-permission-matrix``: row counts, no
cross-layer row, the pending keys' rows, the fixed-cell CHECK and the single version
row. The CHECK is tried on every cell the registry fixes and on every cell it does not,
so a registry change without the matching CHECK change fails here. Cell values are not
copied here: ``test_permission_registry.py`` and ``test_matrix_seed_parity.py`` check
them against spec 06-02.

The name check compares each tier against one fixed expected set, so a SQLite run and
a PostgreSQL run that both pass have identical name sets. Every test that writes the
matrix uses ``matrix_db``, which restores the initial matrix before and after.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection, Inspector, func, insert, inspect, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.db import Base
from app.core.permissions import PERMISSION_REGISTRY, applicable_cells
from app.modules.account.models import User
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion
from tests.conftest import run_alembic
from tests.integration.conftest import ACCOUNT_REVISION

pytestmark = pytest.mark.integration

MATRIX_TABLES = {"admin_role_permission", "admin_role_permission_version"}
ACCOUNT_TABLES = {"users", "account_session", "account_refresh_token"}

EXPECTED_NAMES: dict[str, dict[str, set[str]]] = {
    "admin_role_permission": {
        "pk": {"pk_admin_role_permission"},
        "check": {
            "ck_admin_role_permission_role_type_allowed",
            "ck_admin_role_permission_fixed_cells",
        },
        "unique": set(),
        "fk": set(),
        "index": set(),
    },
    "admin_role_permission_version": {
        "pk": {"pk_admin_role_permission_version"},
        "check": {
            "ck_admin_role_permission_version_single_row",
            "ck_admin_role_permission_version_version_positive",
        },
        "unique": set(),
        "fk": set(),
        "index": set(),
    },
}

SYSTEM_ROLES = {"user", "super_admin"}
TASK_ROLES = {"project_leader", "reviewer", "annotator"}
PENDING_KEYS = {
    "admin.platform_overview.view": 2,
    "task.lifecycle.manage": 3,
    "task.delete": 3,
    "annotation.exception.resolve": 3,
    "annotation.dispute.adjudicate": 3,
}
"""The five registered but not yet enabled keys and how many applicable rows each has."""

Cell = tuple[str, str, str, bool]


def _names(connection: Connection) -> dict[str, dict[str, set[str]]]:
    inspector: Inspector = inspect(connection)
    found: dict[str, dict[str, set[str]]] = {}
    for table in MATRIX_TABLES:
        unique = {uc["name"] for uc in inspector.get_unique_constraints(table) if uc["name"]}
        found[table] = {
            "pk": {name} if (name := inspector.get_pk_constraint(table)["name"]) else set(),
            "check": {ck["name"] for ck in inspector.get_check_constraints(table) if ck["name"]},
            "unique": unique,
            "fk": {fk["name"] for fk in inspector.get_foreign_keys(table) if fk["name"]},
            "index": {
                ix["name"]
                for ix in inspector.get_indexes(table)
                if ix["name"] and ix["name"] not in unique
            },
        }
    return found


def _drift(connection: Connection) -> list[Any]:
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return list(compare_metadata(context, Base.metadata))


def _tables(connection: Connection) -> set[str]:
    return set(inspect(connection).get_table_names())


async def _cells(engine: AsyncEngine) -> set[Cell]:
    m = AdminRolePermission
    async with engine.connect() as conn:
        rows = await conn.execute(select(m.role_type, m.role_key, m.permission_key, m.allowed))
        return {(r.role_type, r.role_key, r.permission_key, r.allowed) for r in rows}


async def _versions(engine: AsyncEngine) -> list[int]:
    async with engine.connect() as conn:
        return list((await conn.execute(select(AdminRolePermissionVersion.version))).scalars())


async def _set_cell(engine: AsyncEngine, role_type: str, role: str, key: str, value: bool) -> None:
    m = AdminRolePermission
    async with engine.begin() as conn:
        await conn.execute(
            update(m)
            .where(m.role_type == role_type, m.role_key == role, m.permission_key == key)
            .values(allowed=value, updated_at=datetime.now(UTC))
        )


async def _allowed(engine: AsyncEngine, role_type: str, role: str, key: str) -> bool:
    m = AdminRolePermission
    async with engine.connect() as conn:
        query = select(m.allowed).where(
            m.role_type == role_type, m.role_key == role, m.permission_key == key
        )
        return bool((await conn.execute(query)).scalar_one())


# --- spec database-migration -------------------------------------------------


async def test_head_has_both_matrix_tables_with_62_cells_and_version_1(
    migrated_engine: AsyncEngine,
) -> None:
    async with migrated_engine.connect() as conn:
        tables = await conn.run_sync(_tables)

    assert MATRIX_TABLES <= tables
    assert len(await _cells(migrated_engine)) == 62
    assert await _versions(migrated_engine) == [1]


async def test_constraint_and_index_names_match_the_shared_set(
    migrated_engine: AsyncEngine,
) -> None:
    async with migrated_engine.connect() as conn:
        found = await conn.run_sync(_names)

    assert found == EXPECTED_NAMES


async def test_migration_matches_the_models(migrated_engine: AsyncEngine) -> None:
    async with migrated_engine.connect() as conn:
        drift = await conn.run_sync(_drift)

    assert drift == []


async def test_role_type_outside_system_and_task_is_rejected(matrix_db: AsyncEngine) -> None:
    row = {
        "role_type": "global",
        "role_key": "user",
        "permission_key": "task.create",
        "allowed": True,
        "updated_at": datetime.now(UTC),
    }

    with pytest.raises(IntegrityError):
        async with matrix_db.begin() as conn:
            await conn.execute(insert(AdminRolePermission), [row])


async def test_downgrade_to_account_revision_drops_only_the_matrix_tables(
    matrix_db: AsyncEngine, account_db: AsyncSession
) -> None:
    now = datetime.now(UTC)
    user_id = uuid.uuid4()
    account_db.add(
        User(
            id=user_id,
            email="matrix-downgrade@example.test",
            name="Matrix Example",
            role="user",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    await account_db.commit()

    await run_alembic(matrix_db, "downgrade", ACCOUNT_REVISION)
    try:
        async with matrix_db.connect() as conn:
            tables = await conn.run_sync(_tables)
            users = list((await conn.execute(select(User.id))).scalars())
    finally:
        # matrix_db rewrites rows only, so this test brings the tables back itself.
        await run_alembic(matrix_db, "upgrade", "head")
    assert tables.isdisjoint(MATRIX_TABLES)
    assert ACCOUNT_TABLES <= tables
    assert users == [user_id]


async def test_upgrade_after_downgrade_rebuilds_the_same_initial_matrix(
    matrix_db: AsyncEngine,
) -> None:
    initial = await _cells(matrix_db)

    await run_alembic(matrix_db, "downgrade", ACCOUNT_REVISION)
    await run_alembic(matrix_db, "upgrade", "head")

    assert len(initial) == 62
    assert await _cells(matrix_db) == initial
    assert await _versions(matrix_db) == [1]


# --- spec role-permission-matrix: structure ----------------------------------


async def test_matrix_has_20_platform_and_42_task_rows(migrated_engine: AsyncEngine) -> None:
    cells = await _cells(migrated_engine)

    assert sum(1 for cell in cells if cell[0] == "system") == 20
    assert sum(1 for cell in cells if cell[0] == "task") == 42


async def test_no_cross_layer_row_is_stored(migrated_engine: AsyncEngine) -> None:
    cells = await _cells(migrated_engine)
    system_keys = {key for layer, _, key, _ in cells if layer == "system"}
    task_keys = {key for layer, _, key, _ in cells if layer == "task"}

    assert {role for layer, role, _, _ in cells if layer == "system"} == SYSTEM_ROLES
    assert {role for layer, role, _, _ in cells if layer == "task"} == TASK_ROLES
    assert (len(system_keys), len(task_keys)) == (10, 14)
    assert system_keys.isdisjoint(task_keys)


async def test_pending_keys_keep_their_applicable_rows(migrated_engine: AsyncEngine) -> None:
    m = AdminRolePermission
    async with migrated_engine.connect() as conn:
        rows = await conn.execute(
            select(m.permission_key, func.count())
            .where(m.permission_key.in_(PENDING_KEYS))
            .group_by(m.permission_key)
        )
        counts = {key: count for key, count in rows}

    assert counts == PENDING_KEYS
    assert sum(counts.values()) == 14


# --- spec role-permission-matrix: fixed cells and the version row ------------


FIXED_CELLS = [
    (role, str(spec.key), value)
    for spec in PERMISSION_REGISTRY.values()
    for role, value in spec.fixed.items()
]
"""Every fixed platform cell in the registry, with its permanent value."""

CHANGEABLE_CELLS = [
    (cell.layer, cell.role_key, str(cell.key), cell.allowed)
    for cell in applicable_cells()
    if cell.role_key not in PERMISSION_REGISTRY[cell.key].fixed
]
"""Every applicable cell the registry does not fix, with its initial value."""


@pytest.mark.parametrize(
    ("role", "key", "value"), FIXED_CELLS, ids=[f"{role}-{key}" for role, key, _ in FIXED_CELLS]
)
async def test_fixed_cell_cannot_be_changed(
    matrix_db: AsyncEngine, role: str, key: str, value: bool
) -> None:
    with pytest.raises(IntegrityError):
        await _set_cell(matrix_db, "system", role, key, not value)

    assert await _allowed(matrix_db, "system", role, key) is value


@pytest.mark.parametrize(
    ("layer", "role", "key", "initial"),
    CHANGEABLE_CELLS,
    ids=[f"{layer}-{role}-{key}" for layer, role, key, _ in CHANGEABLE_CELLS],
)
async def test_a_cell_that_is_not_fixed_can_be_changed(
    matrix_db: AsyncEngine, layer: str, role: str, key: str, initial: bool
) -> None:
    await _set_cell(matrix_db, layer, role, key, not initial)

    assert await _allowed(matrix_db, layer, role, key) is (not initial)


async def test_a_second_version_row_is_rejected(matrix_db: AsyncEngine) -> None:
    for row_id in (1, 2):
        with pytest.raises(IntegrityError):
            async with matrix_db.begin() as conn:
                await conn.execute(
                    insert(AdminRolePermissionVersion),
                    [{"id": row_id, "version": 2, "updated_at": datetime.now(UTC)}],
                )

    assert await _versions(matrix_db) == [1]


async def test_version_below_1_is_rejected(matrix_db: AsyncEngine) -> None:
    with pytest.raises(IntegrityError):
        async with matrix_db.begin() as conn:
            await conn.execute(update(AdminRolePermissionVersion).values(version=0))

    assert await _versions(matrix_db) == [1]
