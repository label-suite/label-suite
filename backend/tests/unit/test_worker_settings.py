"""Unit tests for the settings layer the API and the worker share (email-celery-worker 1.2).

Spec ``runtime-config``: the queue and mail defaults of "其餘設定都有預設值", "寄信服務只看
有沒有設定" (only one of the two mail settings), "行程內同步執行背景工作只限 Lite 層" (the
production tier), "佇列位址在啟動時驗證" and "worker 只需要自己的設定"; spec ``mail-delivery``
"寄件人設定含換行時拒絕啟動". Each rejection is checked through both ``Settings`` (the API)
and ``WorkerSettings`` (the worker), since both must refuse to start.
"""

from pathlib import Path

import pytest

from app.core.config import (
    ConfigError,
    DatabaseSettings,
    Settings,
    WorkerSettings,
    load_settings,
)
from tests.unit.test_config import ENV_VARS, VALID_MAIL_FROM, VALID_ORIGIN


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


# --- defaults of the queue and mail settings (runtime-config 其餘設定都有預設值) -------


def test_queue_and_mail_settings_default_to_local_redis_no_eager_and_no_mail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)

    settings = load_settings(Settings)

    assert settings.redis_url == "redis://localhost:6379"
    assert settings.broker_url() == "redis://localhost:6379/0"
    assert settings.celery_task_always_eager is False
    assert settings.mail_from is None
    assert settings.mail_configured() is False


@pytest.mark.parametrize(("raw", "expected"), [("true", True), ("false", False)])
def test_eager_reads_explicit_boolean(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: bool
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", raw)

    assert load_settings(Settings).celery_task_always_eager is expected


@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_eager_rejects_non_boolean_without_echoing_value(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings]
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "CANARY-maybe")

    error = _load_error(cls)

    assert "CELERY_TASK_ALWAYS_EAGER" in str(error)
    assert "CANARY-maybe" not in str(error)


# --- eager only on the Lite tier (runtime-config 行程內同步執行背景工作只限 Lite 層) -------


@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_eager_with_database_url_fails_without_echoing_the_url(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings]
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("AUTH_SECRET", "x" * 32)
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:CANARY-pw@db/app")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")

    error = _load_error(cls)

    assert str(error).startswith("CELERY_TASK_ALWAYS_EAGER: ")
    assert "CANARY-pw" not in str(error)


def test_eager_is_accepted_on_the_lite_tier(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")

    assert load_settings(Settings).celery_task_always_eager is True


def test_eager_off_with_database_url_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@db/app")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "false")

    assert load_settings(WorkerSettings).celery_task_always_eager is False


# --- REDIS_URL (runtime-config 佇列位址在啟動時驗證) ------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "http://CANARY-host:6379",
        "redis://CANARY-host:6379/3",
        "redis://CANARY-host:6379/0",
        "redis+socket://CANARY-host",
        "redis://:CANARY-host@",
        "redis://CANARY-host:notaport",
        "redis://CANARY-host:6379#frag",
        "CANARY-host:6379",
    ],
)
@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_bad_redis_url_fails_without_echoing_the_value(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings], value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("REDIS_URL", value)

    error = _load_error(cls)

    assert str(error).startswith("REDIS_URL: ")
    assert "CANARY" not in str(error)


def test_empty_redis_url_falls_back_to_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("REDIS_URL", "")

    settings = load_settings(Settings)

    assert settings.redis_url == "redis://localhost:6379"
    assert settings.broker_url() == "redis://localhost:6379/0"


def test_rediss_url_keeps_its_query_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REDIS_URL", "rediss://redis.example.test:6380?ssl_cert_reqs=required")

    settings = load_settings(WorkerSettings)

    assert settings.broker_url() == "rediss://redis.example.test:6380/0?ssl_cert_reqs=required"
    assert (
        settings.result_backend_url() == "rediss://redis.example.test:6380/1?ssl_cert_reqs=required"
    )


def test_broker_and_result_backend_use_databases_zero_and_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379")

    settings = load_settings(WorkerSettings)

    assert settings.broker_url() == "redis://redis:6379/0"
    assert settings.result_backend_url() == "redis://redis:6379/1"


def test_redis_url_with_a_bare_slash_path_and_credentials_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://:pw@redis:6379/")

    settings = load_settings(WorkerSettings)

    assert settings.broker_url() == "redis://:pw@redis:6379/0"
    assert settings.result_backend_url() == "redis://:pw@redis:6379/1"


# --- RESEND_API_KEY and MAIL_FROM together (runtime-config 寄信服務只看有沒有設定) -------


@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_api_key_without_sender_fails_naming_mail_from(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings]
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("RESEND_API_KEY", "re_CANARY-key")

    error = _load_error(cls)

    lines = str(error).splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("MAIL_FROM: ")
    assert "re_CANARY-key" not in str(error)


@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_sender_without_api_key_fails_naming_resend_api_key(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings]
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("MAIL_FROM", "CANARY-from@example.test")

    error = _load_error(cls)

    lines = str(error).splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("RESEND_API_KEY: ")
    assert "CANARY-from" not in str(error)


def test_api_key_with_an_empty_sender_fails_naming_mail_from(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("RESEND_API_KEY", "re_CANARY-key")
    monkeypatch.setenv("MAIL_FROM", "")

    error = _load_error()

    assert str(error).startswith("MAIL_FROM: ")


def test_both_empty_mail_settings_mean_no_mail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("RESEND_API_KEY", "")
    monkeypatch.setenv("MAIL_FROM", "")

    settings = load_settings(Settings)

    assert settings.resend_api_key is None
    assert settings.mail_from is None
    assert settings.mail_configured() is False


def test_worker_settings_see_the_same_mail_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", VALID_MAIL_FROM)

    settings = load_settings(WorkerSettings)

    assert settings.mail_configured() is True
    assert settings.mail_from == VALID_MAIL_FROM


# --- MAIL_FROM with a line break (mail-delivery 寄件人設定含換行時拒絕啟動) ---------------


@pytest.mark.parametrize(
    "value",
    [
        "noreply@example.test\r\nBcc: CANARY-inject@example.com",
        "noreply@example.test\nBcc: CANARY-inject@example.com",
        "noreply@example.test\rBcc: CANARY-inject@example.com",
    ],
)
@pytest.mark.parametrize("cls", [Settings, WorkerSettings])
def test_sender_with_a_line_break_fails_without_echoing_the_value(
    monkeypatch: pytest.MonkeyPatch, cls: type[DatabaseSettings], value: str
) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", value)

    error = _load_error(cls)

    assert str(error).startswith("MAIL_FROM: ")
    assert "CANARY-inject" not in str(error)


# --- the worker's own settings layer (runtime-config worker 只需要自己的設定) ------------


def test_worker_settings_load_without_api_only_settings_on_the_lite_tier() -> None:
    settings = load_settings(WorkerSettings)

    assert settings.is_lite() is True
    assert settings.log_level == "INFO"
    assert "cors_allowed_origins" not in WorkerSettings.model_fields
    assert "auth_secret" not in WorkerSettings.model_fields


def test_worker_settings_load_without_auth_secret_on_the_production_tier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@db/app")

    settings = load_settings(WorkerSettings)

    assert settings.is_lite() is False


def test_worker_settings_reject_a_bad_log_level_without_echoing_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LOG_LEVEL", "CANARY-verbose")

    error = _load_error(WorkerSettings)

    assert "LOG_LEVEL" in str(error)
    assert "CANARY-verbose" not in str(error)


def test_worker_settings_read_log_level_case_insensitively(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LOG_LEVEL", "warning")

    assert load_settings(WorkerSettings).log_level == "WARNING"


def test_settings_extend_the_worker_layer() -> None:
    assert issubclass(Settings, WorkerSettings)
    assert issubclass(WorkerSettings, DatabaseSettings)
    assert "log_level" in WorkerSettings.model_fields
    assert "log_level" not in DatabaseSettings.model_fields


def test_database_settings_ignore_the_queue_and_mail_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REDIS_URL", "CANARY-not-a-url")
    monkeypatch.setenv("RESEND_API_KEY", "re_CANARY")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "CANARY")

    settings = load_settings(DatabaseSettings)

    assert not hasattr(settings, "redis_url")
