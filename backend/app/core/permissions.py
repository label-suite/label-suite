"""The permission-key whitelist: the 24 keys of spec 06-02 and their properties.

Every key that authorization step 3 can resolve is a member of ``PermissionKey``; a
value outside it is not a permission key and is always refused (security-agent-rules
S3). Each key's ``PermissionSpec`` records its layer, the 06-02 section it is shown
under, whether it is enabled yet, which of its cells are fixed and the initial value
of every applicable cell (spec 06-02 §預設矩陣).

``applicable_cells()`` derives the 62 applicable cells and their initial values from
this registry. It is the reference the integration parity test compares the migrated
matrix with; the migration itself keeps its own literal copy and never imports this
module, because a deployed migration is never edited.

The list is this product's, but the mechanism is generic: adding a key means one
reviewed entry here and a migration that writes its cells, never a change to the
authorizer (spec 06-02 §五個已登錄、待啟用的鍵 第 8 條).
"""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from typing import Literal

from app.core.auth import SystemRole

__all__ = [
    "PERMISSION_REGISTRY",
    "SYSTEM_ROLES",
    "TASK_ROLES",
    "MatrixCell",
    "PermissionKey",
    "PermissionLayer",
    "PermissionSection",
    "PermissionSpec",
    "TaskRole",
    "applicable_cells",
]

PermissionLayer = Literal["system", "task"]
"""Which role layer a key is granted to: system roles or task roles."""

TaskRole = Literal["project_leader", "reviewer", "annotator"]
"""The three task roles; the same values as the task-membership role column."""

PermissionSection = Literal[
    "account", "dashboard", "task_management", "annotation", "dataset", "admin"
]
"""The six 06-02 matrix sections; a section is not a layer and not a backend module."""

SYSTEM_ROLES: tuple[SystemRole, ...] = ("user", "super_admin")
"""System roles in matrix column order: platform member, system admin."""

TASK_ROLES: tuple[TaskRole, ...] = ("project_leader", "reviewer", "annotator")
"""Task roles in matrix column order: project leader, reviewer, annotator."""


class PermissionKey(StrEnum):
    """The 24 whitelisted permission keys (spec 06-02 §權限鍵與它們對應的 PRD 格)."""

    ACCOUNT_PROFILE_VIEW = "account.profile.view"
    ACCOUNT_PROFILE_EDIT = "account.profile.edit"
    DASHBOARD_VIEW = "dashboard.view"
    TASK_LIST_VIEW = "task.list.view"
    TASK_CREATE = "task.create"
    ADMIN_USER_MANAGEMENT_VIEW = "admin.user_management.view"
    ADMIN_USER_MANAGEMENT_MANAGE = "admin.user_management.manage"
    ADMIN_ROLE_SETTINGS_VIEW = "admin.role_settings.view"
    ADMIN_ROLE_SETTINGS_MANAGE = "admin.role_settings.manage"
    ADMIN_PLATFORM_OVERVIEW_VIEW = "admin.platform_overview.view"
    TASK_DETAIL_VIEW = "task.detail.view"
    TASK_DETAIL_EDIT = "task.detail.edit"
    TASK_MEMBERS_MANAGE = "task.members.manage"
    TASK_LIFECYCLE_MANAGE = "task.lifecycle.manage"
    TASK_DELETE = "task.delete"
    ANNOTATION_ANNOTATE = "annotation.annotate"
    ANNOTATION_REVIEW = "annotation.review"
    ANNOTATION_EXCEPTION_RESOLVE = "annotation.exception.resolve"
    ANNOTATION_DISPUTE_ADJUDICATE = "annotation.dispute.adjudicate"
    DATASET_STATS_VIEW = "dataset.stats.view"
    DATASET_QUALITY_VIEW = "dataset.quality.view"
    DATASET_EXPORT = "dataset.export"
    DATASET_INGESTION_VIEW = "dataset.ingestion.view"
    DATASET_INGESTION_CREATE = "dataset.ingestion.create"


@dataclass(frozen=True)
class PermissionSpec:
    """The properties of one whitelisted key.

    Attributes:
        key: The key itself.
        layer: The role layer the key is granted to.
        section: The 06-02 section the key is listed under.
        enabled: ``False`` for a registered key that authorization still refuses as if
            it were unknown (spec 06-02 §五個已登錄、待啟用的鍵 第 3 條).
        initial: The initial value of every applicable cell, by role key.
        fixed: The permanent value of each fixed cell, by role key; empty when none
            of the key's cells is fixed.
    """

    key: PermissionKey
    layer: PermissionLayer
    section: PermissionSection
    enabled: bool
    initial: Mapping[str, bool]
    fixed: Mapping[str, bool]


@dataclass(frozen=True)
class MatrixCell:
    """One applicable cell of the matrix and its initial value."""

    layer: PermissionLayer
    role_key: str
    key: PermissionKey
    allowed: bool


_ADMIN_FIXED: Mapping[str, bool] = MappingProxyType({"user": False, "super_admin": True})
_ALWAYS_ON: Mapping[str, bool] = MappingProxyType({"user": True, "super_admin": True})
_NONE_FIXED: Mapping[str, bool] = MappingProxyType({})


def _system(
    key: PermissionKey,
    section: PermissionSection,
    member: bool,
    admin: bool,
    *,
    enabled: bool = True,
    fixed: Mapping[str, bool] = _NONE_FIXED,
) -> PermissionSpec:
    initial: Mapping[str, bool] = MappingProxyType(
        dict(zip(SYSTEM_ROLES, (member, admin), strict=True))
    )
    return PermissionSpec(key, "system", section, enabled, initial, fixed)


def _task(
    key: PermissionKey,
    section: PermissionSection,
    leader: bool,
    reviewer: bool,
    annotator: bool,
    *,
    enabled: bool = True,
) -> PermissionSpec:
    values = (leader, reviewer, annotator)
    initial: Mapping[str, bool] = MappingProxyType(dict(zip(TASK_ROLES, values, strict=True)))
    return PermissionSpec(key, "task", section, enabled, initial, _NONE_FIXED)


_K = PermissionKey
_SPECS: tuple[PermissionSpec, ...] = (
    _system(_K.ACCOUNT_PROFILE_VIEW, "account", True, True),
    _system(_K.ACCOUNT_PROFILE_EDIT, "account", True, True),
    _system(_K.DASHBOARD_VIEW, "dashboard", True, True, fixed=_ALWAYS_ON),
    _system(_K.TASK_LIST_VIEW, "task_management", True, True),
    _system(_K.TASK_CREATE, "task_management", True, True),
    _system(_K.ADMIN_USER_MANAGEMENT_VIEW, "admin", False, True, fixed=_ADMIN_FIXED),
    _system(_K.ADMIN_USER_MANAGEMENT_MANAGE, "admin", False, True, fixed=_ADMIN_FIXED),
    _system(_K.ADMIN_ROLE_SETTINGS_VIEW, "admin", False, True, fixed=_ADMIN_FIXED),
    _system(_K.ADMIN_ROLE_SETTINGS_MANAGE, "admin", False, True, fixed=_ADMIN_FIXED),
    _system(
        _K.ADMIN_PLATFORM_OVERVIEW_VIEW, "admin", False, True, enabled=False, fixed=_ADMIN_FIXED
    ),
    _task(_K.TASK_DETAIL_VIEW, "task_management", True, True, False),
    _task(_K.TASK_DETAIL_EDIT, "task_management", True, False, False),
    _task(_K.TASK_MEMBERS_MANAGE, "task_management", True, False, False),
    _task(_K.TASK_LIFECYCLE_MANAGE, "task_management", True, False, False, enabled=False),
    _task(_K.TASK_DELETE, "task_management", True, False, False, enabled=False),
    _task(_K.ANNOTATION_ANNOTATE, "annotation", False, False, True),
    _task(_K.ANNOTATION_REVIEW, "annotation", False, True, False),
    _task(_K.ANNOTATION_EXCEPTION_RESOLVE, "annotation", True, False, False, enabled=False),
    _task(_K.ANNOTATION_DISPUTE_ADJUDICATE, "annotation", True, False, False, enabled=False),
    _task(_K.DATASET_STATS_VIEW, "dataset", True, True, False),
    _task(_K.DATASET_QUALITY_VIEW, "dataset", True, True, False),
    _task(_K.DATASET_EXPORT, "dataset", True, False, False),
    _task(_K.DATASET_INGESTION_VIEW, "dataset", True, True, False),
    _task(_K.DATASET_INGESTION_CREATE, "dataset", True, False, False),
)

PERMISSION_REGISTRY: Mapping[PermissionKey, PermissionSpec] = MappingProxyType(
    {spec.key: spec for spec in _SPECS}
)
"""Every whitelisted key and its properties; read-only."""


def applicable_cells() -> tuple[MatrixCell, ...]:
    """Return the 62 applicable cells with their initial values.

    A key's applicable cells are its own layer's roles only; cross-layer cells do not
    exist (spec 06-02 §適用格，錯層的不存). Pending keys are included, because the matrix
    stores their cells too.

    Returns:
        One ``MatrixCell`` per applicable cell, in registry order, then role order.
    """
    return tuple(
        MatrixCell(layer=spec.layer, role_key=role, key=spec.key, allowed=allowed)
        for spec in _SPECS
        for role, allowed in spec.initial.items()
    )
