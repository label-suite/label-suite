"""One ready-made transactional mail, validated when it is built (design D3).

The consumer composes the content; this module only checks the fields, so a header
injection or an oversized value is refused before anything reaches the queue or the
provider (Hard Rule 9). ``kind`` labels the mail in the log only; it is not a task type.
Every error names the field and never repeats its value (S9).
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass

from app.core.email_identity import EmailTooLongError, normalize_email

__all__ = ["MAX_SUBJECT_LENGTH", "MailMessage", "TaskPayload"]

MAX_SUBJECT_LENGTH = 200
"""The longest accepted subject, in characters."""

TaskPayload = dict[str, str | None]
"""The JSON-serialisable form of a message: ``to``, ``subject``, ``text``, ``html``, ``kind``."""

_KIND = re.compile(r"[a-z][a-z0-9_]{0,31}")
_PAYLOAD_KEYS = frozenset({"to", "subject", "text", "html", "kind"})
_REQUIRED_TEXT_KEYS = ("to", "subject", "text", "kind")


def _has_line_break(value: str) -> bool:
    return "\r" in value or "\n" in value


@dataclass(frozen=True)
class MailMessage:
    """A mail to one recipient.

    Attributes:
        to: The recipient, normalised with ``normalize_email``; at most 254 characters
            after normalising, not empty, on one line.
        subject: 1 to 200 characters, without CR or LF.
        text: The plain-text body; not empty.
        html: The optional HTML body.
        kind: What the mail is for, matching ``^[a-z][a-z0-9_]{0,31}$``; written to the
            log, never used to branch.

    Raises:
        ValueError: From the constructor when a field is invalid; the message names the
            field and never contains its value.
    """

    to: str
    subject: str
    text: str
    html: str | None
    kind: str

    def __post_init__(self) -> None:
        """Validate every field and store the normalised recipient."""
        object.__setattr__(self, "to", _checked_recipient(self.to))
        if not 1 <= len(self.subject) <= MAX_SUBJECT_LENGTH or _has_line_break(self.subject):
            raise ValueError(
                f"subject: must be 1 to {MAX_SUBJECT_LENGTH} characters with no line break"
            )
        if self.text == "":
            raise ValueError("text: must not be empty")
        if _KIND.fullmatch(self.kind) is None:
            raise ValueError("kind: must match ^[a-z][a-z0-9_]{0,31}$")

    def to_task_payload(self) -> TaskPayload:
        """Return the five fields as a JSON-serialisable dict for the Celery task."""
        return {
            "to": self.to,
            "subject": self.subject,
            "text": self.text,
            "html": self.html,
            "kind": self.kind,
        }

    @classmethod
    def from_task_payload(cls, payload: Mapping[str, object]) -> "MailMessage":
        """Rebuild a message from ``to_task_payload`` output, validating it again.

        Raises:
            ValueError: When the keys are not exactly the five fields, a field has the
                wrong type, or a field is invalid; the message never contains a value.
        """
        if set(payload) != _PAYLOAD_KEYS:
            raise ValueError("payload: must hold exactly to, subject, text, html and kind")
        texts = [payload[key] for key in _REQUIRED_TEXT_KEYS]
        html = payload["html"]
        if not all(isinstance(value, str) for value in texts):
            raise ValueError("payload: every field must be a string (html may be null)")
        if html is not None and not isinstance(html, str):
            raise ValueError("payload: every field must be a string (html may be null)")
        to, subject, text, kind = (str(value) for value in texts)
        return cls(to=to, subject=subject, text=text, html=html, kind=kind)


def _checked_recipient(raw: str) -> str:
    """Return the normalised recipient or raise a ``ValueError`` naming ``to``."""
    try:
        normalised = normalize_email(raw)
    except EmailTooLongError:
        raise ValueError("to: must be at most 254 characters after normalising") from None
    if normalised == "" or _has_line_break(normalised):
        raise ValueError("to: must not be empty and must be on one line")
    return normalised
