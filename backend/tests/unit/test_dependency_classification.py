"""Every third-party package imported under ``app`` is classified (B12; #563, clarification Q4).

A package is either general or owned by an entry. The entry lists must equal the
``forbidden_modules`` of the same-named contract, so the contract and the classification
cannot drift apart. Sample trees are analysed in a subprocess because ``tests/conftest.py``
already imports the real ``app`` into the pytest process (design D4).
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from tests.unit.import_tree import (
    BACKEND_DIR,
    ENTRY_THIRD_PARTY,
    HTTP_CLIENT,
    MAIL,
    load_contracts,
    write,
)

GENERAL_PACKAGES = {"fastapi", "pydantic", "pydantic_settings", "sqlalchemy", "starlette"}

_SCRIPT = """
import json, sys
import grimp
graph = grimp.build_graph("app", include_external_packages=True, cache_dir=None)
roots = {m.split(".")[0] for m in graph.modules if m.split(".")[0] != "app"}
print(json.dumps(sorted(roots - sys.stdlib_module_names)))
"""


def unclassified_imports(
    root: Path, general: set[str], entry_third_party: dict[str, set[str]]
) -> list[str]:
    """Return the non-stdlib packages imported under ``root/app`` that no list contains."""
    env = {**os.environ, "PYTHONPATH": str(root)}
    done = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [sys.executable, "-c", _SCRIPT],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    imported: set[str] = set(json.loads(done.stdout))
    classified = general.union(*entry_third_party.values())
    return sorted(imported - classified)


def entry_list_diff(
    entry_third_party: dict[str, set[str]], contracts: list[dict[str, Any]]
) -> list[str]:
    """Return one message per entry whose list differs from its contract's forbidden_modules."""
    forbidden = {c["name"]: set(c.get("forbidden_modules", [])) for c in contracts}
    messages: list[str] = []
    for entry, packages in sorted(entry_third_party.items()):
        actual = forbidden.get(entry, set())
        if packages != actual:
            messages.append(
                f"{entry}: only in the classification {sorted(packages - actual)}, "
                f"only in the contract {sorted(actual - packages)}"
            )
    return messages


def tree_with(tmp_path: Path, source: str) -> Path:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/sample.py", source)
    return tmp_path


def test_unlisted_package_in_a_sample_tree_is_returned(tmp_path: Path) -> None:
    root = tree_with(tmp_path, "import yaml\n")

    assert unclassified_imports(root, set(), {}) == ["yaml"]


def test_standard_library_imports_are_not_returned(tmp_path: Path) -> None:
    root = tree_with(tmp_path, "import json\nimport pathlib\n")

    assert unclassified_imports(root, set(), {}) == []


def test_package_in_an_entry_list_counts_as_classified(tmp_path: Path) -> None:
    root = tree_with(tmp_path, "import resend\n")

    assert unclassified_imports(root, set(), {MAIL: {"resend"}}) == []


def test_declared_dependency_is_still_unclassified_without_a_list(tmp_path: Path) -> None:
    root = tree_with(tmp_path, "import sqlalchemy\n")

    assert unclassified_imports(root, set(), ENTRY_THIRD_PARTY) == ["sqlalchemy"]


def test_real_app_has_no_unclassified_package() -> None:
    assert unclassified_imports(BACKEND_DIR, GENERAL_PACKAGES, ENTRY_THIRD_PARTY) == []


def test_real_app_reports_a_package_dropped_from_the_general_list() -> None:
    general = GENERAL_PACKAGES - {"starlette"}

    assert unclassified_imports(BACKEND_DIR, general, ENTRY_THIRD_PARTY) == ["starlette"]


def test_entry_list_with_an_extra_package_is_named() -> None:
    extra = {**ENTRY_THIRD_PARTY, MAIL: ENTRY_THIRD_PARTY[MAIL] | {"sendgrid"}}

    diff = entry_list_diff(extra, load_contracts())

    assert len(diff) == 1
    assert MAIL in diff[0]
    assert "sendgrid" in diff[0]


def test_entry_list_with_a_missing_package_is_named() -> None:
    short = {**ENTRY_THIRD_PARTY, HTTP_CLIENT: ENTRY_THIRD_PARTY[HTTP_CLIENT] - {"aiohttp"}}

    diff = entry_list_diff(short, load_contracts())

    assert len(diff) == 1
    assert HTTP_CLIENT in diff[0]
    assert "aiohttp" in diff[0]


def test_entry_lists_equal_the_contract_forbidden_modules() -> None:
    assert entry_list_diff(ENTRY_THIRD_PARTY, load_contracts()) == []
