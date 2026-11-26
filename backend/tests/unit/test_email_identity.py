"""Unit tests for ``app.core.email_identity`` (login-auth-guard task 3.1).

Spec 01-05 §Email 的識別規則: an Email is normalised (surrounding whitespace removed,
NFKC, case folded) before it is compared, and the 254-character limit is counted after
normalisation.
"""

import pytest

from app.core.email_identity import MAX_EMAIL_LENGTH, EmailTooLongError, normalize_email


def test_the_limit_is_254_characters() -> None:
    assert MAX_EMAIL_LENGTH == 254


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("User@Example.com", "user@example.com"),
        ("  user@example.com\t", "user@example.com"),
        ("ＵＳＥＲ＠ＥＸＡＭＰＬＥ．ＣＯＭ", "user@example.com"),  # full-width forms (NFKC)
        ("STRASSE@example.com", "strasse@example.com"),
        ("straße@example.com", "strasse@example.com"),  # casefold, not lower
        ("ﬁle@example.com", "file@example.com"),  # compatibility ligature
        ("no-at-sign", "no-at-sign"),  # the format is not checked here
    ],
)
def test_normalize_email(raw: str, expected: str) -> None:
    assert normalize_email(raw) == expected


def test_two_spellings_of_one_address_normalise_to_the_same_value() -> None:
    assert normalize_email("Ｕser@EXAMPLE.com") == normalize_email("user@example.com")


@pytest.mark.parametrize(
    "raw", ["User@Example.com", "straße@example.com", "ＡＢＣ@example.com", "İstanbul@example.com"]
)
def test_normalising_twice_changes_nothing(raw: str) -> None:
    once = normalize_email(raw)

    assert normalize_email(once) == once


def test_exactly_254_characters_after_normalising_is_accepted() -> None:
    local = "a" * (254 - len("@example.com"))

    assert len(normalize_email(f"{local.upper()}@example.com")) == 254


def test_255_characters_after_normalising_is_rejected() -> None:
    local = "a" * (255 - len("@example.com"))

    with pytest.raises(EmailTooLongError):
        normalize_email(f"{local}@example.com")


def test_the_limit_is_counted_after_normalising_not_on_the_input() -> None:
    local = "a" * (254 - len("@example.com"))
    padded = f"   {local}@example.com   "  # 260 characters as typed

    assert len(normalize_email(padded)) == 254


def test_input_that_grows_past_the_limit_when_normalised_is_rejected() -> None:
    # "ß" is one character but case-folds to "ss": 130 typed characters become 255.
    with pytest.raises(EmailTooLongError):
        normalize_email("ß" * 125 + "@x.io")


def test_the_error_does_not_echo_the_address() -> None:
    raw = "secret-person" + "a" * 300 + "@example.com"

    with pytest.raises(EmailTooLongError) as caught:
        normalize_email(raw)

    assert "secret-person" not in str(caught.value)
