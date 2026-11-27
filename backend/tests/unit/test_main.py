"""Unit tests for ``create_app`` construction (design D2, D3)."""

from pathlib import Path

import pytest
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ConfigError, Settings
from app.core.csrf import CsrfMiddleware
from app.core.middleware import (
    AccessLogMiddleware,
    CorrelationIdMiddleware,
    LocaleMiddleware,
    UnhandledExceptionMiddleware,
)
from app.main import create_app
from app.modules.account.service import AccountPrincipalLoader
from app.modules.admin.router import router as admin_router
from app.modules.admin.service import AdminPermissionMatrixProvider


def test_create_app_without_settings_reads_the_environment_and_fails_loudly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173/app")

    with pytest.raises(ConfigError) as caught:
        create_app()

    assert "CORS_ALLOWED_ORIGINS" in str(caught.value)
    assert "localhost:5173" not in str(caught.value)


def test_create_app_without_any_setting_names_the_missing_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    with pytest.raises(ConfigError, match="CORS_ALLOWED_ORIGINS"):
        create_app()


def test_middlewares_are_ordered_outermost_first(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            cors_allow_credentials=True,
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    assert [middleware.cls for middleware in app.user_middleware] == [
        CorrelationIdMiddleware,
        CORSMiddleware,
        AccessLogMiddleware,
        UnhandledExceptionMiddleware,
        LocaleMiddleware,
        CsrfMiddleware,
    ]


def test_access_log_skips_only_a_successful_health_check(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    (access,) = [m for m in app.user_middleware if m.cls is AccessLogMiddleware]
    assert access.kwargs == {"quiet_success_routes": frozenset({"/api/v1/health"})}


def test_cors_allows_the_csrf_header(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    (cors,) = [m for m in app.user_middleware if m.cls is CORSMiddleware]
    assert "X-CSRF-Token" in cors.kwargs["allow_headers"]


def test_the_account_principal_loader_is_wired_into_app_state(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    assert isinstance(app.state.principal_loader, AccountPrincipalLoader)


def test_the_admin_matrix_provider_is_wired_and_no_membership_reader_is(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    assert isinstance(app.state.permission_matrix_provider, AdminPermissionMatrixProvider)
    # No module implements the reader yet; a task-scoped check fails loudly (design D7).
    assert not hasattr(app.state, "task_membership_reader")


def test_the_admin_router_has_no_route_and_no_operation_is_tagged_admin(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:5173"],
            database_url=None,
            sqlite_path=tmp_path / "app.db",
        )
    )

    assert admin_router.routes == []
    paths = app.openapi()["paths"].values()
    tags = {tag for item in paths for operation in item.values() for tag in operation["tags"]}
    assert "admin" not in tags
    assert "admin" not in {entry["name"] for entry in app.openapi()["tags"]}
