"""The ``send_mail`` Celery task: sends one queued mail with bounded retries (design D6).

The task takes the mail itself, not a database identifier, so it never opens a database
connection and never reads business data; that is why it does not re-check permissions
(backend-agent-rules B9 exceptions, clarification Q3). It decides again whether the mail
service is configured, using the worker's own settings. A temporary failure is retried
after 60, 180 and 540 seconds; a permanent failure, exhausted retries or a worker with no
mail settings end the mail with one ``ERROR`` line. A malformed argument (which
``MailService`` never produces) ends it at once with ``excType`` and no reason. The task
returns nothing and stores no result.

Every log line holds only ``mailId``, ``kind``, ``mode``, ``outcome``, ``attempt`` or
``attempts``, ``reason`` (a fixed vocabulary) and ``providerMessageId``: never the
recipient, the subject, the body, a link, the sender or the provider's answer.
"""

import logging
import re
from typing import Any

from celery import Task, shared_task

from app.core.celery_app import settings_of
from app.mail.errors import PermanentMailError, TransientMailError
from app.mail.message import MailMessage
from app.mail.transport import ResendTransport

__all__ = ["LOGGER_NAME", "MAX_RETRIES", "RETRY_COUNTDOWNS", "SEND_MAIL_TASK_NAME", "send_mail"]

LOGGER_NAME = "app.mail"
"""The logger every mail outcome line is written to."""

SEND_MAIL_TASK_NAME = "app.mail.tasks.send_mail"
"""The registered name of ``send_mail``."""

RETRY_COUNTDOWNS = (60, 180, 540)
"""Seconds before the first, second and third retry (backend-agent-rules B9)."""

MAX_RETRIES = len(RETRY_COUNTDOWNS)
"""Retries after the first attempt; at most four attempts in all."""

_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_UNKNOWN = "-"

_log = logging.getLogger(LOGGER_NAME)


@shared_task(bind=True, ignore_result=True, name=SEND_MAIL_TASK_NAME, max_retries=MAX_RETRIES)
def send_mail(self: Task[Any, Any], mail_id: str, payload: dict[str, Any]) -> None:
    """Send one queued mail through the provider.

    Args:
        self: The bound task; ``self.request.retries`` counts the retries so far.
        mail_id: The mail's UUID4, also the provider's idempotency key.
        payload: ``MailMessage.to_task_payload()`` output.

    Raises:
        celery.exceptions.Retry: After a temporary failure while retries remain;
            Celery schedules the next attempt.
    """
    attempt = self.request.retries + 1
    safe_id = mail_id if isinstance(mail_id, str) and _UUID.fullmatch(mail_id) else _UNKNOWN
    try:
        if safe_id == _UNKNOWN:
            raise ValueError("mail_id: must be a UUID")
        message = MailMessage.from_task_payload(payload)
    except (ValueError, TypeError):
        # Only the exception type reaches the output (KeyValueFormatter); the messages
        # name a field and never hold its value.
        _log.error(
            "mailId=%s kind=- mode=queued outcome=failed attempts=%d",
            safe_id,
            attempt,
            exc_info=True,
        )
        return
    settings = settings_of(self.app)
    if settings is None or not settings.mail_configured():
        _failed(safe_id, message.kind, attempt, "not_configured_in_worker")
        return
    try:
        provider_id = ResendTransport.from_settings(settings).send(message, safe_id)
    except PermanentMailError as error:
        _failed(safe_id, message.kind, attempt, error.reason)
        return
    except TransientMailError as error:
        if self.request.retries >= MAX_RETRIES:
            _failed(safe_id, message.kind, attempt, "retries_exhausted")
            return
        _log.warning(
            "mailId=%s kind=%s mode=queued outcome=retry attempt=%d reason=%s",
            safe_id,
            message.kind,
            attempt,
            error.reason,
        )
        raise self.retry(
            countdown=RETRY_COUNTDOWNS[self.request.retries], max_retries=MAX_RETRIES
        ) from None
    _log.info(
        "mailId=%s kind=%s mode=queued outcome=sent attempt=%d providerMessageId=%s",
        safe_id,
        message.kind,
        attempt,
        provider_id,
    )


def _failed(mail_id: str, kind: str, attempts: int, reason: str) -> None:
    """Write the one ``ERROR`` line that ends a mail."""
    _log.error(
        "mailId=%s kind=%s mode=queued outcome=failed attempts=%d reason=%s",
        mail_id,
        kind,
        attempts,
        reason,
    )
