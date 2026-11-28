"""The mail entry as ``create_app`` assembles it (design D3, D4; task 2.6).

Spec ``runtime-config`` "Lite 層開啟 eager 時背景工作不經佇列" and spec ``mail-delivery``
"當場寄執行時其他請求照常回應", through the production assembly: the service comes from
``app.state.mail_service`` and the provider is the ``httpx`` stand-in.
"""

import asyncio
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import celery
import httpx
import pytest
from fastapi import FastAPI
from pydantic import SecretStr

from app.core.celery_app import LabelSuiteCelery, settings_of
from app.core.config import Settings
from app.mail import DispatchStatus, MailService, OutcomeStatus
from app.main import create_app
from tests.conftest import make_test_settings
from tests.support.mail import CLOSED_PORT_REDIS_URL, SENDER, ConnectionAttempts, sample_message
from tests.support.resend import FakeResend

pytestmark = pytest.mark.integration


def _settings(tmp_path: Path, *, eager: bool = False, configured: bool = True) -> Settings:
    # Eager is for the Lite tier only, so an eager run never uses TEST_DATABASE_URL.
    lite = {"database_url": None} if eager else {}
    return make_test_settings(tmp_path).model_copy(
        update={
            **lite,
            "redis_url": CLOSED_PORT_REDIS_URL,
            "resend_api_key": SecretStr("re_test") if configured else None,
            "mail_from": SENDER if configured else None,
            "celery_task_always_eager": eager,
        }
    )


@asynccontextmanager
async def _serve(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> FakeResend:
    fake = FakeResend()
    fake.install(monkeypatch)
    return fake


def test_create_app_puts_the_mail_service_and_the_default_celery_app_in_state(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)

    app = create_app(settings)

    assert isinstance(app.state.mail_service, MailService)
    assert isinstance(app.state.celery_app, LabelSuiteCelery)
    assert settings_of(app.state.celery_app) == app.state.settings
    assert celery.current_app._get_current_object() is app.state.celery_app
    assert app.state.celery_app.conf.broker_url == "redis://:CANARY-pw@127.0.0.1:1/0"


async def test_lite_eager_sends_in_process_without_any_queue_connection(
    tmp_path: Path, resend: FakeResend, monkeypatch: pytest.MonkeyPatch
) -> None:
    attempts = ConnectionAttempts().install(monkeypatch)
    app = create_app(_settings(tmp_path, eager=True))

    dispatch = await app.state.mail_service.enqueue(sample_message())

    assert dispatch.status is DispatchStatus.QUEUED
    assert resend.idempotency_keys == [dispatch.mail_id]
    assert attempts.count == 0


async def test_a_slow_send_now_does_not_hold_up_other_requests(
    tmp_path: Path, resend: FakeResend
) -> None:
    resend.delay_seconds = 2.0
    app = create_app(_settings(tmp_path))
    finished: dict[str, float] = {}

    async with _serve(app) as http:

        async def send() -> None:
            outcome = await app.state.mail_service.send_now(sample_message())
            assert outcome.status is OutcomeStatus.SENT
            finished["send_now"] = time.monotonic()

        async def health() -> None:
            await asyncio.sleep(0.1)
            response = await http.get("/api/v1/health")
            assert response.status_code == 200
            finished["health"] = time.monotonic()

        await asyncio.gather(send(), health())

    assert finished["health"] < finished["send_now"]
