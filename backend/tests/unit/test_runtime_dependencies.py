"""The runtime image installs what the app imports (email-celery-worker task 1.1).

The backend image is built with ``uv sync --locked --no-dev``, but the test suite runs
with the dev group installed, so a package that only a dev tool brings in passes every
test and is still missing from the image. That is how ``kombu``'s Redis transport, which
imports ``packaging``, reached a container without it. These tests walk ``uv.lock`` from
the project's runtime dependencies (extras included, the dev group left out) and assert
the packages the broker connection needs are in that closure.
"""

import tomllib
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT = "label-suite-backend"

# kombu.transport.redis imports redis and packaging; celery and kombu carry the broker.
BROKER_RUNTIME_PACKAGES = {"celery", "kombu", "redis", "packaging"}


def runtime_closure(lock: dict[str, Any], project: str = PROJECT) -> set[str]:
    """Return every package the project's non-dev dependencies install, extras included."""
    packages = {package["name"]: package for package in lock["package"]}
    seen: set[str] = set()
    pending: list[tuple[str, tuple[str, ...]]] = [
        (dep["name"], tuple(dep.get("extra", [])))
        for dep in packages[project].get("dependencies", [])
    ]
    visited: set[tuple[str, tuple[str, ...]]] = set()
    while pending:
        name, extras = pending.pop()
        if (name, extras) in visited:
            continue
        visited.add((name, extras))
        seen.add(name)
        package = packages[name]
        deps = list(package.get("dependencies", []))
        for extra in extras:
            deps.extend(package.get("optional-dependencies", {}).get(extra, []))
        pending.extend((dep["name"], tuple(dep.get("extra", []))) for dep in deps)
    return seen


def _lock() -> dict[str, Any]:
    with (BACKEND_DIR / "uv.lock").open("rb") as handle:
        return tomllib.load(handle)


def test_the_broker_packages_are_installed_without_the_dev_group() -> None:
    missing = BROKER_RUNTIME_PACKAGES - runtime_closure(_lock())

    assert missing == set(), (
        f"{sorted(missing)} would be missing from the image (uv sync --no-dev); "
        'depend on "celery[redis]", not on "celery"'
    )


def test_the_closure_leaves_out_the_dev_group() -> None:
    closure = runtime_closure(_lock())

    assert "pytest" not in closure
    assert "mypy" not in closure


def test_the_closure_follows_extras_only_when_asked() -> None:
    lock = {
        "package": [
            {"name": PROJECT, "dependencies": [{"name": "celery"}]},
            {
                "name": "celery",
                "dependencies": [{"name": "kombu"}],
                "optional-dependencies": {"redis": [{"name": "kombu", "extra": ["redis"]}]},
            },
            {
                "name": "kombu",
                "dependencies": [],
                "optional-dependencies": {"redis": [{"name": "packaging"}]},
            },
            {"name": "packaging"},
        ]
    }

    assert runtime_closure(lock) == {"celery", "kombu"}
    lock["package"][0]["dependencies"] = [{"name": "celery", "extra": ["redis"]}]
    assert runtime_closure(lock) == {"celery", "kombu", "packaging"}
