"""Helpers for tests that run a real uvicorn subprocess (not collected as tests).

Shared by the access-log and trusted-proxy integration tests so the port, the
health wait and the environment scrubbing live in one place.
"""

import os
import socket
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import IO

import httpx

HEALTH_PATH = "/api/v1/health"
BACKEND_DIR = Path(__file__).resolve().parents[2]
_SCRUBBED = {"DATABASE_URL", "TEST_DATABASE_URL", "LOG_LEVEL", "SQLITE_PATH", "FORWARDED_ALLOW_IPS"}


def free_port() -> int:
    """Return a TCP port on 127.0.0.1 that was free a moment ago."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
    return port


def wait_until_healthy(base_url: str, server: subprocess.Popen[str]) -> None:
    """Block until ``GET /api/v1/health`` answers 200 or fail after 30 seconds.

    Raises:
        AssertionError: When the process exits first or never becomes healthy.
    """
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        assert server.poll() is None, "uvicorn exited before it became healthy"
        try:
            if httpx.get(f"{base_url}{HEALTH_PATH}", timeout=1).status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(0.2)
    raise AssertionError("uvicorn did not become healthy within 30 seconds")


def scrubbed_env(tmp_path: Path, cors_origin: str, **extra: str) -> dict[str, str]:
    """Return the parent environment without settings that would leak into the child.

    The child gets its own ``SQLITE_PATH`` under ``tmp_path`` and ``cors_origin`` as the
    only allowed origin; ``extra`` adds or overrides further variables.
    """
    env = {key: value for key, value in os.environ.items() if key not in _SCRUBBED}
    env["CORS_ALLOWED_ORIGINS"] = cors_origin
    env["SQLITE_PATH"] = str(tmp_path / "app.db")
    env.update(extra)
    return env


def start_uvicorn(
    target: str,
    port: int,
    env: dict[str, str],
    output: IO[str] | None = None,
) -> subprocess.Popen[str]:
    """Start ``python -m uvicorn <target> --factory`` on 127.0.0.1 with no proxy flags.

    ``output`` receives both stdout and stderr when given (a file the caller reads
    later); otherwise they are pipes the caller must drain with ``communicate``.
    """
    sink = output if output is not None else subprocess.PIPE
    return subprocess.Popen(  # noqa: S603 - fixed argv, no shell
        [
            sys.executable,
            "-m",
            "uvicorn",
            target,
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=BACKEND_DIR,
        env=env,
        stdout=sink,
        stderr=subprocess.STDOUT if output is not None else subprocess.PIPE,
        text=True,
    )


@contextmanager
def running_uvicorn(target: str, env: dict[str, str]) -> Iterator[str]:
    """Run a healthy uvicorn subprocess and yield its base URL; stop it on exit.

    The server's output goes to a temporary file, so a long-lived server never
    blocks on a full pipe; when it fails to become healthy the output is appended
    to the error.
    """
    port = free_port()
    base_url = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as output:
        server = start_uvicorn(target, port, env, output)
        try:
            try:
                wait_until_healthy(base_url, server)
            except AssertionError as error:
                output.flush()
                output.seek(0)
                raise AssertionError(f"{error}\n{output.read()}") from error
            yield base_url
        finally:
            server.terminate()
            try:
                server.wait(timeout=30)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
