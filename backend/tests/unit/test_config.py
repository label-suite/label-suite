"""Unit tests for settings validation and the ``load_settings`` error contract.

Covers the settings-validation part of spec ``runtime-config``: the start-up
failure scenarios for ``CORS_ALLOWED_ORIGINS`` and ``DATABASE_URL``, the
accepted PostgreSQL schemes, and the defaults.
"""

from pathlib import Path

import pytest

from app.core.config import ConfigError, DatabaseSettings, Settings, load_settings

ENV_VARS = (
    "CORS_ALLOWED_ORIGINS",
    "CORS_ALLOW_CREDENTIALS",
    "DATABASE_URL",
    "SQLITE_PATH",
    "API_DOCS_ENABLED",
    "LOG_LEVEL",
    "AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "RESEND_API_KEY",
)
GOOGLE_VARS = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI")
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


# --- API_DOCS_ENABLED -----------------------------------------------------------------


def test_api_docs_enabled_defaults_to_true(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)

    assert load_settings(Settings).api_docs_enabled is True


@pytest.mark.parametrize(("raw", "expected"), [("true", True), ("false", False)])
def test_api_docs_enabled_reads_explicit_boolean(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: bool
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("API_DOCS_ENABLED", raw)

    assert load_settings(Settings).api_docs_enabled is expected


def test_api_docs_enabled_rejects_non_boolean_without_echoing_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("API_DOCS_ENABLED", "CANARY-maybe")

    error = _load_error(Settings)

    assert "API_DOCS_ENABLED" in str(error)
    assert "CANARY-maybe" not in str(error)


# --- LOG_LEVEL ------------------------------------------------------------------------


def test_log_level_defaults_to_info(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)

    assert load_settings(Settings).log_level == "INFO"


@pytest.mark.parametrize("raw", ["warning", "WARNING", "Warning"])
def test_log_level_is_case_insensitive(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("LOG_LEVEL", raw)

    assert load_settings(Settings).log_level == "WARNING"


@pytest.mark.parametrize("level", ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
def test_log_level_accepts_every_listed_level(monkeypatch: pytest.MonkeyPatch, level: str) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("LOG_LEVEL", level.lower())

    assert load_settings(Settings).log_level == level


@pytest.mark.parametrize("raw", ["CANARY-verbose", "", "NOTSET", "WARN", "10"])
def test_log_level_rejects_other_values_without_echoing_value(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("LOG_LEVEL", raw)

    error = _load_error(Settings)

    assert "LOG_LEVEL" in str(error)


def test_invalid_log_level_error_does_not_echo_the_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("LOG_LEVEL", "CANARY-verbose")

    error = _load_error(Settings)

    assert "LOG_LEVEL" in str(error)
    assert "CANARY-verbose" not in str(error)
    assert "canary" not in str(error).lower()


def test_database_settings_do_not_read_log_level(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOG_LEVEL", "CANARY-verbose")

    settings = load_settings(DatabaseSettings)

    assert not hasattr(settings, "log_level")
    assert "log_level" not in DatabaseSettings.model_fields


# --- AUTH_SECRET, GOOGLE_* and RESEND_API_KEY (login-auth-guard design D4) ------------


def test_login_settings_are_optional_and_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)

    settings = load_settings(Settings)

    assert settings.auth_secret is None
    assert settings.google_client_id is None
    assert settings.google_client_secret is None
    assert settings.google_redirect_uri is None
    assert settings.resend_api_key is None
    assert settings.google_configured() is False
    assert settings.mail_configured() is False


@pytest.mark.parametrize("name", ["AUTH_SECRET", *GOOGLE_VARS, "RESEND_API_KEY"])
def test_empty_login_setting_counts_as_unset(monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv(name, "")

    settings = load_settings(Settings)

    assert getattr(settings, name.lower()) is None


def test_all_three_empty_google_settings_count_as_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    for name in GOOGLE_VARS:
        monkeypatch.setenv(name, "")

    assert load_settings(Settings).google_configured() is False


def test_auth_secret_of_32_characters_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("AUTH_SECRET", "x" * 32)

    settings = load_settings(Settings)

    assert settings.auth_secret is not None
    assert settings.auth_secret.get_secret_value() == "x" * 32


@pytest.mark.parametrize("value", ["CANARY-short", "CANARY" + "y" * 25])
def test_short_auth_secret_fails_without_echoing_the_value(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("AUTH_SECRET", value)

    error = _load_error()

    assert "AUTH_SECRET" in str(error)
    assert "CANARY" not in str(error)
    assert str(len(value)) not in str(error)


def test_secret_settings_are_hidden_from_the_settings_repr(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("AUTH_SECRET", "CANARY-auth-" + "z" * 32)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "CANARY-google-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/account/google/callback")
    monkeypatch.setenv("RESEND_API_KEY", "CANARY-resend")

    text = repr(load_settings(Settings))

    assert "CANARY" not in text


def test_only_google_client_id_fails_naming_the_two_missing_variables(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "CANARY-id")

    error = _load_error()

    lines = str(error).splitlines()
    assert any(line.startswith("GOOGLE_CLIENT_SECRET: ") for line in lines)
    assert any(line.startswith("GOOGLE_REDIRECT_URI: ") for line in lines)
    assert not any(line.startswith("GOOGLE_CLIENT_ID: ") for line in lines)
    assert "CANARY" not in str(error)


def test_two_of_three_google_settings_fails_naming_the_missing_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "CANARY-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "CANARY-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "")

    error = _load_error()

    lines = str(error).splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("GOOGLE_REDIRECT_URI: ")
    assert "CANARY" not in str(error)


def test_all_three_google_settings_mean_google_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/account/google/callback")

    assert load_settings(Settings).google_configured() is True


def test_resend_api_key_means_mail_is_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("RESEND_API_KEY", "re_test")

    assert load_settings(Settings).mail_configured() is True


def test_database_settings_ignore_the_login_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "CANARY-id")
    monkeypatch.setenv("AUTH_SECRET", "CANARY-short")

    settings = load_settings(DatabaseSettings)

    assert "auth_secret" not in DatabaseSettings.model_fields
    assert not hasattr(settings, "google_client_id")
