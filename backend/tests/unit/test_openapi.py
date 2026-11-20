"""Unit tests for operationId generation and the OpenAPI post-processing (design D6)."""

import tomllib
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter, FastAPI

from app.core.openapi import (
    ComponentNameCollisionError,
    OperationIdCollisionError,
    assert_unique_operation_ids,
    generate_operation_id,
    get_app_version,
    install_openapi,
    singularize,
)
from app.core.schemas import ApiResponse, PaginatedResponse, RequestModel, ResponseModel
from app.main import create_api_router, create_app
from tests.conftest import make_test_settings

PYPROJECT = Path(__file__).resolve().parents[2] / "pyproject.toml"


class Task(ResponseModel):
    """A test-only resource."""

    task_name: str


class TaskItem(ResponseModel):
    """A test-only list item."""

    item_name: str


class TaskBody(RequestModel):
    """A test-only request body."""

    task_name: str


class HealthData(ResponseModel):
    """A test-only stand-in for the health payload."""

    status: str


class Widget(ResponseModel):
    """A test-only payload whose generic envelope is named ``WidgetResponse``."""

    widget_name: str


class WidgetResponse(ResponseModel):
    """A hand-written schema that collides with ``ApiResponse[Widget]`` after renaming."""

    widget_name: str


def _bare_app(router: APIRouter) -> FastAPI:
    """Return a minimal app: the project's generator, override and ``/api/v1`` parent."""
    app = FastAPI(generate_unique_id_function=generate_operation_id)
    api = create_api_router()
    api.include_router(router)
    app.include_router(api)
    install_openapi(app)
    return app


def _operations(schema: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (method.upper(), path): operation
        for path, item in schema["paths"].items()
        for method, operation in item.items()
    }


def _refs(node: Any) -> Iterator[str]:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref" and isinstance(value, str):
                yield value
            else:
                yield from _refs(value)
    elif isinstance(node, list):
        for value in node:
            yield from _refs(value)


# --- operationId -----------------------------------------------------------------------


def _tasks_router() -> APIRouter:
    router = APIRouter()

    @router.get("/tasks")
    def one() -> ApiResponse[PaginatedResponse[Task]]: ...

    @router.get("/tasks/{taskId}")
    def two(taskId: int) -> ApiResponse[Task]: ...

    @router.post("/tasks")
    def three(body: TaskBody) -> ApiResponse[Task]: ...

    @router.patch("/tasks/{taskId}")
    def four(taskId: int, body: TaskBody) -> ApiResponse[Task]: ...

    @router.delete("/tasks/{taskId}")
    def five(taskId: int) -> ApiResponse[Task]: ...

    @router.get("/health")
    def seven() -> ApiResponse[HealthData]: ...

    @router.get("/task-items")
    def eight() -> ApiResponse[PaginatedResponse[TaskItem]]: ...

    @router.post("/task-items")
    def nine() -> ApiResponse[TaskItem]: ...

    return router


@pytest.mark.parametrize(
    ("method", "path", "operation_id"),
    [
        ("GET", "/api/v1/tasks", "listTasks"),
        ("GET", "/api/v1/tasks/{taskId}", "getTask"),
        ("POST", "/api/v1/tasks", "createTask"),
        ("PATCH", "/api/v1/tasks/{taskId}", "updateTask"),
        ("DELETE", "/api/v1/tasks/{taskId}", "deleteTask"),
        ("GET", "/api/v1/health", "getHealth"),
        ("GET", "/api/v1/task-items", "listTaskItems"),
        ("POST", "/api/v1/task-items", "createTaskItem"),
    ],
)
def test_operation_id_is_verb_plus_resource_from_method_and_response_shape(
    method: str, path: str, operation_id: str
) -> None:
    app = _bare_app(_tasks_router())

    assert _operations(app.openapi())[(method, path)]["operationId"] == operation_id


@pytest.mark.parametrize(
    ("annotation", "operation_id"),
    [
        (ApiResponse[PaginatedResponse[Task]], "listTasks"),
        (ApiResponse[Task], "getTask"),
    ],
    ids=["paginated", "single"],
)
def test_get_verb_follows_the_return_annotation_on_a_route_mounted_directly_on_the_app(
    annotation: Any, operation_id: str
) -> None:
    app = FastAPI(generate_unique_id_function=generate_operation_id)

    async def handler() -> None: ...

    handler.__annotations__["return"] = annotation
    app.get("/api/v1/tasks")(handler)

    assert _operations(app.openapi())[("GET", "/api/v1/tasks")]["operationId"] == operation_id


@pytest.mark.parametrize(
    ("annotation", "operation_id"),
    [
        (ApiResponse[PaginatedResponse[Task]], "listTasks"),
        (ApiResponse[Task], "getTask"),
    ],
    ids=["paginated", "single"],
)
def test_get_verb_follows_the_return_annotation_on_an_included_route(
    annotation: Any, operation_id: str
) -> None:
    router = APIRouter()

    async def handler() -> None: ...

    handler.__annotations__["return"] = annotation
    router.get("/tasks")(handler)

    operations = _operations(_bare_app(router).openapi())

    assert operations[("GET", "/api/v1/tasks")]["operationId"] == operation_id


def test_response_model_argument_does_not_decide_the_verb() -> None:
    router = APIRouter()

    @router.get("/tasks", response_model=ApiResponse[PaginatedResponse[Task]])
    def handler() -> ApiResponse[Task]: ...

    operations = _operations(_bare_app(router).openapi())

    assert operations[("GET", "/api/v1/tasks")]["operationId"] == "getTask"


def test_a_route_mounted_on_the_app_without_a_return_annotation_fails_at_registration() -> None:
    app = FastAPI(generate_unique_id_function=generate_operation_id)

    async def handler():  # type: ignore[no-untyped-def]
        return None

    with pytest.raises(ValueError, match=r"GET /api/v1/tasks") as caught:
        app.get("/api/v1/tasks")(handler)

    assert "return annotation" in str(caught.value)


def test_an_included_route_without_a_return_annotation_fails_create_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def handler():  # type: ignore[no-untyped-def]
        return None

    def router_without_annotation() -> APIRouter:
        api = create_api_router()
        inner = APIRouter()
        inner.get("/tasks/{taskId}")(handler)
        api.include_router(inner)
        return api

    monkeypatch.setattr("app.main.create_api_router", router_without_annotation)

    with pytest.raises(ValueError, match=r"GET /api/v1/tasks/\{taskId\}"):
        create_app(make_test_settings(tmp_path))


def test_put_is_an_update_too() -> None:
    router = APIRouter()

    @router.put("/tasks/{taskId}")
    def replace(taskId: int, body: TaskBody) -> ApiResponse[Task]: ...

    operations = _operations(_bare_app(router).openapi())

    assert operations[("PUT", "/api/v1/tasks/{taskId}")]["operationId"] == "updateTask"


@pytest.mark.parametrize(
    ("plural", "singular"),
    [
        ("health", "health"),
        ("statuses", "status"),
        ("buses", "bus"),
        ("access", "access"),
        ("class", "class"),
        ("categories", "category"),
        ("classes", "class"),
        ("boxes", "box"),
        ("batches", "batch"),
        ("dishes", "dish"),
        ("tasks", "task"),
        ("responses", "response"),
        ("cases", "case"),
        ("databases", "database"),
        ("phases", "phase"),
        ("data", "data"),
    ],
)
def test_singularize_applies_the_six_steps_in_order(plural: str, singular: str) -> None:
    assert singularize(plural) == singular


def test_operation_id_requires_a_single_method() -> None:
    router = APIRouter()

    @router.api_route("/tasks", methods=["GET", "POST"])
    def both() -> ApiResponse[Task]: ...

    with pytest.raises(ValueError, match="exactly one method"):
        _bare_app(router).openapi()


def test_create_app_uses_the_operation_id_generator(app: FastAPI) -> None:
    operations = _operations(app.openapi())

    assert operations[("POST", "/api/v1/probe")]["operationId"] == "createProbe"
    assert operations[("GET", "/api/v1/probe")]["operationId"] == "getProbe"


# --- operationId uniqueness ------------------------------------------------------------


def _duplicate_item_routes() -> APIRouter:
    router = APIRouter()

    @router.get("/items/{itemId}")
    def first(itemId: int) -> ApiResponse[Task]: ...

    @router.get("/admin/items/{itemId}")
    def second(itemId: int) -> ApiResponse[Task]: ...

    return router


def test_duplicate_operation_ids_raise_with_the_id_and_both_paths() -> None:
    app = FastAPI(generate_unique_id_function=generate_operation_id)
    app.include_router(_duplicate_item_routes(), prefix="/api/v1")

    with pytest.raises(OperationIdCollisionError) as caught:
        assert_unique_operation_ids(app)

    message = str(caught.value)
    assert "getItem" in message
    assert "/api/v1/items/{itemId}" in message
    assert "/api/v1/admin/items/{itemId}" in message


def test_create_app_fails_to_start_on_duplicate_operation_ids(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def router_with_duplicates() -> APIRouter:
        api = create_api_router()
        api.include_router(_duplicate_item_routes())
        return api

    monkeypatch.setattr("app.main.create_api_router", router_with_duplicates)

    with pytest.raises(OperationIdCollisionError, match="getItem"):
        create_app(make_test_settings(tmp_path))


def test_openapi_generation_rechecks_routes_added_after_create_app(tmp_path: Path) -> None:
    app = create_app(make_test_settings(tmp_path))
    api = create_api_router()
    api.include_router(_duplicate_item_routes())
    app.include_router(api)

    with pytest.raises(OperationIdCollisionError, match="getItem"):
        app.openapi()


# --- 422 rewrite -----------------------------------------------------------------------


def test_operation_with_a_body_declares_422_as_error_response(app: FastAPI) -> None:
    schema = app.openapi()

    unprocessable = _operations(schema)[("POST", "/api/v1/probe")]["responses"]["422"]
    content = unprocessable["content"]["application/json"]["schema"]
    assert content == {"$ref": "#/components/schemas/ErrorResponse"}
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert "ValidationError" not in schema["components"]["schemas"]


# --- generic component names -----------------------------------------------------------


def _app_with(tmp_path: Path, router: APIRouter) -> FastAPI:
    app = create_app(make_test_settings(tmp_path))
    api = create_api_router()
    api.include_router(router)
    app.include_router(api)
    return app


def test_generic_components_are_renamed_to_their_titles(tmp_path: Path) -> None:
    router = APIRouter()

    @router.get("/task-items")
    def page() -> ApiResponse[PaginatedResponse[TaskItem]]: ...

    schema = _app_with(tmp_path, router).openapi()
    components = schema["components"]["schemas"]

    assert "TaskItemPageResponse" in components
    assert "TaskItemPage" in components
    assert "TaskItem" in components
    assert not [key for key in components if key.endswith("_")]
    assert not [key for key in components if "[" in key or "]" in key]
    ok_schema = _operations(schema)[("GET", "/api/v1/task-items")]["responses"]["200"]
    assert ok_schema["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/TaskItemPageResponse"
    }
    prefix = "#/components/schemas/"
    for ref in _refs(schema):
        assert ref.startswith(prefix)
        assert ref.removeprefix(prefix) in components, ref


def test_a_renamed_component_colliding_with_an_existing_one_raises(tmp_path: Path) -> None:
    router = APIRouter()

    @router.get("/widgets/{widgetId}")
    def generic(widgetId: int) -> ApiResponse[Widget]: ...

    @router.get("/widget-copies/{widgetId}")
    def handwritten(widgetId: int) -> WidgetResponse: ...

    app = _app_with(tmp_path, router)

    with pytest.raises(ComponentNameCollisionError) as caught:
        app.openapi()

    assert "WidgetResponse" in str(caught.value)
    assert app.openapi_schema is None


# --- caching and version ---------------------------------------------------------------


def test_openapi_is_generated_once_and_cached(app: FastAPI) -> None:
    first = app.openapi()

    assert app.openapi() is first
    assert app.openapi_schema is first


def test_info_version_comes_from_pyproject(app: FastAPI) -> None:
    expected = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))["project"]["version"]

    assert get_app_version() == expected
    assert app.openapi()["info"]["version"] == expected
    assert app.openapi()["info"]["title"] == "Label Suite API"
