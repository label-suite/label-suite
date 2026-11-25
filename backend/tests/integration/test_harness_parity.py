"""The test harness and the production app share one assembly (T4, issue #562).

testing-agent-rules T4 requires integration tests to run the production app, and
clarification Q6 settles how that is proven: build a production app and the
``conftest.py`` harness from the same test settings and compare three things, the
middleware classes in order, the exception handler keys, and every path in the
production OpenAPI document. The harness may add only the probe router's paths.

Per clarification N6 the comparison neither runs a lifespan nor opens a database,
so the SQLite and PostgreSQL runs give the same result. The mutation cases prove
each comparison can fail; they mutate lists and dicts or include a router, and
reset ``middleware_stack`` and the cached ``openapi_schema`` afterwards.
"""

from collections.abc import Collection
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute

from app.core.paths import API_V1_PREFIX
from app.main import create_app
from tests.conftest import make_test_settings
from tests.probe import ITEM_ROUTE, PROBE_PATH, probe_router

pytestmark = pytest.mark.integration

NOT_A_PROBE_PATH = "/api/v1/not-a-probe"


def probe_paths() -> set[str]:
    """Return the paths the probe router adds under ``API_V1_PREFIX``."""
    return {
        API_V1_PREFIX + route.path for route in probe_router.routes if isinstance(route, APIRoute)
    }


def assert_same_assembly(
    production: FastAPI, harness: FastAPI, allowed_extra_paths: Collection[str]
) -> None:
    """Fail unless ``harness`` is assembled like ``production``.

    Raises:
        AssertionError: The middleware classes or their order differ, the exception
            handler keys differ, a production path is missing from the harness or
            documented differently there, or the harness has a path outside
            ``allowed_extra_paths``.
    """
    production_middleware = _middleware_names(production)
    harness_middleware = _middleware_names(harness)
    _check(
        production_middleware == harness_middleware,
        "middleware classes or order differ:\n"
        f"  production: {production_middleware}\n  harness:    {harness_middleware}",
    )

    production_handlers = set(production.exception_handlers)
    harness_handlers = set(harness.exception_handlers)
    _check(
        production_handlers == harness_handlers,
        "exception handler keys differ:\n"
        f"  missing from harness: {sorted(map(repr, production_handlers - harness_handlers))}\n"
        f"  extra in harness:     {sorted(map(repr, harness_handlers - production_handlers))}",
    )

    production_paths: dict[str, Any] = production.openapi()["paths"]
    harness_paths: dict[str, Any] = harness.openapi()["paths"]
    missing = sorted(set(production_paths) - set(harness_paths))
    _check(not missing, f"production paths missing from harness: {missing}")
    different = sorted(p for p in production_paths if production_paths[p] != harness_paths[p])
    _check(not different, f"paths documented differently in harness: {different}")
    extra = sorted(set(harness_paths) - set(production_paths) - set(allowed_extra_paths))
    _check(not extra, f"extra harness paths outside the probe router: {extra}")


def _check(condition: bool, message: str) -> None:
    """Raise ``AssertionError`` with exactly ``message``, free of pytest's rewritten diff."""
    if not condition:
        raise AssertionError(message)


def _middleware_names(application: FastAPI) -> list[str]:
    """Return the qualified class name of each user middleware, outermost first."""
    return [f"{m.cls.__module__}.{m.cls.__qualname__}" for m in application.user_middleware]


def _reset(application: FastAPI) -> None:
    """Drop the built middleware stack and the cached document after a mutation."""
    application.middleware_stack = None
    application.openapi_schema = None


@pytest.fixture
def production(tmp_path: Path) -> FastAPI:
    """Return the production assembly on the same test settings as the harness."""
    return create_app(make_test_settings(tmp_path))


def test_harness_matches_production_with_only_probe_paths_extra(
    production: FastAPI, app: FastAPI
) -> None:
    allowed = probe_paths()
    assert {PROBE_PATH, ITEM_ROUTE} <= allowed

    assert_same_assembly(production, app, allowed)


def test_missing_middleware_fails_and_lists_both_sides(production: FastAPI, app: FastAPI) -> None:
    removed = app.user_middleware.pop()
    _reset(app)

    with pytest.raises(AssertionError, match="middleware") as excinfo:
        assert_same_assembly(production, app, probe_paths())

    message = str(excinfo.value)
    assert "production" in message
    assert "harness" in message
    assert message.count(removed.cls.__name__) == 1


def test_swapped_middleware_order_fails(production: FastAPI, app: FastAPI) -> None:
    middleware = app.user_middleware
    assert middleware[0].cls is not middleware[1].cls
    middleware[0], middleware[1] = middleware[1], middleware[0]
    _reset(app)

    with pytest.raises(AssertionError, match="middleware"):
        assert_same_assembly(production, app, probe_paths())


def test_missing_exception_handler_fails_and_names_it(production: FastAPI, app: FastAPI) -> None:
    key: Any = next(reversed(app.exception_handlers))
    del app.exception_handlers[key]
    _reset(app)

    with pytest.raises(AssertionError, match="exception handler") as excinfo:
        assert_same_assembly(production, app, probe_paths())

    assert repr(key) in str(excinfo.value)


def test_missing_production_path_fails_and_lists_it(production: FastAPI, app: FastAPI) -> None:
    # Swapped roles: the harness plays production and a bare create_app the harness.
    with pytest.raises(AssertionError, match="missing") as excinfo:
        assert_same_assembly(app, production, probe_paths())

    message = str(excinfo.value)
    assert PROBE_PATH in message
    assert ITEM_ROUTE in message


def test_production_path_documented_differently_fails_and_lists_it(
    production: FastAPI, app: FastAPI
) -> None:
    allowed = probe_paths()
    assert_same_assembly(production, app, allowed)  # Caches the harness document.
    path = next(iter(production.openapi()["paths"]))

    # Same path, one more operation: the path stays, its document changes.
    extra = APIRouter()

    async def other_method() -> dict[str, str]:
        return {}

    extra.add_api_route(path, other_method, methods=["POST"])
    app.include_router(extra)
    _reset(app)

    with pytest.raises(AssertionError, match="documented differently") as excinfo:
        assert_same_assembly(production, app, allowed)

    assert path in str(excinfo.value)


def test_extra_path_outside_the_probe_router_fails_and_lists_it(
    production: FastAPI, app: FastAPI
) -> None:
    allowed = probe_paths()
    assert_same_assembly(production, app, allowed)  # Caches the harness document.

    extra = APIRouter()

    @extra.get(NOT_A_PROBE_PATH)
    async def not_a_probe() -> dict[str, str]:
        return {}

    app.include_router(extra)
    _reset(app)

    with pytest.raises(AssertionError, match="extra") as excinfo:
        assert_same_assembly(production, app, allowed)

    assert NOT_A_PROBE_PATH in str(excinfo.value)
