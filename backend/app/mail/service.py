"""``MailService``: the one door every consumer uses to send mail (design D3, D4, D5).

Call it only after the consumer's transaction has committed (backend-agent-rules B4);
it opens no transaction and reads no business data. Two ways to send:

- ``enqueue`` hands the mail to the ``send_mail`` task on the ``default`` queue, which
  retries temporary failures; the caller learns only that the mail was queued.
- ``send_now`` calls the provider once, in a worker thread, and reports whether it was
  sent; it never retries and never touches the queue.

Both report ``NOT_CONFIGURED`` and do nothing else when the deployment has no mail
service. Neither writes the content, the recipient or a link to the log; whether to hand
an unsent link to the operator is the consumer's call (``record_unsent_link``).
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import redis.exceptions
from celery import Celery
from kombu.exceptions import OperationalError

from app.core.celery_app import QUEUE_DEFAULT
from app.core.config import WorkerSettings
from app.mail.errors import MailDeliveryError, MailQueueUnavailableError
from app.mail.message import MailMessage
from app.mail.tasks import ARGS_REPR, KWARGS_REPR, LOGGER_NAME, SEND_MAIL_TASK_NAME
from app.mail.transport import ResendTransport

__all__ = ["DispatchStatus", "MailDispatch", "MailOutcome", "MailService", "OutcomeStatus"]

_QUEUE_ERRORS = (OperationalError, redis.exceptions.RedisError, OSError)

_log = logging.getLogger(LOGGER_NAME)


class DispatchStatus(StrEnum):
    """What ``enqueue`` did with a mail."""

    QUEUED = "queued"
    NOT_CONFIGURED = "not_configured"


class OutcomeStatus(StrEnum):
    """What ``send_now`` achieved."""

    SENT = "sent"
    NOT_CONFIGURED = "not_configured"
    FAILED = "failed"


@dataclass(frozen=True)
class MailDispatch:
    """The result of ``enqueue``.

    Attributes:
        status: ``QUEUED`` or ``NOT_CONFIGURED``.
        mail_id: The new mail's UUID4; ``None`` when not configured.
    """

    status: DispatchStatus
    mail_id: str | None


@dataclass(frozen=True)
class MailOutcome:
    """The result of ``send_now``.

    Attributes:
        status: ``SENT``, ``FAILED`` or ``NOT_CONFIGURED``.
        mail_id: The mail's UUID4; ``None`` when not configured.
    """

    status: OutcomeStatus
    mail_id: str | None


class MailService:
    """Sends ready-made mails, queued or at once.

    Args:
        settings: Decide whether mail is configured and supply the provider key and
            sender.
        celery_app: The app ``send_mail`` is published through; when its
            ``task_always_eager`` is on (Lite tier only), queued mails run in a worker
            thread of this process instead of through Redis.
    """

    def __init__(self, settings: WorkerSettings, celery_app: Celery) -> None:
        self._settings = settings
        self._celery = celery_app

    async def enqueue(self, message: MailMessage) -> MailDispatch:
        """Queue ``message`` for the ``send_mail`` task.

        Returns:
            ``QUEUED`` with a new mail id, or ``NOT_CONFIGURED`` (no id, no queue
            contact) when the deployment has no mail service.

        Raises:
            MailQueueUnavailableError: When the queue cannot take the mail within the
                publish timeouts (seconds); the error has no text. Do not swallow it.
        """
        if not self._settings.mail_configured():
            _log.info("kind=%s mode=queued outcome=not_configured", message.kind)
            return MailDispatch(DispatchStatus.NOT_CONFIGURED, None)
        mail_id = str(uuid.uuid4())
        task = self._celery.tasks[SEND_MAIL_TASK_NAME]
        options: dict[str, Any] = {
            "kwargs": {"mail_id": mail_id, "payload": message.to_task_payload()},
            "queue": QUEUE_DEFAULT,
            "argsrepr": ARGS_REPR,
            "kwargsrepr": KWARGS_REPR,
        }
        try:
            if self._celery.conf.task_always_eager:
                # The eager task makes a blocking HTTP call; keep it off the event loop.
                await asyncio.to_thread(task.apply_async, **options)
            else:
                task.apply_async(**options)
        except _QUEUE_ERRORS as error:
            _log.warning(
                "mailId=%s kind=%s mode=queued outcome=queue_unavailable excType=%s",
                mail_id,
                message.kind,
                f"{type(error).__module__}.{type(error).__qualname__}",
            )
            raise MailQueueUnavailableError() from None
        _log.info("mailId=%s kind=%s mode=queued outcome=queued", mail_id, message.kind)
        return MailDispatch(DispatchStatus.QUEUED, mail_id)

    async def send_now(self, message: MailMessage) -> MailOutcome:
        """Send ``message`` once, now, in a worker thread.

        Returns:
            ``SENT`` or ``FAILED`` with the mail id, or ``NOT_CONFIGURED`` (no id, no
            provider call). A temporary failure is ``FAILED`` too; nothing is retried.
        """
        if not self._settings.mail_configured():
            _log.info("kind=%s mode=now outcome=not_configured", message.kind)
            return MailOutcome(OutcomeStatus.NOT_CONFIGURED, None)
        mail_id = str(uuid.uuid4())
        transport = ResendTransport.from_settings(self._settings)
        try:
            provider_id = await asyncio.to_thread(transport.send, message, mail_id)
        except MailDeliveryError as error:
            _log.warning(
                "mailId=%s kind=%s mode=now outcome=failed attempts=1 reason=%s",
                mail_id,
                message.kind,
                getattr(error, "reason", "-"),
            )
            return MailOutcome(OutcomeStatus.FAILED, mail_id)
        _log.info(
            "mailId=%s kind=%s mode=now outcome=sent attempt=1 providerMessageId=%s",
            mail_id,
            message.kind,
            provider_id,
        )
        return MailOutcome(OutcomeStatus.SENT, mail_id)
