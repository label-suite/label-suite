"""create admin permission tables

Creates ``admin_role_permission`` and ``admin_role_permission_version``
(data-table-dictionary §三 ``admin``, authz-steps-3-4 design D4), then writes the
initial matrix: the 62 applicable cells of spec 06-02 §預設矩陣 and the version row
``(1, 1, now)``. ``downgrade`` drops the two tables in reverse order and leaves the
account tables and their rows alone.

The cells are literal values on purpose. A deployed migration is never edited, while
the permission whitelist in application code will change, so this file does not
import it; an integration test compares the upgraded rows with the whitelist cell by
cell. Cross-layer cells (a system role with a task-layer key, a task role with a
platform-layer key) get no row. Writing the initial matrix records no audit event
(clarification P11).

Timestamp columns use ``sa.DateTime(timezone=True)``, the DDL that the models'
``UtcDateTime`` renders, so this file does not depend on application code.

Revision ID: 4180e5b4471c
Revises: 7bf0f909ce8f
Create Date: 2026-11-27 14:27:47.690595
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4180e5b4471c"
down_revision: str | Sequence[str] | None = "7bf0f909ce8f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM_ROLES = ("user", "super_admin")
TASK_ROLES = ("project_leader", "reviewer", "annotator")

# Platform-layer keys: (key, platform member, system admin).
SYSTEM_CELLS: tuple[tuple[str, bool, bool], ...] = (
    ("account.profile.view", True, True),
    ("account.profile.edit", True, True),
    ("dashboard.view", True, True),
    ("task.list.view", True, True),
    ("task.create", True, True),
    ("admin.user_management.view", False, True),
    ("admin.user_management.manage", False, True),
    ("admin.role_settings.view", False, True),
    ("admin.role_settings.manage", False, True),
    ("admin.platform_overview.view", False, True),
)

# Task-layer keys: (key, project leader, reviewer, annotator).
TASK_CELLS: tuple[tuple[str, bool, bool, bool], ...] = (
    ("task.detail.view", True, True, False),
    ("task.detail.edit", True, False, False),
    ("task.members.manage", True, False, False),
    ("task.lifecycle.manage", True, False, False),
    ("task.delete", True, False, False),
    ("annotation.annotate", False, False, True),
    ("annotation.review", False, True, False),
    ("annotation.exception.resolve", True, False, False),
    ("annotation.dispute.adjudicate", True, False, False),
    ("dataset.stats.view", True, True, False),
    ("dataset.quality.view", True, True, False),
    ("dataset.export", True, False, False),
    ("dataset.ingestion.view", True, True, False),
    ("dataset.ingestion.create", True, False, False),
)

FIXED_CELLS_CHECK = (
    "(role_type <> 'system' OR permission_key NOT IN ("
    "'admin.user_management.view', 'admin.user_management.manage', "
    "'admin.role_settings.view', 'admin.role_settings.manage', "
    "'admin.platform_overview.view') OR allowed = (role_key = 'super_admin'))"
    " AND (permission_key NOT IN ('dashboard.view') OR allowed)"
)


def _initial_cells(now: datetime) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for key, *allowed in SYSTEM_CELLS:
        rows += [
            {"role_type": "system", "role_key": role, "permission_key": key, "allowed": value}
            for role, value in zip(SYSTEM_ROLES, allowed, strict=True)
        ]
    for key, *allowed in TASK_CELLS:
        rows += [
            {"role_type": "task", "role_key": role, "permission_key": key, "allowed": value}
            for role, value in zip(TASK_ROLES, allowed, strict=True)
        ]
    return [row | {"updated_at": now} for row in rows]


def upgrade() -> None:
    """Create the two matrix tables and write the initial matrix and version row."""
    permission = op.create_table(
        "admin_role_permission",
        sa.Column(
            "role_type",
            sa.String(),
            nullable=False,
            comment="Role layer of the cell: 'system' or 'task'.",
        ),
        sa.Column(
            "role_key",
            sa.String(),
            nullable=False,
            comment="Role of the cell: a system role or a task role, depending on role_type.",
        ),
        sa.Column(
            "permission_key",
            sa.String(),
            nullable=False,
            comment="Permission key; the whitelist lives in application code, not in a CHECK.",
        ),
        sa.Column(
            "allowed",
            sa.Boolean(),
            nullable=False,
            comment="Whether the role holds the permission; on or off only.",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When the cell was last changed (UTC).",
        ),
        sa.CheckConstraint(
            "role_type IN ('system', 'task')",
            name=op.f("ck_admin_role_permission_role_type_allowed"),
        ),
        sa.CheckConstraint(FIXED_CELLS_CHECK, name=op.f("ck_admin_role_permission_fixed_cells")),
        sa.PrimaryKeyConstraint(
            "role_type", "role_key", "permission_key", name=op.f("pk_admin_role_permission")
        ),
        comment="Role permission matrix; one row per applicable role and permission key.",
    )
    version = op.create_table(
        "admin_role_permission_version",
        sa.Column(
            "id",
            sa.SmallInteger(),
            autoincrement=False,
            nullable=False,
            comment="Always 1; the CHECK limits the table to one row.",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Current matrix version; starts at 1 and only increases.",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When the matrix was last saved (UTC).",
        ),
        sa.CheckConstraint("id = 1", name=op.f("ck_admin_role_permission_version_single_row")),
        sa.CheckConstraint(
            "version >= 1", name=op.f("ck_admin_role_permission_version_version_positive")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_role_permission_version")),
        comment="Version of the role permission matrix; holds exactly one row.",
    )

    now = datetime.now(UTC)
    op.bulk_insert(permission, _initial_cells(now))
    op.bulk_insert(version, [{"id": 1, "version": 1, "updated_at": now}])


def downgrade() -> None:
    """Revert everything ``upgrade`` did: drop the two tables in reverse order."""
    op.drop_table("admin_role_permission_version")
    op.drop_table("admin_role_permission")
