"""A stand-in for the Resend HTTP API at the network boundary (design D8, T6).

The app keeps its real ``ResendTransport``; only ``httpx.Client.send`` is replaced, and
only for Resend's ``POST /emails``. Any other request goes through untouched. Each call
takes the next scripted answer: a status code (answered with a JSON body), an
``httpx`` exception class (raised, as a dropped connection or a timeout would be), or a
``(status, body)`` pair. When the script runs out, every further request gets ``200``.
"""

import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
import pytest

RESEND_EMAILS_URL = "https://api.resend.com/emails"

Answer = int | type[httpx.TransportError] | tuple[int, str]


@dataclass(frozen=True)
class RecordedRequest:
    """One request the stand-in received.

    Attributes:
        headers: The request headers, lower-cased names.
        body: The decoded JSON body.
    """

    headers: dict[str, str]
    body: dict[str, Any]


class FakeResend:
    """Answers ``POST https://api.resend.com/emails`` from a script.

    Attributes:
        answers: The answers still to give, first one next.
        requests: Every request received, in order.
        delay_seconds: How long each answer is held back, to stand in for a slow
            provider.
        message_id: The ``id`` of every ``200`` answer.
    """

    def __init__(self) -> None:
        self.answers: list[Answer] = []
        self.requests: list[RecordedRequest] = []
        self.delay_seconds = 0.0
        self.message_id = "provider-1"
        self._lock = threading.Lock()

    def script(self, *answers: Answer) -> "FakeResend":
        """Queue ``answers`` and return the stand-in, for chaining."""
        self.answers.extend(answers)
        return self

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Route Resend's endpoint to this stand-in for the rest of the test."""
        original: Callable[..., httpx.Response] = httpx.Client.send

        def send(client: httpx.Client, request: httpx.Request, **kwargs: Any) -> httpx.Response:
            if request.method == "POST" and str(request.url) == RESEND_EMAILS_URL:
                return self._answer(request)
            return original(client, request, **kwargs)

        monkeypatch.setattr(httpx.Client, "send", send)

    @property
    def idempotency_keys(self) -> list[str]:
        """Return the ``Idempotency-Key`` header of every request, in order."""
        return [request.headers.get("idempotency-key", "") for request in self.requests]

    def _answer(self, request: httpx.Request) -> httpx.Response:
        with self._lock:
            self.requests.append(
                RecordedRequest(
                    headers={k.lower(): v for k, v in request.headers.items()},
                    body=json.loads(request.content.decode()),
                )
            )
            answer: Answer = self.answers.pop(0) if self.answers else 200
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        if isinstance(answer, type):
            raise answer("stand-in failure", request=request)
        status, body = answer if isinstance(answer, tuple) else (answer, "")
        if status == 200 and not body:
            body = json.dumps({"id": self.message_id})
        elif not body:
            body = json.dumps({"name": "error", "message": "stand-in error"})
        return httpx.Response(
            status,
            content=body.encode(),
            headers={"Content-Type": "application/json"},
            request=request,
        )
