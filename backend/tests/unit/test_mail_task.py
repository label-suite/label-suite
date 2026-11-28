"""Unit tests for the ``send_mail`` Celery task (design D6, D8).

The task runs through ``Task.apply``, which validates the arguments and runs retries
in-process but never touches a broker; the provider is the ``httpx`` stand-in. Retry
delays are read from Celery's ``task_retry`` signal instead of waiting. Covers the
worker side of spec ``mail-delivery``: "排入背景工作的信寄出成功", "暫時性失敗以有界次數重試",
"同一封信的每次嘗試帶同一個冪等鍵" and "永久性失敗與重試用盡記為最終失敗".
"""

import logging
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from celery import Celery, signals
from pydantic import SecretStr

from app.core.celery_app import create_celery_app
from app.core.config import WorkerSettings
from app.mail import tasks
from app.mail.message import MailMessage
from tests.support.resend import FakeResend

SENDER = "Label Suite <noreply@example.test>"


def _settings(tmp_path: Path, *, configured: bool = True) -> WorkerSettings:
    return WorkerSettings(
        database_url=None,
        sqlite_path=tmp_path / "lite.db",
        redis_url="redis://127.0.0.1:1",
        resend_api_key=SecretStr("re_test-key") if configured else None,
        mail_from=SENDER if configured else None,
        celery_task_always_eager=False,
        log_level="INFO",
    )


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> FakeResend:
    fake = FakeResend()
    fake.install(monkeypatch)
    return fake


@pytest.fixture
def retry_delays() -> Iterator[list[float]]:
    delays: list[float] = []

    def record(reason: Any = None, **_: Any) -> None:
        delays.append(reason.when)

    signals.task_retry.connect(record, weak=False)
    try:
        yield delays
    finally:
        signals.task_retry.disconnect(record)


def _run(app: Celery, mail_id: str, body: str = "body") -> None:
    message = MailMessage(
        to="user@example.com", subject="Welcome", text=body, html=None, kind="signup_verify"
    )
    app.tasks[tasks.SEND_MAIL_TASK_NAME].apply(
        kwargs={"mail_id": mail_id, "payload": message.to_task_payload()}
    )


def _mail_lines(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == tasks.LOGGER_NAME]


def test_a_queued_mail_is_sent_once_and_logged(
    tmp_path: Path, resend: FakeResend, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    mail_id = str(uuid.uuid4())

    _run(create_celery_app(_settings(tmp_path)), mail_id)

    assert len(resend.requests) == 1
    body = resend.requests[0].body
    assert (body["from"], body["to"], body["subject"], body["text"]) == (
        SENDER,
        ["user@example.com"],
        "Welcome",
        "body",
    )
    [line] = _mail_lines(caplog)
    assert line.levelno == logging.INFO
    message = line.getMessage()
    assert f"mailId={mail_id} " in message
    assert "outcome=sent" in message
    assert "attempt=1" in message
    assert "mode=queued" in message
    assert "providerMessageId=provider-1" in message


def test_a_temporary_failure_is_retried_after_60_seconds_with_the_same_key(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    resend.script(503, 200)
    mail_id = str(uuid.uuid4())

    _run(create_celery_app(_settings(tmp_path)), mail_id)

    assert retry_delays == [60]
    assert resend.idempotency_keys == [mail_id, mail_id]
    retry, sent = (line.getMessage() for line in _mail_lines(caplog))
    assert "outcome=retry" in retry
    assert "attempt=1" in retry
    assert "reason=status_503" in retry
    assert "outcome=sent" in sent
    assert "attempt=2" in sent


CONCURRENT_409 = (409, '{"statusCode": 409, "name": "concurrent_idempotent_requests"}')


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        (httpx.ConnectError, "connect_error"),
        (httpx.ReadTimeout, "timeout"),
        (429, "status_429"),
        (CONCURRENT_409, "status_409"),
    ],
)
def test_connection_errors_timeouts_and_429_are_retried(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
    answer: int | type[httpx.TransportError] | tuple[int, str],
    reason: str,
) -> None:
    caplog.set_level(logging.INFO)
    resend.script(answer, 200)

    _run(create_celery_app(_settings(tmp_path)), str(uuid.uuid4()))

    assert retry_delays == [60]
    assert f"reason={reason}" in _mail_lines(caplog)[0].getMessage()


def test_retries_wait_60_180_and_540_seconds_then_give_up(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    resend.script(503, 503, 503, 503, 200)

    _run(create_celery_app(_settings(tmp_path)), str(uuid.uuid4()), body="CANARY-link")

    assert retry_delays == [60, 180, 540]
    assert len(resend.requests) == 4
    final = _mail_lines(caplog)[-1]
    assert final.levelno == logging.ERROR
    assert "outcome=failed" in final.getMessage()
    assert "attempts=4" in final.getMessage()
    assert "reason=retries_exhausted" in final.getMessage()
    assert "CANARY-link" not in caplog.text


def test_an_invalid_idempotent_request_409_is_not_retried(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    resend.script((409, '{"statusCode": 409, "name": "invalid_idempotent_request"}'))

    _run(create_celery_app(_settings(tmp_path)), str(uuid.uuid4()))

    assert retry_delays == []
    [line] = _mail_lines(caplog)
    assert "outcome=failed" in line.getMessage()
    assert "reason=status_409" in line.getMessage()


@pytest.mark.parametrize("status", [401, 403, 422])
def test_a_permanent_failure_is_not_retried(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
    status: int,
) -> None:
    caplog.set_level(logging.INFO)
    resend.script(status)

    _run(create_celery_app(_settings(tmp_path)), str(uuid.uuid4()))

    assert retry_delays == []
    assert len(resend.requests) == 1
    [line] = _mail_lines(caplog)
    assert line.levelno == logging.ERROR
    assert "outcome=failed" in line.getMessage()
    assert "attempts=1" in line.getMessage()
    assert f"reason=status_{status}" in line.getMessage()


def test_a_worker_without_mail_settings_fails_the_mail_without_a_request(
    tmp_path: Path,
    resend: FakeResend,
    retry_delays: list[float],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)

    _run(create_celery_app(_settings(tmp_path, configured=False)), str(uuid.uuid4()))

    assert resend.requests == []
    assert retry_delays == []
    [line] = _mail_lines(caplog)
    assert line.levelno == logging.ERROR
    assert "outcome=failed" in line.getMessage()
    assert "reason=not_configured_in_worker" in line.getMessage()


def test_a_tampered_payload_is_failed_without_a_request_or_its_content(
    tmp_path: Path, resend: FakeResend, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    app = create_celery_app(_settings(tmp_path))
    payload = {"to": "x@example.com", "subject": "a\r\nCANARY-inject", "text": "b"}

    app.tasks[tasks.SEND_MAIL_TASK_NAME].apply(
        kwargs={"mail_id": str(uuid.uuid4()), "payload": payload}
    )

    assert resend.requests == []
    [line] = _mail_lines(caplog)
    assert "outcome=failed" in line.getMessage()
    assert "reason=" not in line.getMessage()
    assert "CANARY-inject" not in caplog.text


def test_a_malformed_mail_id_is_failed_without_a_request(
    tmp_path: Path, resend: FakeResend, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    app = create_celery_app(_settings(tmp_path))
    message = MailMessage(to="a@example.com", subject="s", text="t", html=None, kind="k")

    app.tasks[tasks.SEND_MAIL_TASK_NAME].apply(
        kwargs={"mail_id": "CANARY\nid", "payload": message.to_task_payload()}
    )

    assert resend.requests == []
    [line] = _mail_lines(caplog)
    assert "mailId=- " in line.getMessage()
    assert "outcome=failed" in line.getMessage()
    assert "CANARY" not in line.getMessage()


def test_the_task_stores_no_result_and_returns_nothing(tmp_path: Path, resend: FakeResend) -> None:
    app = create_celery_app(_settings(tmp_path))
    task = app.tasks[tasks.SEND_MAIL_TASK_NAME]
    message = MailMessage(to="a@example.com", subject="s", text="t", html=None, kind="k")

    result = task.apply(kwargs={"mail_id": str(uuid.uuid4()), "payload": message.to_task_payload()})

    assert task.ignore_result is True
    assert result.get() is None


def test_the_retry_schedule_is_bounded() -> None:
    assert tasks.RETRY_COUNTDOWNS == (60, 180, 540)
    assert tasks.MAX_RETRIES == 3
