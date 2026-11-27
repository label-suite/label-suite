"""Unit tests for the OpenAPI module tags (api-agent-rules A1; openapi-module-tags design D3).

The checks read the generated document, not the route table: every operation carries
exactly one tag, every tag used is declared at the top level, and every top-level
``description`` is non-blank. Whether a tag name equals its module directory is left to
review, so no test here checks names against ``app/modules/``.

The positive tests use the production assembly from ``create_app`` without the test-only
probe router that the shared ``app`` fixture adds, because the probe routes belong to no
module and would rightly fail the "exactly one tag" check.
"""

import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter, FastAPI

from app.core.schemas import ApiResponse, ResponseModel
from app.main import create_app
from tests.conftest import make_test_settings

HTTP_METHODS = ("get", "put", "post", "delete", "patch", "head", "options", "trace")
"""The keys of an OpenAPI path item that hold an operation; others (``parameters``) do not."""


@dataclass(frozen=True)
class TagViolation:
    """One breach of the tag rules found in an OpenAPI document.

    ``method`` and ``path`` are empty for a top-level declaration problem; ``tags`` holds
    the operation's actual tags, or the offending top-level ``name`` for a blank description.
    """

    kind: str
    method: str
    path: str
    tags: tuple[str, ...]


def collect_tag_violations(document: dict[str, Any]) -> list[TagViolation]:
    """Return every tag-rule violation in ``document``, in path order.

    Three kinds are reported: ``tag-count`` (an operation without exactly one tag),
    ``undeclared-tag`` (an operation's tag missing from the top-level ``tags`` names) and
    ``blank-description`` (a top-level entry whose description is empty or whitespace).
    """
    declared = document.get("tags", [])
    names = {entry["name"] for entry in declared}
    violations = [
        TagViolation("blank-description", "", "", (entry["name"],))
        for entry in declared
        if not str(entry.get("description", "")).strip()
    ]
    for path, item in document.get("paths", {}).items():
        for method in HTTP_METHODS:
            if method not in item:
                continue
            tags = tuple(item[method].get("tags", []))
            if len(tags) != 1:
                violations.append(TagViolation("tag-count", method.upper(), path, tags))
            violations.extend(
                TagViolation("undeclared-tag", method.upper(), path, (tag,))
                for tag in tags
                if tag not in names
            )
    return violations


@pytest.fixture
def production_app(tmp_path: Path) -> FastAPI:
    """Return ``create_app(test settings)`` exactly as production assembles it."""
    return create_app(make_test_settings(tmp_path))


def _operations(document: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (method.upper(), path): item[method]
        for path, item in document["paths"].items()
        for method in HTTP_METHODS
        if method in item
    }


# --- the production document -----------------------------------------------------------


def test_every_operation_has_exactly_one_tag(production_app: FastAPI) -> None:
    violations = collect_tag_violations(production_app.openapi())

    assert [v for v in violations if v.kind == "tag-count"] == []


def test_every_operation_tag_is_declared_at_the_top_level(production_app: FastAPI) -> None:
    violations = collect_tag_violations(production_app.openapi())

    assert [v for v in violations if v.kind == "undeclared-tag"] == []


def test_every_top_level_tag_has_a_non_blank_description(production_app: FastAPI) -> None:
    document = production_app.openapi()

    assert document["tags"]
    assert [v for v in collect_tag_violations(document) if v.kind == "blank-description"] == []


FORBIDDEN_DESCRIPTION_FRAGMENTS = ("/", "\\", "_", "://", "localhost")
FORBIDDEN_DESCRIPTION_WORDS = ("answer", "ground truth", "test set")


def test_top_level_tag_descriptions_only_state_the_module_purpose(
    production_app: FastAPI,
) -> None:
    for entry in production_app.openapi()["tags"]:
        description: str = entry["description"]

        assert re.fullmatch(r"[\x20-\x7e]+", description), entry["name"]
        assert description.endswith("."), entry["name"]
        assert description.count(".") == 1, entry["name"]
        assert not any(part in description for part in FORBIDDEN_DESCRIPTION_FRAGMENTS)
        assert not any(word in description.lower() for word in FORBIDDEN_DESCRIPTION_WORDS)


EXPECTED_OPERATION_TAGS = {
    ("GET", "/api/v1/health"): ["health"],
    ("GET", "/api/v1/auth-options"): ["account"],
    ("POST", "/api/v1/sessions"): ["account"],
    ("GET", "/api/v1/current-session"): ["account"],
    ("POST", "/api/v1/session-refreshes"): ["account"],
    ("DELETE", "/api/v1/current-session"): ["account"],
    ("GET", "/api/v1/google-authorization"): ["account"],
    ("POST", "/api/v1/google-sessions"): ["account"],
}


def test_the_tags_follow_the_contract(production_app: FastAPI) -> None:
    document = production_app.openapi()
    operations = _operations(document)

    assert [entry["name"] for entry in document["tags"]] == ["account", "health"]
    assert {key: op["tags"] for key, op in operations.items()} == EXPECTED_OPERATION_TAGS


# --- the checker on deliberately broken documents --------------------------------------


class Thing(ResponseModel):
    """A test-only payload."""

    thing_name: str


def _small_app(
    router: APIRouter, tags: list[str | Enum] | None, declared: list[dict[str, str]]
) -> FastAPI:
    app = FastAPI(openapi_tags=declared)

    @router.get("/things")
    def list_things() -> ApiResponse[Thing]:
        raise NotImplementedError

    app.include_router(router, prefix="/api/v1", tags=tags)
    return app


DECLARED = [{"name": "thing", "description": "Things for the test."}]


def test_an_operation_without_a_tag_is_reported() -> None:
    document = _small_app(APIRouter(), None, DECLARED).openapi()

    assert collect_tag_violations(document) == [
        TagViolation("tag-count", "GET", "/api/v1/things", ())
    ]


def test_an_operation_with_two_tags_is_reported() -> None:
    document = _small_app(APIRouter(tags=["thing"]), ["thing"], DECLARED).openapi()

    assert collect_tag_violations(document) == [
        TagViolation("tag-count", "GET", "/api/v1/things", ("thing", "thing"))
    ]


def test_an_operation_with_an_undeclared_tag_is_reported() -> None:
    document = _small_app(APIRouter(), ["things"], DECLARED).openapi()

    assert collect_tag_violations(document) == [
        TagViolation("undeclared-tag", "GET", "/api/v1/things", ("things",))
    ]


@pytest.mark.parametrize("description", ["", "   "])
def test_a_blank_top_level_description_is_reported(description: str) -> None:
    declared = [{"name": "thing", "description": description}]
    document = _small_app(APIRouter(), ["thing"], declared).openapi()

    assert collect_tag_violations(document) == [
        TagViolation("blank-description", "", "", ("thing",))
    ]
