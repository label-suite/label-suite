"""A bad ``FORWARDED_ALLOW_IPS`` stops a real uvicorn process at start-up.

Spec ``runtime-config``: the seven values below would otherwise be silently trusted
as "everyone" or silently dropped by uvicorn. The check runs in ``create_app``, which
uvicorn calls before it wraps the app in its proxy middleware (design D3).
"""

import subprocess
from pathlib import Path

import pytest

from tests.conftest import ALLOWED_ORIGIN
from tests.integration.uvicorn_process import free_port, scrubbed_env, start_uvicorn

pytestmark = pytest.mark.integration

BAD_VALUES = ["*", "0.0.0.0/0", "::/0", "127.0.0.1/8", "localhost", "1.2.3.4,,5.6.7.8", ""]


@pytest.mark.parametrize(
    "value",
    BAD_VALUES,
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
def test_bad_trust_list_stops_uvicorn_naming_the_variable(tmp_path: Path, value: str) -> None:
    env = scrubbed_env(tmp_path, ALLOWED_ORIGIN, FORWARDED_ALLOW_IPS=value)
    server = start_uvicorn("app.main:create_app", free_port(), env)
    try:
        stdout, stderr = server.communicate(timeout=20)
    except subprocess.TimeoutExpired:
        server.kill()
        server.communicate()
        pytest.fail(f"uvicorn kept running with FORWARDED_ALLOW_IPS={value!r}")

    output = stdout + stderr
    assert server.returncode != 0
    assert "FORWARDED_ALLOW_IPS" in output
    assert "Application startup complete" not in output
