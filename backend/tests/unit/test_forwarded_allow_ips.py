"""Unit tests for the ``FORWARDED_ALLOW_IPS`` start-up validation (spec ``runtime-config``).

The setting is validated only; uvicorn does the matching. The rules mirror what uvicorn
would silently mis-handle: ``*`` and a zero prefix trust everyone, host bits, hostnames
and empty items are silently dropped (trusted-proxy-client-ip design D3).
"""

from pathlib import Path

import pytest

from app.core.config import ConfigError, Settings, load_settings

VALID_ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Start from an environment with only a valid ``CORS_ALLOWED_ORIGINS``."""
    monkeypatch.delenv("FORWARDED_ALLOW_IPS", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", VALID_ORIGIN)
    monkeypatch.chdir(tmp_path)


def test_default_trusts_only_loopback() -> None:
    assert load_settings(Settings).forwarded_allow_ips == ["127.0.0.1", "::1"]


@pytest.mark.parametrize(
    "value",
    ["*", "0.0.0.0/0", "::/0", "127.0.0.1/8", "localhost", "1.2.3.4,,5.6.7.8", ""],
    ids=[
        "star",
        "v4-zero-prefix",
        "v6-zero-prefix",
        "host-bits",
        "hostname",
        "empty-item",
        "empty",
    ],
)
def test_unsafe_or_malformed_list_fails_naming_the_variable(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", value)

    with pytest.raises(ConfigError) as excinfo:
        load_settings(Settings)

    assert "FORWARDED_ALLOW_IPS" in str(excinfo.value)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("10.77.250.10", ["10.77.250.10"]),
        ("10.77.250.0/24", ["10.77.250.0/24"]),
        (" 127.0.0.1 , ::1 ", ["127.0.0.1", "::1"]),
        ("127.0.0.1,10.0.0.0/8", ["127.0.0.1", "10.0.0.0/8"]),
    ],
    ids=["single", "cidr", "padded", "mixed"],
)
def test_valid_list_loads_trimmed(
    monkeypatch: pytest.MonkeyPatch, value: str, expected: list[str]
) -> None:
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", value)

    assert load_settings(Settings).forwarded_allow_ips == expected


def test_error_message_never_echoes_the_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "CANARY-host.example")

    with pytest.raises(ConfigError) as excinfo:
        load_settings(Settings)

    message = str(excinfo.value)
    assert "FORWARDED_ALLOW_IPS" in message
    assert "CANARY-host.example" not in message


def test_error_message_does_not_echo_any_item_of_a_mixed_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "10.1.2.3,CANARY-host.example")

    with pytest.raises(ConfigError) as excinfo:
        load_settings(Settings)

    assert "CANARY-host.example" not in str(excinfo.value)
    assert "10.1.2.3" not in str(excinfo.value)
