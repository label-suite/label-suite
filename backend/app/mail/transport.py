"""The only code that talks to the mail provider: Resend's HTTP API over ``httpx`` (design D3).

``ResendTransport.send`` makes one synchronous ``POST /emails`` and sorts the outcome:

- accepted (``2xx``): returns the provider's message id;
- worth a retry: a connection error, a timeout, ``429``, ``5xx`` or a ``409`` whose
  error name is ``concurrent_idempotent_requests`` (a request with the same key is
  still in progress) raise ``TransientMailError``;
- refused for good: any other status raises ``PermanentMailError``, including the
  ``409`` named ``invalid_idempotent_request`` (the same key with a different payload).

Every request carries ``Idempotency-Key: <mail_id>``, so the provider sends a retried
mail once; Resend keeps a key for 24 hours, longer than the whole retry schedule. Errors
are raised ``from None`` and never carry the provider's answer, which can echo the
recipient. Retrying is the Celery task's job, not this module's.
"""

import re
from typing import Any, Protocol

import httpx
from pydantic import SecretStr

from app.core.config import WorkerSettings
from app.mail.errors import PermanentMailError, TransientMailError
from app.mail.message import MailMessage

__all__ = ["RESEND_EMAILS_URL", "TIMEOUT_SECONDS", "MailTransport", "ResendTransport"]

RESEND_EMAILS_URL = "https://api.resend.com/emails"
"""Resend's send-one-mail endpoint."""

TIMEOUT_SECONDS = 10.0
"""The connect, read, write and pool timeout of one request."""

_CONFLICT = 409
_TOO_MANY_REQUESTS = 429
_CONCURRENT_IDEMPOTENT_REQUESTS = "concurrent_idempotent_requests"
_SERVER_ERROR = 500
_SAFE_PROVIDER_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")
_NO_PROVIDER_ID = "-"


class MailTransport(Protocol):
    """Sends one mail; implemented by ``ResendTransport`` and by nothing else in ``app``."""

    def send(self, message: MailMessage, mail_id: str) -> str:
        """Send ``message`` once and return the provider's message id.

        Raises:
            TransientMailError: When a retry may succeed.
            PermanentMailError: When the provider refused the mail.
        """
        ...


class ResendTransport:
    """Sends mail through Resend's HTTP API with a synchronous ``httpx.Client``.

    Args:
        api_key: ``RESEND_API_KEY``, sent as a bearer token.
        sender: ``MAIL_FROM``, already checked to be on one line.
    """

    def __init__(self, *, api_key: SecretStr, sender: str) -> None:
        self._api_key = api_key
        self._sender = sender

    def __repr__(self) -> str:
        """Return a representation without the key or the sender."""
        return "ResendTransport()"

    @classmethod
    def from_settings(cls, settings: WorkerSettings) -> "ResendTransport":
        """Build the transport from configured settings.

        Raises:
            ValueError: When the mail service is not configured
                (``settings.mail_configured()`` is false).
        """
        if settings.resend_api_key is None or settings.mail_from is None:
            raise ValueError("the mail service is not configured")
        return cls(api_key=settings.resend_api_key, sender=settings.mail_from)

    def send(self, message: MailMessage, mail_id: str) -> str:
        """Send ``message`` once with ``mail_id`` as the idempotency key.

        Args:
            message: The validated mail.
            mail_id: The mail's UUID; the same value on every attempt.

        Returns:
            The provider's message id, or ``-`` when the answer has none that is safe to
            log.

        Raises:
            TransientMailError: On a connection error (``connect_error``), a timeout
                (``timeout``), ``429``, ``5xx`` or a ``409`` named
                ``concurrent_idempotent_requests`` (``status_<code>``).
            PermanentMailError: On any other status outside ``2xx``.
        """
        try:
            with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
                response = client.post(
                    RESEND_EMAILS_URL,
                    json=self._body(message),
                    headers={
                        "Authorization": f"Bearer {self._api_key.get_secret_value()}",
                        "Idempotency-Key": mail_id,
                    },
                )
        except httpx.TimeoutException:
            raise TransientMailError(reason="timeout") from None
        except httpx.RequestError:
            # Connection errors and every other failure to get an answer.
            raise TransientMailError(reason="connect_error") from None
        status = response.status_code
        if status == _TOO_MANY_REQUESTS or status >= _SERVER_ERROR or _is_concurrent(response):
            raise TransientMailError(reason=f"status_{status}") from None
        if not response.is_success:
            raise PermanentMailError(provider_status=status) from None
        return _provider_id(response)

    def _body(self, message: MailMessage) -> dict[str, Any]:
        body: dict[str, Any] = {
            "from": self._sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html is not None:
            body["html"] = message.html
        return body


def _error_name(response: httpx.Response) -> str | None:
    """Return the ``name`` of a Resend error answer, or ``None`` when it has none."""
    try:
        payload = response.json()
    except ValueError:
        return None
    name = payload.get("name") if isinstance(payload, dict) else None
    return name if isinstance(name, str) else None


def _is_concurrent(response: httpx.Response) -> bool:
    """Return whether ``response`` says a request with the same key is still in progress."""
    return (
        response.status_code == _CONFLICT
        and _error_name(response) == _CONCURRENT_IDEMPOTENT_REQUESTS
    )


def _provider_id(response: httpx.Response) -> str:
    """Return the ``id`` of an accepted answer when it is safe to log, else ``-``."""
    try:
        payload = response.json()
    except ValueError:
        return _NO_PROVIDER_ID
    value = payload.get("id") if isinstance(payload, dict) else None
    if isinstance(value, str) and _SAFE_PROVIDER_ID.fullmatch(value):
        return value
    return _NO_PROVIDER_ID
