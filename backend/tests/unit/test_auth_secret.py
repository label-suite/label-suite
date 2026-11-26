"""Unit tests for ``resolve_auth_secret`` (login-auth-guard system-design §AUTH_SECRET 的來源).

Covers the parts of spec ``runtime-config`` "`AUTH_SECRET` 的來源依資料庫層而定" that need no
endpoint: the explicit secret, the production tier refusing to start, and the Lite tier
generating ``auth_secret`` next to the SQLite file with mode ``0600``, reusing it, never
logging it, and producing only one secret when several workers start together.
"""

import logging
import secrets
import stat
import threading
from pathlib import Path

import pytest
from pydantic import SecretStr

from app.core.auth_secret import KEY_FILE_NAME, resolve_auth_secret
from app.core.config import ConfigError, Settings

ORIGIN = "http://localhost:5173"
POSTGRES_URL = "postgresql+asyncpg://user:placeholder@127.0.0.1:5432/app"


def _settings(
    tmp_path: Path, *, database_url: str | None = None, secret: str | None = None
) -> Settings:
    return Settings(
        cors_allowed_origins=[ORIGIN],
        database_url=database_url,
        sqlite_path=tmp_path / "data" / "a.db",
        auth_secret=None if secret is None else SecretStr(secret),
    )


def _secret_file(tmp_path: Path) -> Path:
    return (tmp_path / "data").resolve() / KEY_FILE_NAME


def _mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


# --- an explicit AUTH_SECRET -----------------------------------------------------------


@pytest.mark.parametrize("database_url", [None, POSTGRES_URL])
def test_explicit_secret_is_used_and_no_file_is_touched(
    tmp_path: Path, database_url: str | None
) -> None:
    value = secrets.token_urlsafe(48)

    resolved = resolve_auth_secret(_settings(tmp_path, database_url=database_url, secret=value))

    assert resolved.get_secret_value() == value
    assert not _secret_file(tmp_path).exists()


def test_production_tier_without_secret_fails_naming_the_variable(tmp_path: Path) -> None:
    with pytest.raises(ConfigError) as caught:
        resolve_auth_secret(_settings(tmp_path, database_url=POSTGRES_URL))

    assert str(caught.value).startswith("AUTH_SECRET: ")
    assert "placeholder" not in str(caught.value)
    assert not _secret_file(tmp_path).exists()


# --- the Lite tier without AUTH_SECRET -------------------------------------------------


def test_lite_tier_generates_a_secret_file_with_owner_only_access(tmp_path: Path) -> None:
    resolved = resolve_auth_secret(_settings(tmp_path))

    path = _secret_file(tmp_path)
    assert path.is_file()
    assert _mode(path) == 0o600
    assert path.read_text(encoding="utf-8") == resolved.get_secret_value()
    assert len(resolved.get_secret_value()) >= 32


def test_lite_tier_reuses_the_stored_secret(tmp_path: Path) -> None:
    first = resolve_auth_secret(_settings(tmp_path))
    second = resolve_auth_secret(_settings(tmp_path))

    assert first.get_secret_value() == second.get_secret_value()


def test_lite_tier_generates_a_new_secret_after_the_file_is_deleted(tmp_path: Path) -> None:
    first = resolve_auth_secret(_settings(tmp_path))
    _secret_file(tmp_path).unlink()

    second = resolve_auth_secret(_settings(tmp_path))

    assert first.get_secret_value() != second.get_secret_value()


def test_lite_tier_logs_the_source_and_path_but_never_the_secret(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG, logger="app.core.auth_secret")
    path = _secret_file(tmp_path)

    first = resolve_auth_secret(_settings(tmp_path)).get_secret_value()
    resolve_auth_secret(_settings(tmp_path))

    messages = [record.getMessage() for record in caplog.records]
    assert messages == [
        f"AUTH_SECRET not set; generated a new secret at {path}",
        f"AUTH_SECRET not set; using the secret stored at {path}",
    ]
    assert all(record.levelno == logging.INFO for record in caplog.records)
    assert first not in caplog.text


def test_stored_secret_with_wider_permissions_is_tightened_with_a_warning(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    value = resolve_auth_secret(_settings(tmp_path)).get_secret_value()
    path = _secret_file(tmp_path)
    path.chmod(0o644)
    caplog.set_level(logging.INFO, logger="app.core.auth_secret")

    resolved = resolve_auth_secret(_settings(tmp_path))

    assert resolved.get_secret_value() == value
    assert _mode(path) == 0o600
    assert [r.levelno for r in caplog.records if r.levelno >= logging.WARNING] == [logging.WARNING]
    assert value not in caplog.text


def test_stored_secret_that_is_too_short_fails_without_echoing_it(tmp_path: Path) -> None:
    path = _secret_file(tmp_path)
    path.parent.mkdir(parents=True)
    path.write_text("CANARY-short", encoding="utf-8")
    path.chmod(0o600)

    with pytest.raises(ConfigError) as caught:
        resolve_auth_secret(_settings(tmp_path))

    assert str(caught.value).startswith("AUTH_SECRET: ")
    assert "CANARY" not in str(caught.value)


def test_concurrent_workers_end_up_with_one_secret(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    barrier = threading.Barrier(8)
    results: list[str] = []
    lock = threading.Lock()

    def worker() -> None:
        barrier.wait()
        value = resolve_auth_secret(settings).get_secret_value()
        with lock:
            results.append(value)

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(results) == 8
    assert len(set(results)) == 1
    assert results[0] == _secret_file(tmp_path).read_text(encoding="utf-8")
    assert sorted(p.name for p in _secret_file(tmp_path).parent.iterdir()) == [KEY_FILE_NAME]
