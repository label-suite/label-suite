"""ORM models of the role permission matrix (data-table-dictionary §三 ``admin``).

Two tables land here: ``admin_role_permission``, one row per applicable role x
permission-key cell, and ``admin_role_permission_version``, the single row that
carries the matrix version. Columns, nullability and constraints follow the
dictionary; constraint names come from ``NAMING_CONVENTION`` so SQLite and
PostgreSQL carry the same names.

The permission-key whitelist, the layer of each key and the fixed cells are
properties of the keys and live in application code, not in these rows. Only the
fixed cells are also enforced here, by ``ck_admin_role_permission_fixed_cells``, so
no write that bypasses the application can change them (spec 06-02 §固定格不能改).
The initial 62 cells and the version row are written by the Alembic data migration.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, CheckConstraint, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime

__all__ = [
    "ADMIN_PERMISSION_KEYS",
    "ALWAYS_ALLOWED_PERMISSION_KEYS",
    "ROLE_TYPES",
    "AdminRolePermission",
    "AdminRolePermissionVersion",
]

ROLE_TYPES: tuple[str, ...] = ("system", "task")
"""Allowed values of ``admin_role_permission.role_type``: system roles or task roles."""

ADMIN_PERMISSION_KEYS: tuple[str, ...] = (
    "admin.user_management.view",
    "admin.user_management.manage",
    "admin.role_settings.view",
    "admin.role_settings.manage",
    "admin.platform_overview.view",
)
"""The five system-administration keys whose system-role cells are fixed.

The system admin (``super_admin``) cell is always on and the platform member
(``user``) cell always off. ``ck_admin_role_permission_fixed_cells`` lists the same
keys; changing one without the other needs a new migration.
"""

ALWAYS_ALLOWED_PERMISSION_KEYS: tuple[str, ...] = ("dashboard.view",)
"""Keys whose cells are fixed on for every role that has them (spec 06-02 Q13)."""


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _sql_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


_FIXED_CELLS_CHECK = (
    f"(role_type <> 'system' OR permission_key NOT IN ({_sql_list(ADMIN_PERMISSION_KEYS)})"
    " OR allowed = (role_key = 'super_admin'))"
    f" AND (permission_key NOT IN ({_sql_list(ALWAYS_ALLOWED_PERMISSION_KEYS)}) OR allowed)"
)
"""SQL of the fixed-cell CHECK; portable to SQLite (booleans stored as 0/1) and PostgreSQL."""


class AdminRolePermission(Base):
    """One applicable cell of the role permission matrix (``admin_role_permission``).

    The primary key is ``(role_type, role_key, permission_key)``. Cells that do not
    apply (a system role with a task-layer key, a task role with a platform-layer
    key) have no row, and a missing row is read as a denial. ``allowed`` is on or
    off only; read-only access is two keys, not a third value.
    """

    __tablename__ = "admin_role_permission"
    __table_args__ = (
        CheckConstraint(f"role_type IN ({_sql_list(ROLE_TYPES)})", name="role_type_allowed"),
        CheckConstraint(_FIXED_CELLS_CHECK, name="fixed_cells"),
        {"comment": "Role permission matrix; one row per applicable role and permission key."},
    )

    role_type: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        comment="Role layer of the cell: 'system' or 'task'.",
    )
    role_key: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        comment="Role of the cell: a system role or a task role, depending on role_type.",
    )
    permission_key: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        comment="Permission key; the whitelist lives in application code, not in a CHECK.",
    )
    allowed: Mapped[bool] = mapped_column(
        Boolean, comment="Whether the role holds the permission; on or off only."
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        default=_utc_now,
        onupdate=_utc_now,
        comment="When the cell was last changed (UTC).",
    )


class AdminRolePermissionVersion(Base):
    """The single row holding the matrix version (``admin_role_permission_version``).

    ``id`` is always 1, so the table has at most one row. Every save of the matrix
    checks ``version`` as an optimistic lock; when the row is missing, every
    authorization decision that reads the matrix is denied (ADR-004 D6).
    """

    __tablename__ = "admin_role_permission_version"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("version >= 1", name="version_positive"),
        {"comment": "Version of the role permission matrix; holds exactly one row."},
    )

    id: Mapped[int] = mapped_column(
        SmallInteger,
        primary_key=True,
        autoincrement=False,
        default=1,
        comment="Always 1; the CHECK limits the table to one row.",
    )
    version: Mapped[int] = mapped_column(
        Integer, comment="Current matrix version; starts at 1 and only increases."
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        default=_utc_now,
        onupdate=_utc_now,
        comment="When the matrix was last saved (UTC).",
    )
