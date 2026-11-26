"""Integration tests for trusted proxy handling with a real uvicorn process.

Spec ``trusted-proxy-client-ip``. uvicorn rewrites the client address and scheme
from ``X-Forwarded-For`` and ``X-Forwarded-Proto`` before the app sees the request,
so only a real server process can prove it (design D4). Each subprocess starts the
test-only ``forwarded_probe`` factory with no proxy flags, the same shape as the
image's ``CMD``, and gets its trust list from ``FORWARDED_ALLOW_IPS`` only.

These tests also detect a uvicorn upgrade that changes the right-to-left rule.
"""

from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

from tests.conftest import ALLOWED_ORIGIN
from tests.integration.forwarded_probe import FORWARDED_PROBE_PATH
from tests.integration.uvicorn_process import running_uvicorn, scrubbed_env

pytestmark = pytest.mark.integration

PROBE_TARGET = "tests.integration.forwarded_probe:create_forwarded_probe_app"
NOT_TRUSTED_ALLOW_LIST = "192.0.2.1"


def _serve(tmp_path_factory: pytest.TempPathFactory, allow_list: str | None) -> Iterator[str]:
    extra = {} if allow_list is None else {"FORWARDED_ALLOW_IPS": allow_list}
    env = scrubbed_env(tmp_path_factory.mktemp("proxy"), ALLOWED_ORIGIN, **extra)
    with running_uvicorn(PROBE_TARGET, env) as base_url:
        yield base_url


@pytest.fixture(scope="module")
def untrusted_url(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    """A server whose trust list does not contain the test client's loopback address."""
    yield from _serve(tmp_path_factory, NOT_TRUSTED_ALLOW_LIST)


@pytest.fixture(scope="module")
def trusted_url(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    """A server that trusts only 127.0.0.1, the test client's address."""
    yield from _serve(tmp_path_factory, "127.0.0.1")


@pytest.fixture(scope="module")
def default_url(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    """A server started without ``FORWARDED_ALLOW_IPS`` (uvicorn's loopback default)."""
    yield from _serve(tmp_path_factory, None)


def _report(base_url: str, headers: list[tuple[str, str]]) -> dict[str, str]:
    response = httpx.get(f"{base_url}{FORWARDED_PROBE_PATH}", headers=headers, timeout=5)
    assert response.status_code == 200
    body: dict[str, str] = response.json()
    return body


def test_untrusted_peer_headers_are_ignored(untrusted_url: str) -> None:
    report = _report(
        untrusted_url, [("X-Forwarded-For", "6.6.6.6"), ("X-Forwarded-Proto", "https")]
    )

    assert report == {"client": "127.0.0.1", "scheme": "http"}


def test_untrusted_peer_gets_no_forwarded_address_for_a_chain(untrusted_url: str) -> None:
    report = _report(untrusted_url, [("X-Forwarded-For", "6.6.6.6, 5.5.5.5, 127.0.0.1")])

    assert report["client"] == "127.0.0.1"


def test_trusted_peer_forwarded_address_and_scheme_are_used(trusted_url: str) -> None:
    report = _report(trusted_url, [("X-Forwarded-For", "5.5.5.5"), ("X-Forwarded-Proto", "https")])

    assert report == {"client": "5.5.5.5", "scheme": "https"}


def test_trusted_peer_without_forwarded_headers_reports_the_peer(trusted_url: str) -> None:
    assert _report(trusted_url, []) == {"client": "127.0.0.1", "scheme": "http"}


def test_chain_takes_the_first_untrusted_address_from_the_right(trusted_url: str) -> None:
    report = _report(trusted_url, [("X-Forwarded-For", "6.6.6.6, 5.5.5.5, 127.0.0.1")])

    assert report["client"] == "5.5.5.5"


def test_two_forwarded_for_lines_follow_the_same_rule(trusted_url: str) -> None:
    report = _report(trusted_url, [("X-Forwarded-For", "6.6.6.6"), ("X-Forwarded-For", "7.7.7.7")])

    assert report["client"] == "7.7.7.7"


def test_environment_variable_list_replaces_the_default_without_any_flag(
    untrusted_url: str, default_url: str
) -> None:
    headers = [("X-Forwarded-For", "5.5.5.5")]

    # Control: the default list contains loopback, so the same request is believed.
    assert _report(default_url, headers)["client"] == "5.5.5.5"
    # The env var replaced the default, so loopback is no longer trusted.
    assert _report(untrusted_url, headers)["client"] == "127.0.0.1"


def test_dockerfile_cmd_carries_no_proxy_flags() -> None:
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile"
    cmd_lines = [line for line in dockerfile.read_text().splitlines() if line.startswith("CMD")]

    assert len(cmd_lines) == 1
    for flag in ("--forwarded-allow-ips", "--proxy-headers", "--no-proxy-headers"):
        assert flag not in cmd_lines[0]
