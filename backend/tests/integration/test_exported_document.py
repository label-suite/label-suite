"""Integration tests for the exported ``openapi.json`` with the health check (task 7.2).

Each test runs the export command into ``tmp_path`` and reads the file back,
except the drift test, which compares a fresh export with the committed file.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.scripts.export_openapi import DEFAULT_OUTPUT, main

pytestmark = pytest.mark.integration

COMPONENT_REF = "#/components/schemas/"


@pytest.fixture
def exported(tmp_path: Path) -> dict[str, Any]:
    """Run the export command and return the written document."""
    output = tmp_path / "openapi.json"
    assert main(["--output", str(output)]) == 0
    document: dict[str, Any] = json.loads(output.read_text(encoding="utf-8"))
    return document


def test_health_operation_id_is_get_health(exported: dict[str, Any]) -> None:
    assert exported["paths"]["/api/v1/health"]["get"]["operationId"] == "getHealth"


def test_every_schema_property_is_camel_case(exported: dict[str, Any]) -> None:
    schemas: dict[str, Any] = exported["components"]["schemas"]

    for name, schema in schemas.items():
        for prop in schema.get("properties", {}):
            assert "_" not in prop, f"{name}.{prop}"
    assert "traceId" in schemas["HealthDataResponse"]["properties"]
    assert "trace_id" not in schemas["HealthDataResponse"]["properties"]


def test_health_components_are_named_after_their_titles(exported: dict[str, Any]) -> None:
    keys = set(exported["components"]["schemas"])

    assert {"HealthDataResponse", "HealthData", "ErrorResponse", "ErrorDetail"} <= keys
    assert not [key for key in keys if "[" in key or "]" in key or key.endswith("_")]


def _ref(response: dict[str, Any]) -> str:
    ref: str = response["content"]["application/json"]["schema"]["$ref"]
    assert ref.startswith(COMPONENT_REF)
    return ref.removeprefix(COMPONENT_REF)


def test_health_declares_its_success_and_error_responses(exported: dict[str, Any]) -> None:
    responses: dict[str, Any] = exported["paths"]["/api/v1/health"]["get"]["responses"]

    assert set(responses) == {"200", "404", "405", "406", "500", "503"}
    assert _ref(responses["200"]) == "HealthDataResponse"
    for status in ("404", "405", "406", "500", "503"):
        assert _ref(responses[status]) == "ErrorResponse", status
    assert "422" not in responses


def test_committed_document_matches_the_code(tmp_path: Path) -> None:
    fresh = tmp_path / "openapi.json"

    assert main(["--output", str(fresh)]) == 0

    assert DEFAULT_OUTPUT.read_bytes() == fresh.read_bytes()
