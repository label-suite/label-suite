"""Mail entry package (backend-agent-rules B12; email-celery-worker design D1).

The one place that talks to the mail service. It calls the provider's HTTP API with
``httpx`` directly, which B12 allows: each integration's own wrapper is its entry. It
never imports a business module (``app.modules``), so neither it nor its Celery task can
reach business data or test-set answers.

Consumers use ``MailService`` (from ``app.state.mail_service``), build ``MailMessage``
values, and may call ``record_unsent_link`` when no mail service is configured.
"""

from app.mail.errors import (
    MailDeliveryError,
    MailQueueUnavailableError,
    PermanentMailError,
    TransientMailError,
)
from app.mail.message import MailMessage
from app.mail.service import (
    DispatchStatus,
    MailDispatch,
    MailOutcome,
    MailService,
    OutcomeStatus,
)
from app.mail.unsent_link import record_unsent_link

__all__ = [
    "DispatchStatus",
    "MailDeliveryError",
    "MailDispatch",
    "MailMessage",
    "MailOutcome",
    "MailQueueUnavailableError",
    "MailService",
    "OutcomeStatus",
    "PermanentMailError",
    "TransientMailError",
    "record_unsent_link",
]
