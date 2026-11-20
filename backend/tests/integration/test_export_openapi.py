"""Integration tests for the OpenAPI export command (spec api-schema-export, design D2)."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI

from app.core.schemas import ApiResponse, ResponseModel
from app.main import create_api_router, create_app
from app.scripts.export_openapi import DEFAULT_OUTPUT, PLACEHOLDER_SETTINGS, main

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Item(ResponseModel):
    """A test-only resource."""

    item_name: str


def _run_export_without_environment(output: Path, cwd: Path) -> subprocess.CompletedProcess[str]:
    """Run the export as a module with no environment beyond what Python needs to start."""
    env = {"PATH": os.environ["PATH"], "PYTHONPATH": str(BACKEND_DIR)}
    return subprocess.run(  # noqa: S603 - fixed argv: this interpreter and a module path
        [sys.executable, "-m", "app.scripts.export_openapi", "--output", str(output)],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_export_runs_with_no_environment_variables(tmp_path: Path) -> None:
    output = tmp_path / "openapi.json"

    result = _run_export_without_environment(output, cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    document = json.loads(output.read_text(encoding="utf-8"))
    assert document["info"]["title"] == "Label Suite API"
    # No lifespan, no database: nothing but the output file appears.
    assert sorted(path.name for path in tmp_path.iterdir()) == ["openapi.json"]


def test_repeated_exports_are_byte_identical(tmp_path: Path) -> None:
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"

    assert main(["--output", str(first)]) == 0
    assert main(["--output", str(second)]) == 0

    assert first.read_bytes() == second.read_bytes()


def test_export_writes_sorted_keys_indent_two_and_a_trailing_newline(tmp_path: Path) -> None:
    output = tmp_path / "openapi.json"

    assert main(["--output", str(output)]) == 0

    text = output.read_text(encoding="utf-8")
    document = create_app(PLACEHOLDER_SETTINGS).openapi()
    assert text == json.dumps(document, sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def test_default_output_is_backend_openapi_json() -> None:
    assert DEFAULT_OUTPUT == BACKEND_DIR / "openapi.json"


def test_placeholder_settings_name_all_four_fields_explicitly() -> None:
    assert PLACEHOLDER_SETTINGS.model_fields_set == {
        "cors_allowed_origins",
        "cors_allow_credentials",
        "database_url",
        "sqlite_path",
    }
    assert PLACEHOLDER_SETTINGS.database_url is None


def _app_with_duplicate_operation_ids() -> FastAPI:
    """Build the real app, but with two routes that both name themselves getItem."""
    app = create_app(PLACEHOLDER_SETTINGS)
    api = create_api_router()
    inner = APIRouter()

    @inner.get("/items/{itemId}")
    def first(itemId: int) -> ApiResponse[Item]: ...

    @inner.get("/admin/items/{itemId}")
    def second(itemId: int) -> ApiResponse[Item]: ...

    api.include_router(inner)
    app.include_router(api)
    return app


def test_export_fails_and_writes_nothing_on_duplicate_operation_ids(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    output = tmp_path / "openapi.json"

    exit_code = main(["--output", str(output)], app_factory=_app_with_duplicate_operation_ids)

    assert exit_code != 0
    error = capsys.readouterr().err
    assert "getItem" in error
    assert "/api/v1/items/{itemId}" in error
    assert "/api/v1/admin/items/{itemId}" in error
    assert not output.exists()
