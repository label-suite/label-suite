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
from app.scripts import export_openapi
from app.scripts.export_openapi import (
    DEFAULT_OUTPUT,
    DOCS_COPY_OUTPUT,
    PLACEHOLDER_SETTINGS,
    main,
    write_outputs,
)

pytestmark = pytest.mark.integration

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


def test_placeholder_settings_name_all_six_fields_explicitly() -> None:
    assert PLACEHOLDER_SETTINGS.model_fields_set == {
        "cors_allowed_origins",
        "cors_allow_credentials",
        "api_docs_enabled",
        "database_url",
        "sqlite_path",
        "auth_secret",
    }
    assert PLACEHOLDER_SETTINGS.database_url is None
    assert PLACEHOLDER_SETTINGS.api_docs_enabled is True


def test_export_never_touches_the_lite_secret_file(tmp_path: Path) -> None:
    # The placeholder carries its own secret, so building the app reads or writes no file.
    assert PLACEHOLDER_SETTINGS.auth_secret is not None
    settings = PLACEHOLDER_SETTINGS.model_copy(update={"sqlite_path": tmp_path / "x.db"})

    create_app(settings)

    assert list(tmp_path.iterdir()) == []


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


def test_docs_copy_output_is_the_architecture_diagrams_copy() -> None:
    repo_root = BACKEND_DIR.parent
    assert DOCS_COPY_OUTPUT == repo_root / "docs" / "diagrams" / "architecture" / "api.openapi.json"


def _patch_default_targets(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Path, Path]:
    """Point both default-target constants into ``tmp_path`` so no repo file is written."""
    backend_copy = tmp_path / "backend" / "openapi.json"
    docs_copy = tmp_path / "docs" / "api.openapi.json"
    backend_copy.parent.mkdir()
    docs_copy.parent.mkdir()
    monkeypatch.setattr(export_openapi, "DEFAULT_OUTPUT", backend_copy)
    monkeypatch.setattr(export_openapi, "DOCS_COPY_OUTPUT", docs_copy)
    return backend_copy, docs_copy


def test_no_arguments_writes_both_targets_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    backend_copy, docs_copy = _patch_default_targets(monkeypatch, tmp_path)

    assert main([]) == 0

    assert backend_copy.read_bytes() == docs_copy.read_bytes()
    assert json.loads(backend_copy.read_text(encoding="utf-8"))["info"]["title"] == (
        "Label Suite API"
    )
    assert sorted(p.name for p in backend_copy.parent.iterdir()) == ["openapi.json"]
    assert sorted(p.name for p in docs_copy.parent.iterdir()) == ["api.openapi.json"]


def test_repeated_default_exports_leave_both_copies_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    backend_copy, docs_copy = _patch_default_targets(monkeypatch, tmp_path)

    assert main([]) == 0
    first = (backend_copy.read_bytes(), docs_copy.read_bytes())
    assert main([]) == 0

    assert (backend_copy.read_bytes(), docs_copy.read_bytes()) == first


def test_output_argument_writes_only_that_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    backend_copy, docs_copy = _patch_default_targets(monkeypatch, tmp_path)
    docs_copy.write_text("sentinel", encoding="utf-8")
    backend_copy.write_text("sentinel", encoding="utf-8")
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    output = out_dir / "custom.json"

    assert main(["--output", str(output)]) == 0

    assert sorted(p.name for p in out_dir.iterdir()) == ["custom.json"]
    assert docs_copy.read_text(encoding="utf-8") == "sentinel"
    assert backend_copy.read_text(encoding="utf-8") == "sentinel"


def test_write_failure_leaves_existing_targets_unchanged_and_no_temp_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    existing = tmp_path / "present" / "openapi.json"
    existing.parent.mkdir()
    existing.write_text("old content", encoding="utf-8")
    missing = tmp_path / "missing_dir" / "api.openapi.json"
    monkeypatch.setattr(export_openapi, "DEFAULT_OUTPUT", existing)
    monkeypatch.setattr(export_openapi, "DOCS_COPY_OUTPUT", missing)

    exit_code = main([])

    assert exit_code == 1
    assert capsys.readouterr().err.strip() != ""
    assert existing.read_text(encoding="utf-8") == "old content"
    assert [p.name for p in existing.parent.iterdir()] == ["openapi.json"]
    assert not missing.parent.exists()


def test_write_failure_on_second_target_cleans_temp_file_of_the_first(tmp_path: Path) -> None:
    first = tmp_path / "a.json"
    first.write_text("old", encoding="utf-8")
    second = tmp_path / "nope" / "b.json"

    with pytest.raises(OSError):
        write_outputs("new", [first, second])

    assert first.read_text(encoding="utf-8") == "old"
    assert [p.name for p in tmp_path.iterdir()] == ["a.json"]


def test_write_outputs_replaces_every_target_with_the_same_text(tmp_path: Path) -> None:
    targets = [tmp_path / "a.json", tmp_path / "b.json"]
    targets[0].write_text("old", encoding="utf-8")

    write_outputs("new\n", targets)

    assert [t.read_text(encoding="utf-8") for t in targets] == ["new\n", "new\n"]
    assert sorted(p.name for p in tmp_path.iterdir()) == ["a.json", "b.json"]


@pytest.mark.parametrize("api_docs_enabled", [True, False])
def test_export_ignores_api_docs_setting(tmp_path: Path, api_docs_enabled: bool) -> None:
    baseline = tmp_path / "baseline.json"
    toggled = tmp_path / "toggled.json"
    assert main(["--output", str(baseline)]) == 0

    settings = PLACEHOLDER_SETTINGS.model_copy(update={"api_docs_enabled": api_docs_enabled})
    assert main(["--output", str(toggled)], app_factory=lambda: create_app(settings)) == 0

    assert toggled.read_bytes() == baseline.read_bytes()
    paths = json.loads(toggled.read_text(encoding="utf-8"))["paths"]
    assert not {"/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"} & set(paths)
