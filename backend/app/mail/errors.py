"""Errors of the mail entry (design D6).

None of them carries any text: Celery writes ``str(exc)`` into its own retry and failure
records (``Retry in 60s: <exc>``), so an empty exception keeps the recipient, the content
and the provider's answer out of the log. Details travel as attributes from a fixed
vocabulary instead. They do not extend ``AppError``: they never become an HTTP response
on their own, and each consumer decides what to tell its user.
"""

from typing import Any

__all__ = [
    "MailDeliveryError",
    "MailQueueUnavailableError",
    "PermanentMailError",
    "TransientMailError",
]


class MailDeliveryError(Exception):
    """Base of every mail-entry error; ``str()`` is always empty and ``args`` is ``()``."""

    def __init__(self) -> None:
        super().__init__()

    def __reduce__(self) -> tuple[Any, ...]:
        """Pickle by attributes, since ``args`` is deliberately empty."""
        return (_rebuild, (type(self), dict(self.__dict__)))


def _rebuild(cls: type[MailDeliveryError], state: dict[str, Any]) -> MailDeliveryError:
    error = cls.__new__(cls)
    Exception.__init__(error)
    error.__dict__.update(state)
    return error


class TransientMailError(MailDeliveryError):
    """The provider could not be reached or asked to try later; worth a retry.

    Attributes:
        reason: ``connect_error``, ``timeout`` or ``status_<code>`` (``429`` or ``5xx``).
    """

    def __init__(self, *, reason: str) -> None:
        super().__init__()
        self.reason = reason


class PermanentMailError(MailDeliveryError):
    """The provider refused the mail (a ``4xx`` other than ``429``); retrying will not help.

    Attributes:
        provider_status: The provider's HTTP status code.
    """

    def __init__(self, *, provider_status: int) -> None:
        super().__init__()
        self.provider_status = provider_status

    @property
    def reason(self) -> str:
        """Return the log reason, ``status_<code>``."""
        return f"status_{self.provider_status}"


class MailQueueUnavailableError(MailDeliveryError):
    """The message could not be handed to the queue (Redis unreachable or timing out)."""
