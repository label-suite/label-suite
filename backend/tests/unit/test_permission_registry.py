"""Unit tests for ``app.core.permissions`` (authz-steps-3-4 task 2.1, design D2).

The registry is the single source of the 24 permission keys, their layer, their
06-02 section, whether they are enabled, which cells are fixed and every cell's
initial value. The expected values below are copied by hand from spec 06-02
§權限鍵與它們對應的 PRD 格, §適用格, §五個已登錄、待啟用的鍵, §預設矩陣 and §固定格不能改;
they are deliberately not derived from the registry, so a change on either side fails.
The database side of the same values is compared by the integration parity test.
"""

from collections import Counter

import pytest

from app.core.permissions import (
    PERMISSION_REGISTRY,
    SYSTEM_ROLES,
    TASK_ROLES,
    MatrixCell,
    PermissionKey,
    applicable_cells,
)

SYSTEM_KEYS = {
    "account.profile.view",
    "account.profile.edit",
    "dashboard.view",
    "task.list.view",
    "task.create",
    "admin.user_management.view",
    "admin.user_management.manage",
    "admin.role_settings.view",
    "admin.role_settings.manage",
    "admin.platform_overview.view",
}

TASK_KEYS = {
    "task.detail.view",
    "task.detail.edit",
    "task.members.manage",
    "task.lifecycle.manage",
    "task.delete",
    "annotation.annotate",
    "annotation.review",
    "annotation.exception.resolve",
    "annotation.dispute.adjudicate",
    "dataset.stats.view",
    "dataset.quality.view",
    "dataset.export",
    "dataset.ingestion.view",
    "dataset.ingestion.create",
}

PENDING_KEYS = {
    "admin.platform_overview.view",
    "task.lifecycle.manage",
    "task.delete",
    "annotation.exception.resolve",
    "annotation.dispute.adjudicate",
}

# 06-02 §預設矩陣 第 1 條: (platform member, system admin).
SYSTEM_INITIAL: dict[str, tuple[bool, bool]] = {
    "account.profile.view": (True, True),
    "account.profile.edit": (True, True),
    "dashboard.view": (True, True),
    "task.list.view": (True, True),
    "task.create": (True, True),
    "admin.user_management.view": (False, True),
    "admin.user_management.manage": (False, True),
    "admin.role_settings.view": (False, True),
    "admin.role_settings.manage": (False, True),
    "admin.platform_overview.view": (False, True),
}

# 06-02 §預設矩陣 第 2 條: (project leader, reviewer, annotator).
TASK_INITIAL: dict[str, tuple[bool, bool, bool]] = {
    "task.detail.view": (True, True, False),
    "task.detail.edit": (True, False, False),
    "task.members.manage": (True, False, False),
    "task.lifecycle.manage": (True, False, False),
    "task.delete": (True, False, False),
    "annotation.annotate": (False, False, True),
    "annotation.review": (False, True, False),
    "annotation.exception.resolve": (True, False, False),
    "annotation.dispute.adjudicate": (True, False, False),
    "dataset.stats.view": (True, True, False),
    "dataset.quality.view": (True, True, False),
    "dataset.export": (True, False, False),
    "dataset.ingestion.view": (True, True, False),
    "dataset.ingestion.create": (True, False, False),
}

# 06-02 §權限鍵與它們對應的 PRD 格: the section (所屬模組) of every key.
SECTIONS: dict[str, str] = {
    "account.profile.view": "account",
    "account.profile.edit": "account",
    "dashboard.view": "dashboard",
    "task.list.view": "task_management",
    "task.create": "task_management",
    "admin.user_management.view": "admin",
    "admin.user_management.manage": "admin",
    "admin.role_settings.view": "admin",
    "admin.role_settings.manage": "admin",
    "admin.platform_overview.view": "admin",
    "task.detail.view": "task_management",
    "task.detail.edit": "task_management",
    "task.members.manage": "task_management",
    "task.lifecycle.manage": "task_management",
    "task.delete": "task_management",
    "annotation.annotate": "annotation",
    "annotation.review": "annotation",
    "annotation.exception.resolve": "annotation",
    "annotation.dispute.adjudicate": "annotation",
    "dataset.stats.view": "dataset",
    "dataset.quality.view": "dataset",
    "dataset.export": "dataset",
    "dataset.ingestion.view": "dataset",
    "dataset.ingestion.create": "dataset",
}

ADMIN_KEYS = {key for key, section in SECTIONS.items() if section == "admin"}

# 06-02 §固定格不能改 第 1 條: (role_key, key) -> permanent value.
FIXED: dict[tuple[str, str], bool] = {
    **{("super_admin", key): True for key in ADMIN_KEYS},
    **{("user", key): False for key in ADMIN_KEYS},
    ("user", "dashboard.view"): True,
    ("super_admin", "dashboard.view"): True,
}


def _expected_cells() -> set[MatrixCell]:
    cells = {
        MatrixCell(layer="system", role_key=role, key=PermissionKey(key), allowed=value)
        for key, values in SYSTEM_INITIAL.items()
        for role, value in zip(("user", "super_admin"), values, strict=True)
    }
    cells |= {
        MatrixCell(layer="task", role_key=role, key=PermissionKey(key), allowed=value)
        for key, values in TASK_INITIAL.items()
        for role, value in zip(("project_leader", "reviewer", "annotator"), values, strict=True)
    }
    return cells


def test_whitelist_has_exactly_the_24_keys_with_their_layers() -> None:
    by_layer: dict[str, set[str]] = {"system": set(), "task": set()}
    for key, spec in PERMISSION_REGISTRY.items():
        assert spec.key is key
        by_layer[spec.layer].add(str(key))
    assert by_layer["system"] == SYSTEM_KEYS
    assert by_layer["task"] == TASK_KEYS
    assert {str(key) for key in PermissionKey} == SYSTEM_KEYS | TASK_KEYS
    assert set(PERMISSION_REGISTRY) == set(PermissionKey)


def test_existing_key_names_are_kept() -> None:
    assert PermissionKey.ADMIN_USER_MANAGEMENT_VIEW.value == "admin.user_management.view"
    assert PermissionKey.ADMIN_USER_MANAGEMENT_MANAGE.value == "admin.user_management.manage"
    assert PermissionKey.TASK_DETAIL_EDIT.value == "task.detail.edit"
    assert PermissionKey.TASK_MEMBERS_MANAGE.value == "task.members.manage"
    assert PermissionKey.TASK_DELETE.value == "task.delete"


def test_exactly_five_keys_are_registered_but_not_enabled() -> None:
    pending = {str(key) for key, spec in PERMISSION_REGISTRY.items() if not spec.enabled}
    assert pending == PENDING_KEYS
    assert sum(spec.enabled for spec in PERMISSION_REGISTRY.values()) == 19


def test_every_key_belongs_to_its_06_02_section() -> None:
    assert {str(key): spec.section for key, spec in PERMISSION_REGISTRY.items()} == SECTIONS


def test_role_tuples_match_the_two_layers() -> None:
    assert SYSTEM_ROLES == ("user", "super_admin")
    assert TASK_ROLES == ("project_leader", "reviewer", "annotator")


def test_applicable_cells_count_62_with_20_platform_and_42_task_cells() -> None:
    cells = applicable_cells()
    assert len(cells) == 62
    assert len(set(cells)) == 62
    assert Counter(cell.layer for cell in cells) == {"system": 20, "task": 42}
    assert all(isinstance(cell.allowed, bool) for cell in cells)


def test_applicable_cells_hold_no_cross_layer_cell() -> None:
    for cell in applicable_cells():
        spec = PERMISSION_REGISTRY[cell.key]
        assert cell.layer == spec.layer
        roles = SYSTEM_ROLES if spec.layer == "system" else TASK_ROLES
        assert cell.role_key in roles


def test_pending_keys_still_have_all_their_applicable_cells() -> None:
    pending_cells = [cell for cell in applicable_cells() if str(cell.key) in PENDING_KEYS]
    counts = Counter(str(cell.key) for cell in pending_cells)
    assert counts == {
        "admin.platform_overview.view": 2,
        "task.lifecycle.manage": 3,
        "task.delete": 3,
        "annotation.exception.resolve": 3,
        "annotation.dispute.adjudicate": 3,
    }
    assert len(pending_cells) == 14


def test_initial_values_equal_the_06_02_default_matrix_cell_by_cell() -> None:
    assert set(applicable_cells()) == _expected_cells()


@pytest.mark.parametrize(
    "key",
    [
        "task.lifecycle.manage",
        "task.delete",
        "annotation.exception.resolve",
        "annotation.dispute.adjudicate",
    ],
)
def test_pending_task_keys_seed_project_leader_on_and_the_others_off(key: str) -> None:
    initial = PERMISSION_REGISTRY[PermissionKey(key)].initial
    assert dict(initial) == {"project_leader": True, "reviewer": False, "annotator": False}


def test_fixed_cells_are_exactly_the_06_02_fixed_cells() -> None:
    fixed = {
        (role, str(key)): value
        for key, spec in PERMISSION_REGISTRY.items()
        for role, value in spec.fixed.items()
    }
    assert fixed == FIXED


def test_a_fixed_cell_starts_at_its_permanent_value() -> None:
    for key, spec in PERMISSION_REGISTRY.items():
        for role, value in spec.fixed.items():
            assert spec.initial[role] is value, (key, role)


def test_every_spec_gives_an_initial_value_to_exactly_its_layer_roles() -> None:
    for spec in PERMISSION_REGISTRY.values():
        roles = SYSTEM_ROLES if spec.layer == "system" else TASK_ROLES
        assert set(spec.initial) == set(roles)


def test_the_registry_cannot_be_changed_at_runtime() -> None:
    spec = PERMISSION_REGISTRY[PermissionKey.TASK_CREATE]
    with pytest.raises(TypeError):
        PERMISSION_REGISTRY[PermissionKey.TASK_CREATE] = spec  # type: ignore[index]
    with pytest.raises(TypeError):
        spec.initial["user"] = False  # type: ignore[index]
