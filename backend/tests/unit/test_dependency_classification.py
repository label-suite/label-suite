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
    OIDC,
    load_contracts,
    write,
)

GENERAL_PACKAGES = {
    "argon2",
    "fastapi",
    "jwt",
    "pydantic",
    "pydantic_settings",
    "sqlalchemy",
    "starlette",
}

_SCRIPT = """
import json, sys
import grimp
graph = grimp.build_graph("app", include_external_packages=True, cache_dir=None)
roots = {m.split(".")[0] for m in graph.modules if m.split(".")[0] != "app"}
print(json.dumps(sorted(roots - sys.stdlib_module_names)))
"""

_DIRECT_IMPORTERS_SCRIPT = """
import json, sys
import grimp
graph = grimp.build_graph("app", include_external_packages=True, cache_dir=None)
package = sys.argv[1]
importers = graph.find_modules_that_directly_import(package) if package in graph.modules else set()
print(json.dumps(sorted(m for m in importers if m.startswith("app"))))
"""


def direct_importers(root: Path, package: str) -> list[str]:
    """Return the modules under ``root/app`` that import ``package`` directly (not via a chain)."""
    env = {**os.environ, "PYTHONPATH": str(root)}
    done = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [sys.executable, "-c", _DIRECT_IMPORTERS_SCRIPT, package],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, f"grimp analysis of {root}/app failed:\n{done.stderr}"
    importers: list[str] = json.loads(done.stdout)
    return importers


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
        check=False,
    )
    assert done.returncode == 0, f"grimp analysis of {root}/app failed:\n{done.stderr}"
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
    unclassified = unclassified_imports(BACKEND_DIR, GENERAL_PACKAGES, ENTRY_THIRD_PARTY)

    assert unclassified == [], (
        f"unclassified third-party packages {unclassified}: classify each as a general "
        "package (GENERAL_PACKAGES) or register it as an entry package (ENTRY_THIRD_PARTY)"
    )


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


# --- the OIDC entry (login-auth-guard design D5, system-design T7) --------------------


def test_jwt_and_argon2_are_general_packages() -> None:
    assert {"jwt", "argon2"} <= GENERAL_PACKAGES
    assert not {"jwt", "argon2"} & set().union(*ENTRY_THIRD_PARTY.values())


def test_authlib_stays_owned_by_the_oidc_entry_and_httpx_by_the_http_entry() -> None:
    assert "authlib" in ENTRY_THIRD_PARTY[OIDC]
    assert "httpx" in ENTRY_THIRD_PARTY[HTTP_CLIENT]


def test_direct_httpx_import_in_a_sample_oidc_package_is_found(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/oidc/__init__.py", "")
    write(tmp_path, "app/oidc/google.py", "import httpx\n")

    assert direct_importers(tmp_path, "httpx") == ["app.oidc.google"]


def test_httpx_reached_only_through_authlib_is_not_a_direct_import(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/oidc/__init__.py", "")
    write(tmp_path, "app/oidc/google.py", "import authlib\n")

    assert direct_importers(tmp_path, "httpx") == []


def test_real_oidc_entry_does_not_import_httpx_directly() -> None:
    offenders = [m for m in direct_importers(BACKEND_DIR, "httpx") if m.startswith("app.oidc")]

    assert offenders == [], f"app/oidc must reach httpx only through authlib: {offenders}"


def test_only_the_oidc_entry_imports_authlib() -> None:
    importers = direct_importers(BACKEND_DIR, "authlib")

    assert [m for m in importers if not m.startswith("app.oidc")] == []
