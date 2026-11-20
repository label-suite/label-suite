"""Unit tests for ``create_app`` construction (design D2)."""

import pytest

from app.core.config import ConfigError
from app.main import create_app


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
