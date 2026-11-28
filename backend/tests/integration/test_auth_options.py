"""Integration tests for ``GET /api/v1/auth-options`` and the Lite-tier secret (task 4.2).

Spec ``account-login`` "登入頁設定只回兩個部署開關"; spec ``runtime-config``: "三個都不設時
沒有 Google", "寄信服務只看有沒有設定", the sign-in part of "Lite 層沒設時自動產生並重用" and
"刪掉產生的秘密後所有登入狀態失效". Settings come from the environment, the way the
service starts.
"""

import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.auth_secret import KEY_FILE_NAME
from app.core.config import ConfigError, DatabaseSettings
from app.core.db import create_engine
from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN, TEST_AUTH_SECRET, run_alembic
from tests.factories.accounts import add_user
from tests.support.browser import Browser

pytestmark = pytest.mark.integration

OPTIONS = "/api/v1/auth-options"
_ENV = (
    "DATABASE_URL",
    "AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "RESEND_API_KEY",
    "MAIL_FROM",
    "REDIS_URL",
    "CELERY_TASK_ALWAYS_EAGER",
)
MAIL_FROM = "Label Suite <noreply@example.test>"


@asynccontextmanager
async def _serve(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


def _environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, **values: str) -> None:
    for name in _ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ALLOWED_ORIGIN)
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "lite.db"))
    for name, value in values.items():
        monkeypatch.setenv(name, value)


async def _options() -> dict[str, bool]:
    async with _serve(create_app()) as http:
        response = await http.get(OPTIONS)
    assert response.status_code == 200
    data: dict[str, bool] = response.json()["data"]
    return data


async def test_mail_without_google(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _environment(
        monkeypatch,
        tmp_path,
        AUTH_SECRET=TEST_AUTH_SECRET,
        RESEND_API_KEY="re_test",
        MAIL_FROM=MAIL_FROM,
    )

    assert await _options() == {"selfRegistrationEnabled": True, "googleEnabled": False}


async def test_all_three_google_settings_enable_google(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    google = {
        "GOOGLE_CLIENT_ID": "client-id",
        "GOOGLE_CLIENT_SECRET": secrets.token_urlsafe(16),
        "GOOGLE_REDIRECT_URI": "http://localhost:5173/account/google/callback",
    }
    _environment(monkeypatch, tmp_path, AUTH_SECRET=TEST_AUTH_SECRET, **google)

    assert await _options() == {"selfRegistrationEnabled": False, "googleEnabled": True}


async def test_nothing_set_means_neither(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _environment(monkeypatch, tmp_path, AUTH_SECRET=TEST_AUTH_SECRET)

    assert await _options() == {"selfRegistrationEnabled": False, "googleEnabled": False}


async def test_empty_mail_settings_mean_no_mail(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _environment(
        monkeypatch, tmp_path, AUTH_SECRET=TEST_AUTH_SECRET, RESEND_API_KEY="", MAIL_FROM=""
    )

    assert (await _options())["selfRegistrationEnabled"] is False


async def test_a_mail_key_without_a_sender_stops_the_service(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _environment(monkeypatch, tmp_path, AUTH_SECRET=TEST_AUTH_SECRET, RESEND_API_KEY="re_CANARY")

    with pytest.raises(ConfigError) as excinfo:
        create_app()

    assert "MAIL_FROM" in str(excinfo.value)
    assert "re_CANARY" not in str(excinfo.value)


async def test_options_need_no_cookie_and_reveal_no_settings(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _environment(
        monkeypatch,
        tmp_path,
        AUTH_SECRET=TEST_AUTH_SECRET,
        RESEND_API_KEY="re_CANARY",
        MAIL_FROM="CANARY-from@example.test",
    )

    async with _serve(create_app()) as http:
        response = await http.get(OPTIONS)

    assert "re_CANARY" not in response.text
    assert "CANARY-from" not in response.text
    assert set(response.json()["data"]) == {"selfRegistrationEnabled", "googleEnabled"}


# --- the generated Lite-tier secret --------------------------------------------------------


async def _lite_account(tmp_path: Path) -> None:
    engine = create_engine(DatabaseSettings(database_url=None, sqlite_path=tmp_path / "lite.db"))
    try:
        await run_alembic(engine, "upgrade", "head")
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await add_user(db)
    finally:
        await engine.dispose()


async def test_a_lite_session_survives_a_restart_and_dies_with_the_secret(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _environment(monkeypatch, tmp_path)
    await _lite_account(tmp_path)

    async with _serve(create_app()) as http:
        first = Browser(http)
        assert (await first.sign_in()).status_code == 201
    cookies = dict(first.cookies)
    secret_file = tmp_path / KEY_FILE_NAME
    assert secret_file.stat().st_mode & 0o777 == 0o600

    async with _serve(create_app()) as http:
        again = Browser(http)
        again.cookies = dict(cookies)
        assert (await again.me()).status_code == 200

    secret_file.unlink()
    async with _serve(create_app()) as http:
        after = Browser(http)
        after.cookies = dict(cookies)
        response = await after.me()
    assert (response.status_code, response.json()["code"]) == (401, "AUTH_REQUIRED")
