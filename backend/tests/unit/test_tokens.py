"""Unit tests for ``app.core.tokens`` (login-auth-guard task 3.1, system-design T6).

Covers the purpose-derived keys, the access JWT codec (signature, expiry, required
claims), the opaque tokens and their hash, the CSRF value bound to a session, and the
signed payload the Google flow cookie carries.
"""

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from pydantic import SecretStr

from app.core.tokens import (
    AccessClaims,
    AccessTokenCodec,
    InvalidAccessTokenError,
    TokenKeys,
    csrf_value_for,
    hash_token,
    new_opaque_token,
    sign_payload,
    verify_payload,
)

NOW = datetime(2026, 11, 26, 8, 0, tzinfo=UTC)
USER_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
SESSION_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")


def _keys() -> TokenKeys:
    return TokenKeys.derive(SecretStr(secrets.token_urlsafe(48)))


def _codec(keys: TokenKeys | None = None) -> AccessTokenCodec:
    return AccessTokenCodec((keys or _keys()).access)


def _issue(codec: AccessTokenCodec, *, expires_at: datetime | None = None) -> str:
    return codec.issue(
        user_id=USER_ID,
        session_id=SESSION_ID,
        credential_version=3,
        role="user",
        issued_at=NOW,
        expires_at=expires_at or NOW + timedelta(minutes=15),
    )


# --- key derivation ------------------------------------------------------------------


def test_the_three_keys_differ_from_each_other_and_from_the_secret() -> None:
    raw = secrets.token_urlsafe(48)
    keys = TokenKeys.derive(SecretStr(raw))

    assert len({keys.access, keys.csrf, keys.oidc_flow}) == 3
    assert raw.encode() not in {keys.access, keys.csrf, keys.oidc_flow}


def test_the_same_secret_derives_the_same_keys() -> None:
    raw = secrets.token_urlsafe(48)

    assert TokenKeys.derive(SecretStr(raw)) == TokenKeys.derive(SecretStr(raw))


def test_keys_are_not_shown_in_repr() -> None:
    keys = _keys()

    assert keys.access.hex() not in repr(keys)
    assert repr(keys.access) not in repr(keys)


# --- access token ----------------------------------------------------------------------


def test_issued_access_token_decodes_to_the_same_claims() -> None:
    codec = _codec()

    claims = codec.decode(_issue(codec), now=NOW + timedelta(minutes=1))

    assert claims == AccessClaims(
        user_id=USER_ID,
        session_id=SESSION_ID,
        credential_version=3,
        role="user",
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=15),
    )


def test_access_token_carries_the_contract_claim_names() -> None:
    codec = _codec()

    payload = jwt.decode(_issue(codec), options={"verify_signature": False})

    assert set(payload) == {"sub", "sid", "credential_version", "role", "iat", "exp"}
    assert payload["sub"] == str(USER_ID)
    assert payload["sid"] == str(SESSION_ID)


def test_expired_access_token_is_rejected() -> None:
    codec = _codec()
    token = _issue(codec)

    with pytest.raises(InvalidAccessTokenError):
        codec.decode(token, now=NOW + timedelta(minutes=15))


def test_expired_access_token_still_decodes_when_expiry_is_ignored() -> None:
    codec = _codec()
    token = _issue(codec)

    claims = codec.decode_ignoring_expiry(token)

    assert claims.session_id == SESSION_ID


def test_token_signed_with_another_secret_is_rejected() -> None:
    token = _issue(_codec())

    with pytest.raises(InvalidAccessTokenError):
        _codec().decode(token, now=NOW)
    with pytest.raises(InvalidAccessTokenError):
        _codec().decode_ignoring_expiry(token)


def test_token_with_a_tampered_payload_is_rejected() -> None:
    codec = _codec()
    header, _, signature = _issue(codec).split(".")
    forged = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "sid": str(SESSION_ID),
            "credential_version": 3,
            "role": "super_admin",
            "iat": NOW,
            "exp": NOW + timedelta(minutes=15),
        },
        "x" * 32,
        algorithm="HS256",
    ).split(".")[1]

    with pytest.raises(InvalidAccessTokenError):
        codec.decode(f"{header}.{forged}.{signature}", now=NOW)


def test_unsigned_token_is_rejected() -> None:
    codec = _codec()
    unsigned = jwt.encode(
        {
            "sub": str(USER_ID),
            "sid": str(SESSION_ID),
            "credential_version": 3,
            "role": "user",
            "iat": NOW,
            "exp": NOW + timedelta(minutes=15),
        },
        None,
        algorithm="none",
    )

    with pytest.raises(InvalidAccessTokenError):
        codec.decode(unsigned, now=NOW)


@pytest.mark.parametrize(
    "change",
    [
        {"sub": None},
        {"sid": None},
        {"credential_version": None},
        {"role": None},
        {"iat": None},
        {"exp": None},
        {"sub": "not-a-uuid"},
        {"sid": 7},
        {"credential_version": "3"},
        {"credential_version": True},
        {"credential_version": -1},
        {"role": 1},
    ],
)
def test_token_with_a_missing_or_malformed_claim_is_rejected(change: dict[str, object]) -> None:
    keys = _keys()
    payload: dict[str, object] = {
        "sub": str(USER_ID),
        "sid": str(SESSION_ID),
        "credential_version": 3,
        "role": "user",
        "iat": NOW,
        "exp": NOW + timedelta(minutes=15),
    }
    for name, value in change.items():
        if value is None:
            del payload[name]
        else:
            payload[name] = value
    token = jwt.encode(payload, keys.access, algorithm="HS256")

    with pytest.raises(InvalidAccessTokenError):
        AccessTokenCodec(keys.access).decode(token, now=NOW)


@pytest.mark.parametrize("garbage", ["", "abc", "a.b.c", "....", "é.é.é"])
def test_garbage_is_rejected(garbage: str) -> None:
    with pytest.raises(InvalidAccessTokenError):
        _codec().decode(garbage, now=NOW)


def test_issue_requires_timezone_aware_times() -> None:
    codec = _codec()

    with pytest.raises(ValueError, match="timezone"):
        codec.issue(
            user_id=USER_ID,
            session_id=SESSION_ID,
            credential_version=0,
            role="user",
            issued_at=NOW.replace(tzinfo=None),
            expires_at=NOW + timedelta(minutes=15),
        )


# --- opaque tokens -----------------------------------------------------------------------


def test_opaque_tokens_are_long_unique_and_url_safe() -> None:
    values = {new_opaque_token() for _ in range(50)}

    assert len(values) == 50
    for value in values:
        assert len(value) >= 43
        assert set(value) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")


def test_hash_token_is_deterministic_hex_and_not_the_value() -> None:
    value = new_opaque_token()

    digest = hash_token(value)

    assert digest == hash_token(value)
    assert digest != value
    assert len(digest) == 64
    assert int(digest, 16) >= 0
    assert hash_token(new_opaque_token()) != digest


# --- CSRF value ----------------------------------------------------------------------------


def test_csrf_value_is_bound_to_the_session_and_the_key() -> None:
    keys = _keys()
    other_session = uuid.uuid4()

    value = csrf_value_for(keys.csrf, SESSION_ID)

    assert value == csrf_value_for(keys.csrf, SESSION_ID)
    assert value != csrf_value_for(keys.csrf, other_session)
    assert value != csrf_value_for(_keys().csrf, SESSION_ID)
    assert str(SESSION_ID) not in value


def test_csrf_value_does_not_match_the_access_key_mac() -> None:
    keys = _keys()

    assert csrf_value_for(keys.csrf, SESSION_ID) != csrf_value_for(keys.access, SESSION_ID)


# --- signed payload ----------------------------------------------------------------------


def test_signed_payload_round_trips() -> None:
    keys = _keys()

    signed = sign_payload(keys.oidc_flow, '{"state":"abc"}')

    assert verify_payload(keys.oidc_flow, signed) == '{"state":"abc"}'


@pytest.mark.parametrize("mutate", ["payload", "signature", "key", "garbage"])
def test_signed_payload_rejects_any_change(mutate: str) -> None:
    keys = _keys()
    signed = sign_payload(keys.oidc_flow, "hello")
    body, _, mac = signed.partition(".")

    if mutate == "payload":
        candidate, key = f"{body}x.{mac}", keys.oidc_flow
    elif mutate == "signature":
        first = "A" if mac[0] != "A" else "B"
        candidate, key = f"{body}.{first}{mac[1:]}", keys.oidc_flow
    elif mutate == "key":
        candidate, key = signed, keys.csrf
    else:
        candidate, key = "not-signed", keys.oidc_flow

    assert verify_payload(key, candidate) is None


@pytest.mark.parametrize("change", [{"iat": "1"}, {"exp": 1.5}, {"iat": True}])
def test_token_with_non_integer_times_is_rejected(change: dict[str, object]) -> None:
    keys = _keys()
    payload: dict[str, object] = {
        "sub": str(USER_ID),
        "sid": str(SESSION_ID),
        "credential_version": 3,
        "role": "user",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=15)).timestamp()),
        **change,
    }
    token = jwt.encode(payload, keys.access, algorithm="HS256")

    with pytest.raises(InvalidAccessTokenError):
        AccessTokenCodec(keys.access).decode_ignoring_expiry(token)


def test_a_correctly_signed_body_that_is_not_utf8_text_is_rejected() -> None:
    key = _keys().oidc_flow
    body = base64.urlsafe_b64encode(b"\xff\xfe\xfd").rstrip(b"=").decode()
    mac = base64.urlsafe_b64encode(hmac.new(key, body.encode(), hashlib.sha256).digest())

    assert verify_payload(key, f"{body}.{mac.rstrip(b'=').decode()}") is None
