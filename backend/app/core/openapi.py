"""operationId generation and OpenAPI post-processing (design D6, api-agent-rules A1, A4).

- ``generate_operation_id`` is the app's ``generate_unique_id_function``: it turns
  the method, the last non-parameter path segment and the response shape into a
  verb plus a resource (``listTasks``, ``getTask``, ``createTask``...). It never
  reads the endpoint function's name.
- ``assert_unique_operation_ids`` fails loudly when two operations share an ID.
- ``install_openapi`` replaces ``app.openapi`` so the first generation rewrites
  every ``422`` to ``ErrorResponse``, drops FastAPI's validation-error schemas and
  renames generic components (``ApiResponse_HealthData_``) to their ``title``
  (``HealthDataResponse``). ``/openapi.json`` and the export command both read
  the cached result.
- ``get_app_version`` reads ``[project].version`` from ``backend/pyproject.toml``
  so the version has a single source (Hard Rule 4).
"""

import tomllib
import typing
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute, iter_route_contexts

from app.core.paths import API_V1_PREFIX
from app.core.schemas import ApiResponse, PaginatedResponse

__all__ = [
    "ComponentNameCollisionError",
    "OperationIdCollisionError",
    "assert_unique_operation_ids",
    "generate_operation_id",
    "get_app_version",
    "install_openapi",
    "singularize",
]

PYPROJECT_PATH = Path(__file__).resolve().parents[2] / "pyproject.toml"
"""``backend/pyproject.toml``, the single source of the app version."""

COMPONENT_REF_PREFIX = "#/components/schemas/"
ERROR_RESPONSE_COMPONENT = "ErrorResponse"
_FASTAPI_VALIDATION_COMPONENTS = ("HTTPValidationError", "ValidationError")

_IRREGULAR_SINGULARS: dict[str, str] = {
    "health": "health",
    "options": "options",
    "statuses": "status",
    "buses": "bus",
}
"""Words the suffix rules get wrong; add an entry when a new resource needs one."""

_ES_PLURAL_SUFFIXES = ("sses", "xes", "ches", "shes")

_VERBS_BY_METHOD: dict[str, str] = {
    "GET": "get",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


class OperationIdCollisionError(Exception):
    """Raised when two operations produce the same operationId.

    The message names the operationId and the method and path of every route
    that produced it. Fixing it means renaming a resource, never overriding one
    ID by hand (clarification N1).
    """


class ComponentNameCollisionError(Exception):
    """Raised when renaming a generic component would overwrite another component.

    The message names the target key and both source keys.
    """


def singularize(word: str) -> str:
    """Return the singular of a lowercase English plural (design D6).

    The first matching step wins: the irregular table, ``ss`` unchanged, ``ies``
    to ``y``, ``sses``/``xes``/``ches``/``shes`` drop ``es``, any other ``s`` is
    dropped, and a word not ending in ``s`` is unchanged.

    Args:
        word: One lowercase word, e.g. ``categories``.

    Returns:
        The singular form, e.g. ``category``.
    """
    if word in _IRREGULAR_SINGULARS:
        return _IRREGULAR_SINGULARS[word]
    if word.endswith("ss"):
        return word
    if word.endswith("ies"):
        return f"{word[:-3]}y"
    if word.endswith(_ES_PLURAL_SUFFIXES):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word


def _return_annotation(route: APIRoute, method: str) -> Any:
    """Return the handler's return annotation, the route's declared response shape.

    ``route.response_model`` is not set yet when FastAPI calls the generator
    (fastapi 0.165), so the annotation is the single source (design D6).

    Raises:
        ValueError: When the handler has no return annotation or it cannot be
            resolved; the message names the method and path.
    """
    where = f"{method} {route.path_format}"
    try:
        hints = typing.get_type_hints(route.endpoint)
    except Exception as exc:
        raise ValueError(f"cannot resolve the type hints of the handler for {where}") from exc
    if "return" not in hints:
        raise ValueError(
            f"the handler for {where} has no return annotation; declare the response "
            "schema as the return annotation instead of response_model="
        )
    return hints["return"]


def _is_paginated(response_model: Any) -> bool:
    """Return whether ``response_model`` is ``ApiResponse[PaginatedResponse[...]]``."""
    if not (isinstance(response_model, type) and issubclass(response_model, ApiResponse)):
        return False
    data_field = response_model.model_fields.get("data")
    if data_field is None:
        return False
    data_type = data_field.annotation
    return isinstance(data_type, type) and issubclass(data_type, PaginatedResponse)


def _resource_words(path: str) -> list[str]:
    """Return the words of the last non-parameter segment after ``/api/v1``."""
    relative = path.removeprefix(API_V1_PREFIX)
    segments = [s for s in relative.split("/") if s and not s.startswith("{")]
    if not segments:
        raise ValueError(f"cannot derive a resource name from path {path!r}")
    return [word for word in segments[-1].split("-") if word]


def _pascal(words: list[str]) -> str:
    return "".join(word[:1].upper() + word[1:] for word in words)


def generate_operation_id(route: APIRoute) -> str:
    """Return the verb-plus-resource operationId of ``route`` (api-agent-rules A1).

    The resource is the last non-parameter path segment after ``/api/v1``, in
    PascalCase (``task-items`` becomes ``TaskItems``). The response shape is the
    handler's return annotation (``typing.get_type_hints``), never
    ``route.response_model``. A ``GET`` annotated
    ``ApiResponse[PaginatedResponse[...]]`` becomes ``list`` plus the
    plural; any other ``GET`` is ``get``, ``POST`` is ``create``, ``PUT`` and
    ``PATCH`` are ``update`` and ``DELETE`` is ``delete``, each plus the singular
    (``singularize`` applied to the last word).

    Args:
        route: The route FastAPI is naming.

    Returns:
        The operationId, e.g. ``listTaskItems`` or ``getHealth``.

    Raises:
        ValueError: When the route has more than one method, a method with no
            verb (``HEAD``, ``OPTIONS``), no resource segment, or a handler
            without a return annotation; the message names the method and path.
    """
    methods = route.methods or set()
    if len(methods) != 1:
        raise ValueError(
            f"route {route.path_format!r} must declare exactly one method, got {sorted(methods)}"
        )
    method = next(iter(methods))
    verb = _VERBS_BY_METHOD.get(method)
    if verb is None:
        raise ValueError(f"no operationId verb for method {method} on {route.path_format!r}")
    words = _resource_words(route.path_format)
    response_shape = _return_annotation(route, method)
    if method == "GET" and _is_paginated(response_shape):
        return f"list{_pascal(words)}"
    return f"{verb}{_pascal([*words[:-1], singularize(words[-1])])}"


def assert_unique_operation_ids(app: FastAPI) -> None:
    """Fail when two documented operations of ``app`` share an operationId.

    Args:
        app: The assembled app; every included router is inspected.

    Raises:
        OperationIdCollisionError: Naming each duplicated ID and the method and
            path of every route that produced it.
    """
    sources: dict[str, list[str]] = {}
    for context in iter_route_contexts(app.routes):
        if not isinstance(context.original_route, APIRoute) or not context.include_in_schema:
            continue
        operation_id: str = context.operation_id or context.unique_id
        for method in sorted(context.methods or ()):
            sources.setdefault(operation_id, []).append(f"{method} {context.path_format}")
    duplicates = {oid: routes for oid, routes in sources.items() if len(routes) > 1}
    if duplicates:
        lines = [f"{oid}: {' and '.join(routes)}" for oid, routes in sorted(duplicates.items())]
        raise OperationIdCollisionError("Duplicate operationId\n" + "\n".join(lines))


def _use_error_response_for_422(schema: dict[str, Any]) -> None:
    """Point every ``422`` at ``ErrorResponse`` and drop FastAPI's validation schemas."""
    error_ref = {"$ref": f"{COMPONENT_REF_PREFIX}{ERROR_RESPONSE_COMPONENT}"}
    components: dict[str, Any] = schema.get("components", {}).get("schemas", {})
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            response = operation.get("responses", {}).get("422")
            if response is None:
                continue
            if ERROR_RESPONSE_COMPONENT not in components:
                raise RuntimeError(
                    "an operation declares 422 but ErrorResponse is not a component; "
                    "mount the route under the /api/v1 parent router"
                )
            response["content"] = {"application/json": {"schema": dict(error_ref)}}
    for name in _FASTAPI_VALIDATION_COMPONENTS:
        components.pop(name, None)


def _rewrite_refs(node: Any, mapping: dict[str, str]) -> Any:
    """Return ``node`` with every string equal to an old component ref replaced."""
    if isinstance(node, dict):
        return {key: _rewrite_refs(value, mapping) for key, value in node.items()}
    if isinstance(node, list):
        return [_rewrite_refs(value, mapping) for value in node]
    if isinstance(node, str):
        return mapping.get(node, node)
    return node


def rename_generic_components(schema: dict[str, Any]) -> dict[str, Any]:
    """Rename every component whose key differs from its ``title`` to the ``title``.

    Pydantic keys a parametrized generic by its type reference
    (``ApiResponse_HealthData_``) while ``model_parametrized_name`` gives it the
    ``title`` ``HealthDataResponse``. Every ``#/components/schemas/<old>`` string
    in the document, ``$ref`` or discriminator mapping, is rewritten to the new
    key. Only the dict returned by FastAPI and Pydantic's public ``title`` are used.

    Args:
        schema: The OpenAPI document.

    Returns:
        A new document with renamed components and rewritten references.

    Raises:
        ComponentNameCollisionError: When a new key equals a component that is
            not itself renamed away, or two components rename to the same key.
    """
    components: dict[str, Any] = schema.get("components", {}).get("schemas", {})
    renames = {
        key: component["title"]
        for key, component in components.items()
        if isinstance(component.get("title"), str) and component["title"] != key
    }
    if not renames:
        return schema
    owners: dict[str, str] = {key: key for key in components if key not in renames}
    for old, new in renames.items():
        if new in owners:
            raise ComponentNameCollisionError(
                f"Component name collision: renaming {old!r} to {new!r} clashes with "
                f"the component from {owners[new]!r}"
            )
        owners[new] = old
    mapping = {
        f"{COMPONENT_REF_PREFIX}{old}": f"{COMPONENT_REF_PREFIX}{new}"
        for old, new in renames.items()
    }
    rewritten: dict[str, Any] = _rewrite_refs(schema, mapping)
    rewritten["components"]["schemas"] = {
        renames.get(key, key): value for key, value in rewritten["components"]["schemas"].items()
    }
    return rewritten


def install_openapi(app: FastAPI) -> None:
    """Replace ``app.openapi`` with the post-processed, cached generator.

    The first call checks operationId uniqueness again (routes may have been
    included after ``create_app``), runs FastAPI's default generator, rewrites
    ``422`` responses, drops ``HTTPValidationError``/``ValidationError`` and
    renames generic components. The result is cached in ``app.openapi_schema``;
    on failure nothing is cached, so every later call fails the same way.

    Args:
        app: The app to patch.

    Raises:
        OperationIdCollisionError: From the returned generator, on duplicate IDs.
        ComponentNameCollisionError: From the returned generator, on a rename clash.
    """
    default_openapi: Callable[[], dict[str, Any]] = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is not None:
            return app.openapi_schema
        assert_unique_operation_ids(app)
        schema = default_openapi()
        # FastAPI cached the raw document; only the processed one may stay cached.
        app.openapi_schema = None
        _use_error_response_for_422(schema)
        processed = rename_generic_components(schema)
        app.openapi_schema = processed
        return processed

    app.openapi = openapi  # type: ignore[method-assign]


def get_app_version() -> str:
    """Return ``[project].version`` from ``backend/pyproject.toml``.

    Returns:
        The version string, e.g. ``0.0.0``.

    Raises:
        FileNotFoundError: When ``pyproject.toml`` is not next to the ``app`` package.
        RuntimeError: When it has no string ``[project].version``; there is no
            fallback value.
    """
    data = tomllib.loads(PYPROJECT_PATH.read_text(encoding="utf-8"))
    version = data.get("project", {}).get("version")
    if not isinstance(version, str):
        raise RuntimeError(f"{PYPROJECT_PATH} has no string [project].version")
    return version
