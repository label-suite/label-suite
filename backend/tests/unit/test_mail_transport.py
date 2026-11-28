"""Unit tests for ``app.mail.transport.ResendTransport`` (design D3, D8).

The stand-in replaces ``httpx.Client.send`` for Resend's endpoint only. Covers the
request shape (sender, recipient, subject, bodies, bearer key, idempotency key), the
classification into success, ``TransientMailError`` and ``PermanentMailError``, and that
no exception chains the original error or carries the provider's answer.
"""

import httpx
import pytest
from pydantic import SecretStr

from app.mail.errors import PermanentMailError, TransientMailError
from app.mail.message import MailMessage
from app.mail.transport import TIMEOUT_SECONDS, ResendTransport
from tests.support.resend import FakeResend

SENDER = "Label Suite <noreply@example.test>"
MAIL_ID = "0b6f6d1e-6f0c-4a55-9d8c-6a2b7f4f9a10"


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> FakeResend:
    fake = FakeResend()
    fake.install(monkeypatch)
    return fake


def _transport() -> ResendTransport:
    return ResendTransport(api_key=SecretStr("re_test-key"), sender=SENDER)


def _message(html: str | None = None) -> MailMessage:
    return MailMessage(
        to="user@example.com", subject="Welcome", text="body", html=html, kind="signup_verify"
    )


def test_a_sent_mail_returns_the_provider_id_and_sends_the_expected_request(
    resend: FakeResend,
) -> None:
    provider_id = _transport().send(_message(html="<p>body</p>"), MAIL_ID)

    assert provider_id == "provider-1"
    assert len(resend.requests) == 1
    request = resend.requests[0]
    assert request.headers["authorization"] == "Bearer re_test-key"
    assert request.headers["idempotency-key"] == MAIL_ID
    assert request.body == {
        "from": SENDER,
        "to": ["user@example.com"],
        "subject": "Welcome",
        "text": "body",
        "html": "<p>body</p>",
    }


def test_a_mail_without_html_sends_no_html_field(resend: FakeResend) -> None:
    _transport().send(_message(), MAIL_ID)

    assert "html" not in resend.requests[0].body


def test_the_timeout_is_ten_seconds() -> None:
    assert TIMEOUT_SECONDS == 10.0


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        (httpx.ConnectError, "connect_error"),
        (httpx.ReadTimeout, "timeout"),
        (httpx.ConnectTimeout, "timeout"),
        (429, "status_429"),
        (500, "status_500"),
        (503, "status_503"),
    ],
)
def test_temporary_failures_raise_a_transient_error_with_its_reason(
    resend: FakeResend, answer: int | type[httpx.TransportError], reason: str
) -> None:
    resend.script(answer)

    with pytest.raises(TransientMailError) as excinfo:
        _transport().send(_message(), MAIL_ID)

    assert excinfo.value.reason == reason
    assert excinfo.value.__cause__ is None
    assert excinfo.value.__suppress_context__ is True


@pytest.mark.parametrize("status", [400, 401, 403, 409, 422])
def test_other_client_errors_raise_a_permanent_error_without_the_body(
    resend: FakeResend, status: int
) -> None:
    resend.script((status, '{"message": "CANARY-provider user@example.com"}'))

    with pytest.raises(PermanentMailError) as excinfo:
        _transport().send(_message(), MAIL_ID)

    assert excinfo.value.provider_status == status
    assert str(excinfo.value) == ""
    assert "CANARY-provider" not in repr(excinfo.value.__dict__)
    assert excinfo.value.__suppress_context__ is True


def test_an_unusual_provider_id_is_replaced_by_a_dash(resend: FakeResend) -> None:
    resend.script((200, '{"id": "bad id\\nCANARY"}'))

    assert _transport().send(_message(), MAIL_ID) == "-"


def test_an_accepted_answer_without_json_still_counts_as_sent(resend: FakeResend) -> None:
    resend.script((200, "not json"))

    assert _transport().send(_message(), MAIL_ID) == "-"


def test_the_api_key_stays_out_of_the_transport_repr() -> None:
    assert "re_test-key" not in repr(_transport())


# --- the two 409 answers (clarification 技術預設, 2026-11-28) -----------------------------


def test_a_concurrent_request_with_the_same_key_is_transient(resend: FakeResend) -> None:
    resend.script(
        (409, '{"statusCode": 409, "name": "concurrent_idempotent_requests", "message": "x"}')
    )

    with pytest.raises(TransientMailError) as excinfo:
        _transport().send(_message(), MAIL_ID)

    assert excinfo.value.reason == "status_409"


def test_the_same_key_with_a_different_payload_is_permanent(resend: FakeResend) -> None:
    resend.script(
        (409, '{"statusCode": 409, "name": "invalid_idempotent_request", "message": "x"}')
    )

    with pytest.raises(PermanentMailError) as excinfo:
        _transport().send(_message(), MAIL_ID)

    assert excinfo.value.provider_status == 409


@pytest.mark.parametrize("body", ["not json", '["concurrent_idempotent_requests"]', "{}"])
def test_a_409_without_the_concurrent_name_is_permanent(resend: FakeResend, body: str) -> None:
    resend.script((409, body))

    with pytest.raises(PermanentMailError):
        _transport().send(_message(), MAIL_ID)
