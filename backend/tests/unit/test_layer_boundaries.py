"""Layer-boundary checks: the import-linter contracts in ``pyproject.toml`` (design D9).

The violating cases build a throwaway package tree under ``tmp_path`` that mirrors
``app/``, copy the real ``pyproject.toml`` next to it and run ``lint-imports``
there, so no violating file ever lives in ``app/``.
"""

import os
import pkgutil
import shutil
import subprocess
import sys
import tomllib
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

import pytest

import app.modules

BACKEND_DIR = Path(__file__).resolve().parents[2]
PYPROJECT = BACKEND_DIR / "pyproject.toml"
LINT_IMPORTS = Path(sys.executable).parent / "lint-imports"

LAYERS = "Module layers"
ROUTER = "Routers do not use the data layer"
CORE = "Core does not depend on modules"
HTTP = "Data layer does not import HTTP"

MODULE_FILES = {
    "__init__.py": "",
    "schemas.py": "from app.core.base import Base\n",
    "repository.py": "from app.core.base import Base\n",
    "service.py": (
        "from app.modules.{m}.repository import x\nfrom app.modules.{m}.schemas import y\n"
    ),
    "router.py": "from app.modules.{m}.service import x\nfrom app.modules.{m}.schemas import y\n",
}


def write(root: Path, relative: str, content: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def build_tree(root: Path, modules: tuple[str, ...] = ("health", "other")) -> None:
    """Write a clean ``app`` package with the given modules and a ``main.py``."""
    shutil.copy(PYPROJECT, root / "pyproject.toml")
    write(root, "app/__init__.py", "")
    write(root, "app/core/__init__.py", "")
    write(root, "app/core/base.py", "class Base: ...\n")
    write(root, "app/modules/__init__.py", "")
    for module in modules:
        for name, content in MODULE_FILES.items():
            write(root, f"app/modules/{module}/{name}", content.format(m=module))
    imports = "".join(f"from app.modules.{m}.router import router as {m}_router\n" for m in modules)
    write(root, "app/main.py", imports)


def run_lint_imports(cwd: Path) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "PYTHONPATH": str(cwd)}
    return subprocess.run(  # noqa: S603 - fixed argv, no shell
        [str(LINT_IMPORTS)], cwd=cwd, env=env, capture_output=True, text=True, check=False
    )


def append(root: Path, relative: str, line: str) -> None:
    path = root / relative
    path.write_text(path.read_text() + line + "\n")


def test_clean_tree_with_main_importing_several_routers_passes(tmp_path: Path) -> None:
    build_tree(tmp_path)

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert "4 kept, 0 broken" in result.stdout


@pytest.mark.parametrize(
    ("relative", "line", "contract"),
    [
        ("app/modules/health/service.py", "from app.modules.health import router", LAYERS),
        ("app/modules/health/repository.py", "from app.modules.health import service", LAYERS),
        ("app/modules/health/schemas.py", "from app.modules.health import router", LAYERS),
        ("app/modules/health/router.py", "from app.modules.health import repository", ROUTER),
        ("app/modules/other/router.py", "from app.modules.health import repository", ROUTER),
        ("app/core/base.py", "from app.modules.health import service", CORE),
        ("app/modules/health/repository.py", "from fastapi import HTTPException", HTTP),
        ("app/modules/health/repository.py", "from starlette.responses import Response", HTTP),
    ],
)
def test_violating_import_fails_and_names_the_contract(
    tmp_path: Path, relative: str, line: str, contract: str
) -> None:
    build_tree(tmp_path)
    append(tmp_path, relative, line)

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{contract} BROKEN" in result.stdout


def test_service_importing_router_reports_the_import_chain(tmp_path: Path) -> None:
    build_tree(tmp_path)
    append(tmp_path, "app/modules/health/service.py", "from app.modules.health import router")

    result = run_lint_imports(tmp_path)

    assert "app.modules.health.service -> app.modules.health.router" in result.stdout


def test_models_layer_is_checked_when_it_exists(tmp_path: Path) -> None:
    build_tree(tmp_path)
    write(tmp_path, "app/modules/health/models.py", "from fastapi import HTTPException\n")

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{HTTP} BROKEN" in result.stdout


def test_module_added_after_the_contracts_were_written_is_still_checked(tmp_path: Path) -> None:
    build_tree(tmp_path, modules=("health", "other", "brandnew"))
    append(
        tmp_path, "app/modules/brandnew/router.py", "from app.modules.brandnew import repository"
    )

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{ROUTER} BROKEN" in result.stdout


def load_contracts(path: Path = PYPROJECT) -> list[dict[str, Any]]:
    with path.open("rb") as handle:
        contracts: list[dict[str, Any]] = tomllib.load(handle)["tool"]["importlinter"]["contracts"]
    return contracts


def uncovered_modules(contracts: list[dict[str, Any]], modules: list[str]) -> list[str]:
    """Return the modules some per-module contract does not cover (patterns match with fnmatch)."""
    by_name = {contract["name"]: contract for contract in contracts}
    uncovered: set[str] = set()
    for module in modules:
        base = f"app.modules.{module}"
        layers = by_name[LAYERS]["containers"]
        router = by_name[ROUTER]["source_modules"]
        http = by_name[HTTP]["source_modules"]
        if not any(fnmatchcase(base, pattern) for pattern in layers):
            uncovered.add(module)
        for patterns, layer in ((router, "router"), (http, "repository"), (http, "models")):
            if not any(fnmatchcase(f"{base}.{layer}", pattern) for pattern in patterns):
                uncovered.add(module)
    return sorted(uncovered)


def test_every_module_in_app_modules_is_covered_by_the_contracts() -> None:
    modules = [info.name for info in pkgutil.iter_modules(app.modules.__path__) if info.ispkg]

    assert "health" in modules
    assert uncovered_modules(load_contracts(), modules) == []


def test_module_missing_from_the_contracts_is_reported_by_name() -> None:
    contracts = [dict(contract) for contract in load_contracts()]
    for contract in contracts:
        if contract["name"] == LAYERS:
            contract["containers"] = ["app.modules.health"]
        if contract["name"] in (ROUTER, HTTP):
            contract["source_modules"] = [
                pattern.replace("*", "health") for pattern in contract["source_modules"]
            ]

    assert uncovered_modules(contracts, ["health", "brandnew"]) == ["brandnew"]


def test_real_backend_passes_the_layer_check() -> None:
    result = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [str(LINT_IMPORTS)], cwd=BACKEND_DIR, capture_output=True, text=True, check=False
    )

    assert result.returncode == 0, result.stdout
