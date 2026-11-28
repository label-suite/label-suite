"""Unit tests for ``app.mail.message`` and ``app.mail.errors`` (design D3, D6).

Spec ``mail-delivery`` "信件在交出時驗證欄位" (every rejection happens when the message is
built, and the error never carries the field value) and "工作內容可以 JSON 序列化". The
part of "主旨含換行時拒絕" about nothing reaching the queue or the provider is covered with
``MailService`` in ``test_mail_service.py``.
"""

import json
import pickle
from typing import Any

import pytest

from app.mail.errors import (
    MailDeliveryError,
    MailQueueUnavailableError,
    PermanentMailError,
    TransientMailError,
)
from app.mail.message import MailMessage


def _message(**overrides: Any) -> MailMessage:
    values: dict[str, Any] = {
        "to": "user@example.com",
        "subject": "Welcome",
        "text": "body",
        "html": None,
        "kind": "signup_verify",
    }
    values.update(overrides)
    return MailMessage(**values)


def test_a_valid_message_is_accepted_with_the_recipient_normalised() -> None:
    message = _message(to="User@Example.com", subject="歡迎", text="body", kind="signup_verify")

    assert message.to == "user@example.com"
    assert message.subject == "歡迎"
    assert message.html is None


@pytest.mark.parametrize(
    "subject",
    [
        "Hello\r\nBcc: CANARY-inject@example.com",
        "Hello\nBcc: CANARY-inject@example.com",
        "Hello\rBcc: CANARY-inject@example.com",
    ],
)
def test_a_subject_with_a_line_break_is_rejected_without_its_value(subject: str) -> None:
    with pytest.raises(ValueError, match="subject") as excinfo:
        _message(subject=subject)

    assert "CANARY-inject" not in str(excinfo.value)


@pytest.mark.parametrize("subject", ["", "x" * 201])
def test_a_subject_outside_1_to_200_characters_is_rejected(subject: str) -> None:
    with pytest.raises(ValueError, match="subject"):
        _message(subject=subject)


def test_a_subject_of_200_characters_is_accepted() -> None:
    assert len(_message(subject="x" * 200).subject) == 200


@pytest.mark.parametrize("kind", ["Signup", "1invite", "", "a" * 33, "signup-verify", "a\n"])
def test_a_kind_outside_the_pattern_is_rejected(kind: str) -> None:
    with pytest.raises(ValueError, match="kind"):
        _message(kind=kind)


def test_a_kind_of_32_characters_is_accepted() -> None:
    assert _message(kind="a" * 32).kind == "a" * 32


def test_a_recipient_longer_than_254_after_normalising_is_rejected_without_its_value() -> None:
    recipient = "CANARY" + "a" * 237 + "@example.com"  # 255 characters
    assert len(recipient) == 255

    with pytest.raises(ValueError, match="to") as excinfo:
        _message(to=recipient)

    assert "canary" not in str(excinfo.value).lower()


@pytest.mark.parametrize("recipient", ["", "   ", "a@example.com\r\nBcc: CANARY@x.example"])
def test_an_empty_or_multi_line_recipient_is_rejected(recipient: str) -> None:
    with pytest.raises(ValueError, match="to") as excinfo:
        _message(to=recipient)

    assert "CANARY" not in str(excinfo.value)


def test_an_empty_text_body_is_rejected() -> None:
    with pytest.raises(ValueError, match="text"):
        _message(text="")


def test_the_message_is_immutable() -> None:
    message = _message()

    with pytest.raises(AttributeError):
        message.subject = "changed"  # type: ignore[misc]


# --- task payload (mail-delivery 工作內容可以 JSON 序列化) --------------------------------


def test_the_task_payload_survives_a_json_round_trip() -> None:
    message = _message(html="<p>body</p>")

    decoded = json.loads(json.dumps(message.to_task_payload()))

    assert set(decoded) == {"to", "subject", "text", "html", "kind"}
    assert MailMessage.from_task_payload(decoded) == message


def test_a_payload_with_an_extra_or_missing_key_is_rejected() -> None:
    payload: dict[str, Any] = dict(_message().to_task_payload())

    with pytest.raises(ValueError, match="payload"):
        MailMessage.from_task_payload({**payload, "user_id": 1})
    del payload["kind"]
    with pytest.raises(ValueError, match="payload"):
        MailMessage.from_task_payload(payload)


def test_a_payload_with_a_non_string_field_is_rejected() -> None:
    payload: dict[str, Any] = {**_message().to_task_payload(), "subject": 1}

    with pytest.raises(ValueError, match="payload"):
        MailMessage.from_task_payload(payload)


def test_a_payload_is_validated_like_a_new_message() -> None:
    payload: dict[str, Any] = {**_message().to_task_payload(), "subject": "a\r\nb"}

    with pytest.raises(ValueError, match="subject"):
        MailMessage.from_task_payload(payload)


# --- errors (design D6) -----------------------------------------------------------------


def test_every_mail_error_has_no_text_and_is_not_an_app_error() -> None:
    errors: list[MailDeliveryError] = [
        TransientMailError(reason="status_503"),
        PermanentMailError(provider_status=422),
        MailQueueUnavailableError(),
    ]

    for error in errors:
        assert str(error) == ""
        assert error.args == ()
        assert type(error).__mro__[1:] in (
            (MailDeliveryError, Exception, BaseException, object),
            (Exception, BaseException, object),
        )


def test_transient_and_permanent_errors_carry_their_reason() -> None:
    assert TransientMailError(reason="timeout").reason == "timeout"
    permanent = PermanentMailError(provider_status=401)
    assert permanent.provider_status == 401
    assert permanent.reason == "status_401"


def test_mail_errors_survive_pickling_with_their_attributes() -> None:
    copy = pickle.loads(pickle.dumps(PermanentMailError(provider_status=403)))  # noqa: S301

    assert isinstance(copy, PermanentMailError)
    assert copy.provider_status == 403
    assert str(copy) == ""
