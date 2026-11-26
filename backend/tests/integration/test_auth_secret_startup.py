"""Start-up behaviour of the login settings through ``create_app`` (login-auth-guard task 1.2).

Covers the scenarios of spec ``runtime-config`` that need no endpoint: the production tier
without ``AUTH_SECRET`` and a too-short ``AUTH_SECRET`` refuse to start, a partial Google
configuration refuses to start, and the Lite tier without ``AUTH_SECRET`` generates
``auth_secret`` next to the SQLite file with mode ``0600``, reuses it on the next start and
never writes it to the log. The parts that need a login cookie belong to task 4.2.
"""

import io
import stat
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI

from app.core.config import ConfigError
from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN

pytestmark = pytest.mark.integration

LOGIN_ENV_VARS = (
    "AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "RESEND_API_KEY",
)
POSTGRES_URL = "postgresql://user:placeholder@127.0.0.1:5432/app"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Start from only a valid allowed origin and a Lite SQLite file under ``tmp_path``."""
    for name in (*LOGIN_ENV_VARS, "DATABASE_URL", "LOG_LEVEL", "API_DOCS_ENABLED"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ALLOWED_ORIGIN)
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "a.db"))


def _start(monkeypatch: pytest.MonkeyPatch) -> tuple[FastAPI, io.StringIO]:
    """Build the app from the environment with stderr (the log output) in a buffer."""
    stderr = io.StringIO()
    monkeypatch.setattr(sys, "stderr", stderr)
    return create_app(), stderr


def test_production_tier_without_auth_secret_refuses_to_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", POSTGRES_URL)

    with pytest.raises(ConfigError) as caught:
        _start(monkeypatch)

    assert "AUTH_SECRET" in str(caught.value)


def test_empty_auth_secret_on_the_production_tier_refuses_to_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", POSTGRES_URL)
    monkeypatch.setenv("AUTH_SECRET", "")

    with pytest.raises(ConfigError, match="AUTH_SECRET"):
        _start(monkeypatch)


def test_too_short_auth_secret_refuses_to_start(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("AUTH_SECRET", "CANARY-short")

    with pytest.raises(ConfigError) as caught:
        _start(monkeypatch)

    assert "AUTH_SECRET" in str(caught.value)
    assert "CANARY-short" not in str(caught.value)
    assert not (tmp_path / "auth_secret").exists()


def test_partial_google_settings_refuse_to_start(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "CANARY-id")

    with pytest.raises(ConfigError) as caught:
        _start(monkeypatch)

    assert "GOOGLE_CLIENT_SECRET" in str(caught.value)
    assert "GOOGLE_REDIRECT_URI" in str(caught.value)
    assert "CANARY-id" not in str(caught.value)


def test_lite_tier_generates_the_secret_once_and_reuses_it(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    first_app, first_log = _start(monkeypatch)
    secret_file = tmp_path.resolve() / "auth_secret"
    stored = secret_file.read_text(encoding="utf-8")
    second_app, second_log = _start(monkeypatch)

    assert stat.S_IMODE(secret_file.stat().st_mode) == 0o600
    first_secret = first_app.state.settings.auth_secret
    second_secret = second_app.state.settings.auth_secret
    assert first_secret is not None
    assert second_secret is not None
    assert first_secret.get_secret_value() == stored
    assert second_secret.get_secret_value() == stored
    assert f"generated a new secret at {secret_file}" in first_log.getvalue()
    assert f"using the secret stored at {secret_file}" in second_log.getvalue()
    for log in (first_log, second_log):
        assert stored not in log.getvalue()


def test_explicit_auth_secret_writes_no_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("AUTH_SECRET", "s" * 40)

    app, log = _start(monkeypatch)

    assert app.state.settings.auth_secret.get_secret_value() == "s" * 40
    assert not (tmp_path / "auth_secret").exists()
    assert "s" * 40 not in log.getvalue()
