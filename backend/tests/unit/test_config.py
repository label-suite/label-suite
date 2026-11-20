"""Unit tests for settings validation and the ``load_settings`` error contract.

Covers the settings-validation part of spec ``runtime-config``: the start-up
failure scenarios for ``CORS_ALLOWED_ORIGINS`` and ``DATABASE_URL``, the
accepted PostgreSQL schemes, and the defaults.
"""

from pathlib import Path

import pytest

from app.core.config import ConfigError, DatabaseSettings, Settings, load_settings

ENV_VARS = ("CORS_ALLOWED_ORIGINS", "CORS_ALLOW_CREDENTIALS", "DATABASE_URL", "SQLITE_PATH")
VALID_ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Start every test from an empty settings environment inside ``tmp_path``."""
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)


def _load_error(cls: type[DatabaseSettings] = Settings) -> ConfigError:
    with pytest.raises(ConfigError) as excinfo:
        load_settings(cls)
    return excinfo.value


# --- CORS_ALLOWED_ORIGINS start-up failures -------------------------------------------


def test_missing_allowed_origins_fails_naming_the_variable() -> None:
    error = _load_error()

    assert "CORS_ALLOWED_ORIGINS" in str(error)


def test_empty_allowed_origins_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "")

    error = _load_error()

    assert "CORS_ALLOWED_ORIGINS" in str(error)


def test_allowed_origins_of_only_separators_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", " , ,")

    error = _load_error()

    assert "CORS_ALLOWED_ORIGINS" in str(error)


@pytest.mark.parametrize("value", ["*", "http://localhost:5173,*"])
def test_wildcard_allowed_origin_fails(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", value)

    error = _load_error()

    assert "CORS_ALLOWED_ORIGINS" in str(error)


@pytest.mark.parametrize(
    "value",
    [
        "http://localhost:5173/app",
        "localhost:5173",
        "ftp://localhost:5173",
        "http://localhost:5173?x=1",
        "http://user@localhost:5173",
    ],
)
def test_malformed_allowed_origin_fails_without_echoing_the_value(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", value)

    error = _load_error()

    message = str(error)
    assert "CORS_ALLOWED_ORIGINS" in message
    assert "localhost:5173" not in message
    assert "localhost" not in message


def test_config_error_drops_the_validation_error_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173/app")

    error = _load_error()

    assert error.__cause__ is None
    assert error.__suppress_context__ is True


def test_config_error_lists_one_line_per_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql://user:CANARY-pw@db/app")

    error = _load_error()

    lines = str(error).splitlines()
    assert any(line.startswith("CORS_ALLOWED_ORIGINS: ") for line in lines)
    assert any(line.startswith("DATABASE_URL: ") for line in lines)


def test_allowed_origins_are_split_on_commas_and_trimmed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS", " http://localhost:5173 , https://app.example.org:8443,"
    )

    settings = load_settings(Settings)

    assert settings.cors_allowed_origins == [
        "http://localhost:5173",
        "https://app.example.org:8443",
    ]


# --- DATABASE_URL ---------------------------------------------------------------------


def test_non_postgresql_database_url_fails_without_echoing_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("DATABASE_URL", "mysql://user:CANARY-pw@db/app")

    error = _load_error()

    message = str(error)
    assert "DATABASE_URL" in message
    assert "CANARY-pw" not in message


@pytest.mark.parametrize(
    "value",
    [
        "postgresql+psycopg://user:CANARY-pw@db/app",
        "postgresql+psycopg2://user:CANARY-pw@db/app",
        "sqlite:///user:CANARY-pw@db/app",
        "user:CANARY-pw@db/app",
    ],
)
def test_other_driver_or_scheme_database_url_fails(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("DATABASE_URL", value)

    error = _load_error()

    message = str(error)
    assert "DATABASE_URL" in message
    assert "CANARY-pw" not in message
    assert "db/app" not in message


@pytest.mark.parametrize(
    "value",
    [
        "postgresql://user:pw@db:5432/app",
        "postgresql+asyncpg://user:pw@db:5432/app",
        "postgres://user:pw@db:5432/app",
    ],
)
def test_accepted_postgresql_schemes_normalise_to_asyncpg(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("DATABASE_URL", value)

    settings = load_settings(Settings)

    assert settings.database_url == "postgresql+asyncpg://user:pw@db:5432/app"
    assert settings.async_database_url() == "postgresql+asyncpg://user:pw@db:5432/app"
    assert settings.is_lite() is False


def test_database_settings_load_without_allowed_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SQLITE_PATH", "lite.db")

    settings = load_settings(DatabaseSettings)

    assert settings.is_lite() is True
    assert settings.sqlite_path == (Path.cwd() / "lite.db").resolve()


def test_database_settings_still_reject_bad_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql://user:CANARY-pw@db/app")

    error = _load_error(DatabaseSettings)

    assert "DATABASE_URL" in str(error)
    assert "CORS_ALLOWED_ORIGINS" not in str(error)
    assert "CANARY-pw" not in str(error)


# --- defaults -------------------------------------------------------------------------


def test_only_allowed_origins_is_required_and_defaults_apply(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)

    settings = load_settings(Settings)

    assert settings.cors_allowed_origins == [VALID_ORIGIN]
    assert settings.cors_allow_credentials is True
    assert settings.database_url is None
    assert settings.is_lite() is True
    expected_path = (Path.cwd() / "data" / "label_suite.db").resolve()
    assert settings.sqlite_path == expected_path
    assert settings.sqlite_path.is_absolute()
    assert settings.async_database_url() == f"sqlite+aiosqlite:///{expected_path}"


def test_allow_credentials_can_be_turned_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("CORS_ALLOW_CREDENTIALS", "false")

    settings = load_settings(Settings)

    assert settings.cors_allow_credentials is False


def test_relative_sqlite_path_becomes_absolute(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("SQLITE_PATH", "nested/dir/lite.db")

    settings = load_settings(Settings)

    assert settings.sqlite_path == (Path.cwd() / "nested" / "dir" / "lite.db").resolve()
