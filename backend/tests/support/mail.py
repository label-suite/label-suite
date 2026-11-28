"""Helpers for the mail tests: worker settings, a sample message and queue spies (design D8).

``PublishSpy`` replaces ``kombu.Producer.publish``, so a queued task is recorded instead
of being sent; nothing connects to Redis. ``ConnectionAttempts`` counts every attempt
to open a broker connection, to prove a path never reaches for the queue. Both replace
third-party code only (testing-agent-rules T6).

``ConnectionAttempts`` wraps ``kombu.Connection._establish_connection``, the one method
every kombu transport goes through to open the network connection. Counting created
``kombu.Connection`` objects instead would be wrong: Celery's eager ``apply_async``
builds a producer (and so a connection object) to serialise the arguments, without
ever connecting.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import kombu
import pytest
from pydantic import SecretStr

from app.core.config import WorkerSettings
from app.mail.message import MailMessage

SENDER = "Label Suite <noreply@example.test>"
CLOSED_PORT_REDIS_URL = "redis://:CANARY-pw@127.0.0.1:1"


def worker_settings(
    tmp_path: Path,
    *,
    configured: bool = True,
    eager: bool = False,
    redis_url: str = CLOSED_PORT_REDIS_URL,
) -> WorkerSettings:
    """Return worker settings with every field explicit (no environment leaks in)."""
    return WorkerSettings(
        database_url=None,
        sqlite_path=tmp_path / "lite.db",
        redis_url=redis_url,
        resend_api_key=SecretStr("re_CANARY-key") if configured else None,
        mail_from=SENDER if configured else None,
        celery_task_always_eager=eager,
        log_level="DEBUG",
    )


def sample_message(**overrides: Any) -> MailMessage:
    """Return a valid message; keyword arguments replace fields."""
    values: dict[str, Any] = {
        "to": "user@example.com",
        "subject": "Welcome",
        "text": "body",
        "html": None,
        "kind": "signup_verify",
    }
    values.update(overrides)
    return MailMessage(**values)


@dataclass
class PublishSpy:
    """Records what ``kombu.Producer.publish`` was asked to send.

    Attributes:
        calls: One ``(body, keyword arguments)`` pair per publish.
        error: Raised instead of recording, when set.
    """

    calls: list[tuple[Any, dict[str, Any]]] = field(default_factory=list)
    error: Exception | None = None

    def install(self, monkeypatch: pytest.MonkeyPatch) -> "PublishSpy":
        """Replace ``kombu.Producer.publish`` for the rest of the test."""

        def publish(producer: kombu.Producer, body: Any, **kwargs: Any) -> None:
            if self.error is not None:
                raise self.error
            self.calls.append((body, kwargs))

        monkeypatch.setattr(kombu.Producer, "publish", publish)
        return self


@dataclass
class ConnectionAttempts:
    """Counts the attempts to open a broker connection.

    Attributes:
        count: How many attempts were made.
    """

    count: int = 0

    def install(self, monkeypatch: pytest.MonkeyPatch) -> "ConnectionAttempts":
        """Wrap ``kombu.Connection._establish_connection`` for the rest of the test."""
        original = kombu.Connection._establish_connection

        def establish(connection: kombu.Connection) -> Any:
            self.count += 1
            return original(connection)

        monkeypatch.setattr(kombu.Connection, "_establish_connection", establish)
        return self
