"""Single-entry import contracts (B12; issue #563, clarification Q1, Q3).

Violating and allowed cases build a throwaway tree under ``tmp_path`` and run
``lint-imports`` there, so no violating file ever lives in ``app/``. The guard test
keeps every top-level package under ``app`` inside the entry contracts (design D3).
"""

import pkgutil
from pathlib import Path
from typing import Any

import pytest

import app
from tests.unit.import_tree import (
    ENTRY_THIRD_PARTY,
    ENTRY_TOP_LEVEL_PACKAGES,
    HTTP_CLIENT,
    INDEPENDENCE,
    MAIL,
    OIDC,
    ROUTER_PROTECTED,
    append,
    build_tree,
    load_contracts,
    run_lint_imports,
    write,
)

SERVICE = "app/modules/health/service.py"
CHECKED_PACKAGES = ["app.core", "app.modules", "app.main", "app.scripts"]
CONTRACT_OF = {pkg: name for name, pkgs in ENTRY_THIRD_PARTY.items() for pkg in pkgs}


@pytest.mark.parametrize("package", sorted(CONTRACT_OF))
def test_business_module_importing_an_entry_package_fails_with_the_chain(
    tmp_path: Path, package: str
) -> None:
    build_tree(tmp_path)
    append(tmp_path, SERVICE, f"import {package}")

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{CONTRACT_OF[package]} BROKEN" in result.stdout
    assert f"app.modules.health.service -> {package}" in result.stdout


@pytest.mark.parametrize("relative", ["app/core/base.py", "app/main.py", "app/scripts/__init__.py"])
def test_core_main_and_scripts_importing_httpx_fail(tmp_path: Path, relative: str) -> None:
    build_tree(tmp_path)
    append(tmp_path, relative, "import httpx")

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{HTTP_CLIENT} BROKEN" in result.stdout


def test_standard_library_url_parsing_is_allowed(tmp_path: Path) -> None:
    build_tree(tmp_path)
    append(tmp_path, SERVICE, "import urllib.parse")

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert "0 broken" in result.stdout


def test_entry_package_outside_the_checked_packages_may_import_its_sdk(tmp_path: Path) -> None:
    # app/integrations/mail.py is a sample-only entry; its location is not a decision.
    build_tree(tmp_path)
    write(tmp_path, "app/integrations/__init__.py", "")
    write(tmp_path, "app/integrations/mail.py", "import resend\n")

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert "0 broken" in result.stdout


def test_business_module_using_the_entry_is_an_allowed_indirect_import(tmp_path: Path) -> None:
    build_tree(tmp_path)
    write(tmp_path, "app/integrations/__init__.py", "")
    write(tmp_path, "app/integrations/mail.py", "import resend\n")
    append(tmp_path, SERVICE, "from app.integrations import mail")

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert "0 broken" in result.stdout


def unclassified_top_level(
    app_dir: Path, source_modules: dict[str, list[str]], entry_packages: set[str]
) -> list[str]:
    """Return one message per top-level package of ``app_dir`` an entry contract does not cover.

    ``source_modules`` maps each entry contract's name to its ``source_modules``. A package is
    covered when the contract lists ``app`` itself or ``app.<name>``; a registered entry package
    must be listed by no contract.
    """
    names = sorted(info.name for info in pkgutil.iter_modules([str(app_dir)]))
    problems: list[str] = []
    for contract, sources in source_modules.items():
        for name in names:
            listed = "app" in sources or f"app.{name}" in sources
            if name in entry_packages and listed and "app" not in sources:
                problems.append(f"{contract}: entry package '{name}' is listed in source_modules")
            elif name not in entry_packages and not listed:
                problems.append(
                    f"{contract}: top-level package '{name}' is not in source_modules; "
                    "list it there or register it as an entry"
                )
    return problems


def sources_of(contracts: list[dict[str, Any]]) -> dict[str, list[str]]:
    return {c["name"]: c["source_modules"] for c in contracts if c["name"] in ENTRY_THIRD_PARTY}


def sample(tmp_path: Path, extra: tuple[str, ...] = ()) -> Path:
    for name in ("core", "modules", "scripts", *extra):
        write(tmp_path, f"app/{name}/__init__.py", "")
    write(tmp_path, "app/main.py", "")
    return tmp_path / "app"


def full_sources(*, replace: dict[str, list[str]] | None = None) -> dict[str, list[str]]:
    sources = {name: list(CHECKED_PACKAGES) for name in ENTRY_THIRD_PARTY}
    sources.update(replace or {})
    return sources


def test_guard_names_a_stray_top_level_package(tmp_path: Path) -> None:
    app_dir = sample(tmp_path, extra=("stray",))

    problems = unclassified_top_level(app_dir, full_sources(), set())

    assert problems
    assert all("'stray'" in problem for problem in problems)


def test_guard_names_a_registered_entry_listed_in_a_contract(tmp_path: Path) -> None:
    app_dir = sample(tmp_path, extra=("integrations",))
    sources = full_sources(replace={MAIL: [*CHECKED_PACKAGES, "app.integrations"]})

    problems = unclassified_top_level(app_dir, sources, {"integrations"})

    assert problems == [f"{MAIL}: entry package 'integrations' is listed in source_modules"]


def test_guard_names_the_contract_and_the_package_it_leaves_out(tmp_path: Path) -> None:
    app_dir = sample(tmp_path)
    sources = full_sources(replace={OIDC: ["app.core", "app.modules", "app.main"]})

    problems = unclassified_top_level(app_dir, sources, set())

    assert len(problems) == 1
    assert OIDC in problems[0]
    assert "'scripts'" in problems[0]


def test_guard_accepts_a_contract_whose_source_is_the_whole_app(tmp_path: Path) -> None:
    app_dir = sample(tmp_path, extra=("integrations",))

    problems = unclassified_top_level(app_dir, full_sources(replace={MAIL: ["app"]}), set())

    assert [p for p in problems if p.startswith(MAIL)] == []


def test_guard_accepts_registered_entries_outside_the_listed_sources(tmp_path: Path) -> None:
    app_dir = sample(tmp_path, extra=("integrations",))

    assert unclassified_top_level(app_dir, full_sources(), {"integrations"}) == []


def test_every_top_level_package_of_the_real_app_is_classified() -> None:
    contracts = load_contracts()
    sources = sources_of(contracts)

    assert set(sources) == set(ENTRY_THIRD_PARTY)
    assert unclassified_top_level(Path(app.__path__[0]), sources, ENTRY_TOP_LEVEL_PACKAGES) == []


def test_oidc_is_a_registered_entry_package_of_the_real_app() -> None:
    names = {info.name for info in pkgutil.iter_modules(app.__path__)}

    assert "oidc" in names
    assert "oidc" in ENTRY_TOP_LEVEL_PACKAGES


def test_router_importing_another_modules_service_fails_with_the_chain(tmp_path: Path) -> None:
    build_tree(tmp_path)
    append(tmp_path, "app/modules/health/router.py", "from app.modules.other import service")

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{INDEPENDENCE} BROKEN" in result.stdout
    assert "app.modules.health.router -> app.modules.other.service" in result.stdout


def test_a_third_module_importing_health_schemas_fails(tmp_path: Path) -> None:
    build_tree(tmp_path, modules=("health", "other", "brandnew"))
    append(tmp_path, "app/modules/brandnew/service.py", "from app.modules.health import schemas")

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{INDEPENDENCE} BROKEN" in result.stdout
    assert "app.modules.brandnew.service -> app.modules.health.schemas" in result.stdout


def test_main_importing_several_routers_keeps_both_module_contracts(tmp_path: Path) -> None:
    build_tree(tmp_path)

    result = run_lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout
    assert f"{INDEPENDENCE} KEPT" in result.stdout
    assert f"{ROUTER_PROTECTED} KEPT" in result.stdout


@pytest.mark.parametrize(
    ("relative", "line"),
    [
        ("app/modules/other/service.py", "from app.modules.health import router"),
        ("app/modules/health/service.py", "from app.modules.health import router"),
    ],
)
def test_only_the_assembly_point_may_import_a_router(
    tmp_path: Path, relative: str, line: str
) -> None:
    build_tree(tmp_path)
    append(tmp_path, relative, line)

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert f"{ROUTER_PROTECTED} BROKEN" in result.stdout
    assert "-> app.modules.health.router" in result.stdout
