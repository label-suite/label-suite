"""Layer-boundary checks: the import-linter contracts in ``pyproject.toml`` (design D9).

The violating cases build a throwaway package tree under ``tmp_path`` that mirrors
``app/``, copy the real ``pyproject.toml`` next to it and run ``lint-imports``
there, so no violating file ever lives in ``app/``.
"""

import pkgutil
import subprocess
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

import pytest

import app.modules
from tests.unit.import_tree import (
    BACKEND_DIR,
    HTTP_CLIENT,
    INDEPENDENCE,
    LINT_IMPORTS,
    MAIL,
    OIDC,
    ROUTER_PROTECTED,
    append,
    build_tree,
    load_contracts,
    run_lint_imports,
    write,
)

LAYERS = "Module layers"
ROUTER = "Routers do not use the data layer"
CORE = "Core does not depend on modules"
HTTP = "Data layer does not import HTTP"

EXPECTED_CONTRACTS = {
    LAYERS,
    ROUTER,
    CORE,
    HTTP,
    MAIL,
    OIDC,
    HTTP_CLIENT,
    INDEPENDENCE,
    ROUTER_PROTECTED,
}


def contract_name_diff(
    contracts: list[dict[str, Any]], expected: set[str]
) -> tuple[list[str], list[str]]:
    """Return ``(missing, extra)`` contract names compared with the expected set."""
    names = {contract["name"] for contract in contracts}
    return sorted(expected - names), sorted(names - expected)


def test_clean_tree_with_main_importing_several_routers_passes(tmp_path: Path) -> None:
    build_tree(tmp_path)

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert f"{len(load_contracts())} kept, 0 broken" in result.stdout


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
        independent = by_name[INDEPENDENCE]["modules"]
        if not any(fnmatchcase(base, pattern) for pattern in independent):
            uncovered.add(module)
        protected = by_name[ROUTER_PROTECTED]["protected_modules"]
        if not any(fnmatchcase(f"{base}.router", pattern) for pattern in protected):
            uncovered.add(module)
        for patterns, layer in ((router, "router"), (http, "repository"), (http, "models")):
            if not any(fnmatchcase(f"{base}.{layer}", pattern) for pattern in patterns):
                uncovered.add(module)
    return sorted(uncovered)


def test_every_module_in_app_modules_is_covered_by_the_contracts() -> None:
    modules = [info.name for info in pkgutil.iter_modules(app.modules.__path__) if info.ispkg]

    assert "health" in modules
    assert uncovered_modules(load_contracts(), modules) == []


def explicit_health(contracts: list[dict[str, Any]], only: set[str]) -> list[dict[str, Any]]:
    """Copy ``contracts`` and pin the named ones to ``health`` instead of a wildcard."""
    copies = [dict(contract) for contract in contracts]
    for contract in copies:
        if contract["name"] not in only:
            continue
        for key in ("containers", "source_modules", "modules", "protected_modules"):
            if key in contract:
                contract[key] = [
                    pattern.replace("*", "health") if "*" in pattern else pattern
                    for pattern in contract[key]
                ]
                if key == "containers":
                    contract[key] = ["app.modules.health"]
    return copies


def test_module_missing_from_the_contracts_is_reported_by_name() -> None:
    every = {LAYERS, ROUTER, HTTP, INDEPENDENCE, ROUTER_PROTECTED}
    contracts = explicit_health(load_contracts(), every)

    assert uncovered_modules(contracts, ["health", "brandnew"]) == ["brandnew"]


def test_module_missing_only_from_the_independence_contract_is_reported() -> None:
    contracts = explicit_health(load_contracts(), {INDEPENDENCE})

    assert uncovered_modules(contracts, ["health", "brandnew"]) == ["brandnew"]


def test_module_missing_only_from_the_router_protected_contract_is_reported() -> None:
    contracts = explicit_health(load_contracts(), {ROUTER_PROTECTED})

    assert uncovered_modules(contracts, ["health", "brandnew"]) == ["brandnew"]


def test_real_backend_passes_the_layer_check() -> None:
    result = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [str(LINT_IMPORTS)], cwd=BACKEND_DIR, capture_output=True, text=True, check=False
    )

    assert result.returncode == 0, result.stdout


SAMPLE_EXPECTED = {LAYERS, ROUTER, CORE, HTTP}


def fake(*names: str) -> list[dict[str, Any]]:
    return [{"name": name} for name in names]


def test_name_diff_sees_one_removed_and_one_added_when_the_count_is_unchanged() -> None:
    contracts = fake(LAYERS, ROUTER, CORE, "Brand new")

    assert contract_name_diff(contracts, SAMPLE_EXPECTED) == ([HTTP], ["Brand new"])


def test_name_diff_sees_a_removed_contract() -> None:
    assert contract_name_diff(fake(LAYERS, ROUTER, CORE), SAMPLE_EXPECTED) == ([HTTP], [])


def test_name_diff_sees_a_renamed_contract() -> None:
    contracts = fake(LAYERS, ROUTER, CORE, "Data layer imports HTTP")

    assert contract_name_diff(contracts, SAMPLE_EXPECTED) == (
        [HTTP],
        ["Data layer imports HTTP"],
    )


def test_real_contract_names_equal_the_expected_set() -> None:
    missing, extra = contract_name_diff(load_contracts(), EXPECTED_CONTRACTS)

    assert (missing, extra) == ([], []), f"missing {missing}, unexpected {extra}"
