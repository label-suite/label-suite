"""Unit tests for ``app.mail.service.MailService`` (design D3, D4, D5).

Spec ``mail-delivery``: "沒有設定寄信服務時不嘗試寄信", the API side of "排入背景的信由背景工作
寄出" (queue, arguments, masking, JSON round trip), "同一封信的每次嘗試帶同一個冪等鍵" (two
mails, two keys), "當場寄只嘗試一次並當場回報", "排不進佇列時明確回報" and "主旨含換行時拒絕"
(nothing reaches the queue or the provider). Publishing is recorded by ``PublishSpy``;
the provider is the ``httpx`` stand-in.
"""

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path

import pytest
from kombu.exceptions import OperationalError

from app.core.celery_app import create_celery_app
from app.core.config import WorkerSettings
from app.mail import (
    DispatchStatus,
    MailMessage,
    MailQueueUnavailableError,
    MailService,
    OutcomeStatus,
)
from tests.support.mail import ConnectionAttempts, PublishSpy, sample_message, worker_settings
from tests.support.resend import FakeResend

CANARIES = ("CANARY-link", "CANARY-pw", "CANARY-key", "user@example.com")


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> FakeResend:
    fake = FakeResend()
    fake.install(monkeypatch)
    return fake


@pytest.fixture
def publish(monkeypatch: pytest.MonkeyPatch) -> PublishSpy:
    return PublishSpy().install(monkeypatch)


@pytest.fixture
def connections(monkeypatch: pytest.MonkeyPatch) -> ConnectionAttempts:
    return ConnectionAttempts().install(monkeypatch)


def _service(settings: WorkerSettings) -> MailService:
    return MailService(settings, create_celery_app(settings))


def _assert_no_canary(text: str) -> None:
    for canary in CANARIES:
        assert canary not in text, canary


def _is_uuid4(value: str | None) -> bool:
    return value is not None and uuid.UUID(value).version == 4 and str(uuid.UUID(value)) == value


# --- not configured (mail-delivery 沒有設定寄信服務時不嘗試寄信) ---------------------------


async def test_without_mail_settings_neither_way_sends_or_queues(
    tmp_path: Path,
    resend: FakeResend,
    connections: ConnectionAttempts,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    caplog.set_level(logging.DEBUG)
    service = _service(worker_settings(tmp_path, configured=False))
    message = sample_message(text="CANARY-link")

    dispatch = await service.enqueue(message)
    outcome = await service.send_now(message)

    assert (dispatch.status, dispatch.mail_id) == (DispatchStatus.NOT_CONFIGURED, None)
    assert (outcome.status, outcome.mail_id) == (OutcomeStatus.NOT_CONFIGURED, None)
    assert resend.requests == []
    assert connections.count == 0
    output = capsys.readouterr()
    _assert_no_canary(caplog.text + output.out + output.err)
    assert "app.mail.unsent_link" not in output.err


# --- enqueue (mail-delivery 排入背景的信由背景工作寄出) ------------------------------------


async def test_enqueue_publishes_one_masked_task_to_the_default_queue(
    tmp_path: Path, resend: FakeResend, publish: PublishSpy
) -> None:
    message = sample_message(html="<p>CANARY-link</p>")

    dispatch = await _service(worker_settings(tmp_path)).enqueue(message)

    assert dispatch.status is DispatchStatus.QUEUED
    assert _is_uuid4(dispatch.mail_id)
    [(body, kwargs)] = publish.calls
    assert kwargs["routing_key"] == "default"
    assert kwargs["serializer"] == "json"
    assert kwargs["headers"]["task"] == "app.mail.tasks.send_mail"
    assert kwargs["headers"]["argsrepr"] == "()"
    assert kwargs["headers"]["kwargsrepr"] == "{redacted}"
    assert "CANARY-link" not in json.dumps(kwargs["headers"])
    args, task_kwargs, _ = json.loads(json.dumps(body))
    assert args == []
    assert set(task_kwargs) == {"mail_id", "payload"}
    assert set(task_kwargs["payload"]) == {"to", "subject", "text", "html", "kind"}
    assert task_kwargs["mail_id"] == dispatch.mail_id
    assert MailMessage.from_task_payload(task_kwargs["payload"]) == message
    assert resend.requests == []


async def test_two_identical_mails_get_two_mail_ids(tmp_path: Path, publish: PublishSpy) -> None:
    service = _service(worker_settings(tmp_path))

    first = await service.enqueue(sample_message())
    second = await service.enqueue(sample_message())

    assert first.mail_id != second.mail_id
    keys = [body[1]["mail_id"] for body, _ in publish.calls]
    assert keys == [first.mail_id, second.mail_id]


async def test_eager_enqueue_sends_in_process_without_touching_the_queue(
    tmp_path: Path, resend: FakeResend, connections: ConnectionAttempts
) -> None:
    service = _service(worker_settings(tmp_path, eager=True))

    first = await service.enqueue(sample_message())
    second = await service.enqueue(sample_message())

    assert first.status is DispatchStatus.QUEUED
    assert resend.idempotency_keys == [first.mail_id, second.mail_id]
    assert connections.count == 0


# --- queue unavailable (mail-delivery 排不進佇列時明確回報) ---------------------------------


async def test_an_unreachable_queue_fails_fast_with_an_empty_error(
    tmp_path: Path,
    resend: FakeResend,
    connections: ConnectionAttempts,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    caplog.set_level(logging.DEBUG)
    service = _service(worker_settings(tmp_path))
    started = time.monotonic()

    with pytest.raises(MailQueueUnavailableError) as excinfo:
        await service.enqueue(sample_message(text="CANARY-link"))

    assert time.monotonic() - started < 10
    assert connections.count > 0
    assert str(excinfo.value) == ""
    assert excinfo.value.__suppress_context__ is True
    assert resend.requests == []
    warnings = [r for r in caplog.records if "outcome=queue_unavailable" in r.getMessage()]
    assert len(warnings) == 1
    assert warnings[0].levelno == logging.WARNING
    assert warnings[0].exc_info is None
    output = capsys.readouterr()
    _assert_no_canary(caplog.text + output.out + output.err)


async def test_a_publish_error_becomes_queue_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    PublishSpy(error=OperationalError("CANARY-pw broker down")).install(monkeypatch)

    with pytest.raises(MailQueueUnavailableError):
        await _service(worker_settings(tmp_path)).enqueue(sample_message())

    [line] = [r for r in caplog.records if r.name == "app.mail"]
    assert "excType=kombu.exceptions.OperationalError" in line.getMessage()
    assert "CANARY-pw" not in caplog.text


async def test_an_unexpected_publish_error_is_not_swallowed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Only queue errors become MailQueueUnavailableError; a broken install (such as a
    # transport whose dependency is missing) must fail loudly, not look like a queue
    # outage.
    PublishSpy(error=ModuleNotFoundError("packaging")).install(monkeypatch)

    with pytest.raises(ModuleNotFoundError):
        await _service(worker_settings(tmp_path)).enqueue(sample_message())


# --- send_now (mail-delivery 當場寄只嘗試一次並當場回報) ------------------------------------


async def test_send_now_sends_once_and_reports_sent(
    tmp_path: Path, resend: FakeResend, publish: PublishSpy, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)

    outcome = await _service(worker_settings(tmp_path)).send_now(sample_message())

    assert outcome.status is OutcomeStatus.SENT
    assert _is_uuid4(outcome.mail_id)
    assert len(resend.requests) == 1
    assert resend.idempotency_keys == [outcome.mail_id]
    assert publish.calls == []
    [line] = [r for r in caplog.records if r.name == "app.mail"]
    assert "outcome=sent" in line.getMessage()
    assert "mode=now" in line.getMessage()


@pytest.mark.parametrize("answer", [503, 422])
async def test_send_now_reports_failed_after_one_attempt(
    tmp_path: Path,
    resend: FakeResend,
    publish: PublishSpy,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
    answer: int,
) -> None:
    caplog.set_level(logging.DEBUG)
    resend.script(answer, 200)

    outcome = await _service(worker_settings(tmp_path)).send_now(sample_message(text="CANARY-link"))

    assert outcome.status is OutcomeStatus.FAILED
    assert _is_uuid4(outcome.mail_id)
    assert len(resend.requests) == 1
    assert publish.calls == []
    [line] = [r for r in caplog.records if r.name == "app.mail"]
    assert line.levelno == logging.WARNING
    assert f"reason=status_{answer}" in line.getMessage()
    output = capsys.readouterr()
    _assert_no_canary(caplog.text + output.out + output.err)


async def test_send_now_runs_off_the_event_loop(tmp_path: Path, resend: FakeResend) -> None:
    resend.delay_seconds = 0.5
    ticks: list[float] = []

    async def tick() -> None:
        for _ in range(5):
            ticks.append(time.monotonic())
            await asyncio.sleep(0.05)

    started = time.monotonic()
    outcome, _ = await asyncio.gather(
        _service(worker_settings(tmp_path)).send_now(sample_message()), tick()
    )

    assert outcome.status is OutcomeStatus.SENT
    assert ticks[-1] - started < 0.5


# --- validation (mail-delivery 主旨含換行時拒絕) --------------------------------------------


async def test_a_header_injection_is_refused_before_the_queue_or_the_provider(
    resend: FakeResend, publish: PublishSpy
) -> None:
    with pytest.raises(ValueError, match="subject") as excinfo:
        sample_message(subject="Hello\r\nBcc: CANARY-inject@example.com")

    assert "CANARY-inject" not in str(excinfo.value)
    assert resend.requests == []
    assert publish.calls == []
