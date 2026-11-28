"""Canary test: no mail content in any log output on any path (design D6, D8; task 2.7).

Spec ``mail-delivery`` "寄信紀錄只寫允許的欄位" (both scenarios) and "信件參數與紀錄不含測試集
答案" › "寄信參數只有信件識別碼與內容欄位". One run at ``LOG_LEVEL=DEBUG`` walks the five
paths (sent, retried then sent, retries exhausted, not configured, queue unavailable)
while collecting this repository's formatted output, ``caplog`` (every record that
reaches the root logger, Celery's and kombu's included) and stdout and stderr.
"""

import io
import json
import logging
import re
import uuid
from pathlib import Path

import pytest
from pydantic import SecretStr

from app.core.celery_app import create_celery_app
from app.core.config import WorkerSettings
from app.core.log_config import configure_logging
from app.mail import MailMessage, MailQueueUnavailableError, MailService
from app.mail.tasks import SEND_MAIL_TASK_NAME
from tests.support.mail import CLOSED_PORT_REDIS_URL, SENDER, PublishSpy
from tests.support.resend import FakeResend

CANARIES = (
    "canary-to",
    "canary-domain",
    "CANARY-subject",
    "CANARY-body",
    "CANARY-link",
    "CANARY-provider",
    "CANARY-key",
    "CANARY-pw",
)
REASON = re.compile(
    r"^(status_\d{3}|timeout|connect_error|retries_exhausted|not_configured_in_worker)$"
)
PROVIDER_ERROR = (503, '{"message": "CANARY-provider canary-to@canary-domain.example"}')


def _settings(tmp_path: Path, *, configured: bool) -> WorkerSettings:
    return WorkerSettings(
        database_url=None,
        sqlite_path=tmp_path / "lite.db",
        redis_url=CLOSED_PORT_REDIS_URL,
        resend_api_key=SecretStr("re_CANARY-key") if configured else None,
        mail_from=SENDER if configured else None,
        celery_task_always_eager=False,
        log_level="DEBUG",
    )


def _message() -> MailMessage:
    return MailMessage(
        to="canary-to@canary-domain.example",
        subject="CANARY-subject",
        text="CANARY-body CANARY-link",
        html="<a href='https://example.test/?t=CANARY-link'>CANARY-body</a>",
        kind="signup_verify",
    )


def _run_task(settings: WorkerSettings) -> None:
    app = create_celery_app(settings)
    app.tasks[SEND_MAIL_TASK_NAME].apply(
        kwargs={"mail_id": str(uuid.uuid4()), "payload": _message().to_task_payload()}
    )


async def _walk_the_five_paths(tmp_path: Path, resend: FakeResend) -> None:
    configured = _settings(tmp_path, configured=True)
    resend.script(200)
    _run_task(configured)  # sent
    resend.script(PROVIDER_ERROR, 200)
    _run_task(configured)  # retried, then sent
    resend.script(*[PROVIDER_ERROR] * 4)
    _run_task(configured)  # retries exhausted
    unconfigured = MailService(
        _settings(tmp_path, configured=False),
        create_celery_app(_settings(tmp_path, configured=False)),
    )
    await unconfigured.enqueue(_message())  # not configured
    await unconfigured.send_now(_message())
    with pytest.raises(MailQueueUnavailableError):  # queue unavailable
        await MailService(configured, create_celery_app(configured)).enqueue(_message())


async def test_no_path_writes_mail_content_to_any_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    resend = FakeResend()
    resend.install(monkeypatch)
    buffer = io.StringIO()
    configure_logging(_settings(tmp_path, configured=True), stream=buffer)
    caplog.set_level(logging.DEBUG)

    await _walk_the_five_paths(tmp_path, resend)

    captured = capsys.readouterr()
    everything = buffer.getvalue() + caplog.text + captured.out + captured.err
    assert "outcome=sent" in buffer.getvalue()
    assert "outcome=queue_unavailable" in buffer.getvalue()
    for canary in CANARIES:
        assert canary not in everything, canary
    reasons = re.findall(r"reason=(\S+)", buffer.getvalue())
    assert {"status_503", "retries_exhausted"} <= set(reasons)
    assert all(REASON.match(reason) for reason in reasons), reasons


async def test_task_arguments_hold_only_the_mail_id_and_the_five_fields(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    publish = PublishSpy().install(monkeypatch)
    settings = _settings(tmp_path, configured=True)

    await MailService(settings, create_celery_app(settings)).enqueue(_message())

    [(body, _)] = publish.calls
    args, kwargs, _ = json.loads(json.dumps(body))
    assert args == []
    assert set(kwargs) == {"mail_id", "payload"}
    assert set(kwargs["payload"]) == {"to", "subject", "text", "html", "kind"}
