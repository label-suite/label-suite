"""Integration tests for the access log and trace IDs in log output (spec server-logging).

Requests go through ``create_app`` with the test-only probes; the assertions read
the real one-line ``key=value`` output that this repository's root handler writes,
captured by re-running ``configure_logging`` with a ``StringIO`` (design D6).

The in-process test client (httpx) logs its own request lines, full URL
included; that is the test harness, not the server, so its logger is held at
``WARNING`` here.
"""

import io
import logging
import os
import re
import socket
import subprocess
import sys
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import APIRouter, FastAPI
from pydantic import SecretStr

from app.core.config import LogLevel, Settings
from app.core.middleware import route_template
from app.main import create_api_router, create_app
from tests.conftest import ALLOWED_ORIGIN, TEST_AUTH_SECRET, make_test_settings
from tests.integration.uvicorn_process import free_port, wait_until_healthy
from tests.probe import (
    BAD_GATEWAY_PATH,
    CRASH_PATH,
    ITEM_ROUTE,
    PROBE_PATH,
    TEAPOT_PATH,
    THIRD_PARTY_LOG_PATH,
    THIRD_PARTY_LOGGER,
    probe_router,
)

pytestmark = pytest.mark.integration

HEALTH_PATH = "/api/v1/health"
MISSING_PATH = "/api/v1/no-such-resource"
ACCESS_LINE = re.compile(
    r"^timestamp=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z level=(?P<level>\S+) "
    r"logger=app\.access traceId=(?P<trace>\S+) method=(?P<method>\S+) route=(?P<route>\S+) "
    r"status=(?P<status>\d{3}) durationMs=(?P<duration>\S+) msg=.+$"
)

Capture = Callable[[Settings], io.StringIO]


class LogTap:
    """Reads what the root handler wrote since the previous read."""

    def __init__(self, buffer: io.StringIO) -> None:
        self.buffer = buffer
        self.offset = 0

    def new_lines(self) -> list[str]:
        text = self.buffer.getvalue()
        lines = text[self.offset :].splitlines()
        self.offset = len(text)
        return lines


def _access_lines(lines: list[str]) -> list[str]:
    return [line for line in lines if " logger=app.access " in line]


def _access(lines: list[str]) -> re.Match[str]:
    access = _access_lines(lines)
    assert len(access) == 1, lines
    match = ACCESS_LINE.match(access[0])
    assert match is not None, access[0]
    return match


def _level(line: str) -> str:
    match = re.search(r" level=(\S+) ", line)
    assert match is not None, line
    return match.group(1)


def _with_probes(app: FastAPI) -> FastAPI:
    api = create_api_router()
    api.include_router(probe_router)
    app.include_router(api)
    return app


@asynccontextmanager
async def _serve(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


@pytest.fixture(autouse=True)
def quiet_test_client() -> Iterator[None]:
    """Keep the httpx test client's own INFO request lines out of the server output."""
    logger = logging.getLogger("httpx")
    level = logger.level
    logger.setLevel(logging.WARNING)
    yield
    logger.setLevel(level)


@pytest.fixture
def tap(app: FastAPI, capture_logs: Capture) -> LogTap:
    """Re-point the root handler of the probe app at a buffer (after ``create_app``)."""
    return LogTap(capture_logs(app.state.settings))


async def _request(
    client: httpx.AsyncClient, tap: LogTap, method: str, path: str, **kwargs: Any
) -> tuple[httpx.Response, list[str]]:
    tap.new_lines()
    response = await client.request(method, path, **kwargs)
    return response, tap.new_lines()


# --- one access line per /api/v1 request ----------------------------------------------


async def test_successful_request_writes_one_info_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(
        client, tap, "GET", "/api/v1/items/42", headers={"X-Correlation-ID": "client-trace-0001"}
    )

    assert response.status_code == 200
    line = _access(lines)
    assert line["level"] == "INFO"
    assert line["method"] == "GET"
    assert line["route"] == ITEM_ROUTE
    assert line["status"] == "200"
    assert line["trace"] == "client-trace-0001"
    assert re.fullmatch(r"\d+\.\d", line["duration"])
    assert "/api/v1/items/42" not in "\n".join(lines)


async def test_access_route_carries_the_api_v1_prefix(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    # Pins design D5 / N4: the template comes from iter_route_contexts with the
    # include_router prefix, not from scope["route"].path ("/items/{item_id}").
    _, lines = await _request(client, tap, "GET", "/api/v1/items/7")

    assert _access(lines)["route"] == "/api/v1/items/{item_id}"


async def test_method_not_allowed_writes_the_route_template(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "POST", HEALTH_PATH)

    assert response.status_code == 405
    line = _access(lines)
    assert line["level"] == "WARNING"
    assert line["route"] == HEALTH_PATH
    assert line["status"] == "405"


@pytest.mark.parametrize(
    ("path", "headers", "status"),
    [(MISSING_PATH, {}, 404), (HEALTH_PATH, {"Accept-Language": "fr"}, 406)],
    ids=["not-found", "not-acceptable"],
)
async def test_request_without_a_route_template_writes_the_placeholder(
    client: httpx.AsyncClient, tap: LogTap, path: str, headers: dict[str, str], status: int
) -> None:
    response, lines = await _request(client, tap, "GET", path, headers=headers)

    assert response.status_code == status
    line = _access(lines)
    assert line["level"] == "WARNING"
    assert line["route"] == "<unmatched>"
    assert line["status"] == str(status)
    assert "no-such-resource" not in "\n".join(lines)


# --- levels by status -----------------------------------------------------------------


async def test_client_error_writes_one_warning_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "POST", PROBE_PATH, json={})

    assert response.status_code == 422
    line = _access(lines)
    assert line["level"] == "WARNING"
    assert line["method"] == "POST"
    assert line["route"] == PROBE_PATH
    assert line["status"] == "422"


async def test_server_error_not_logged_before_writes_one_error_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "GET", BAD_GATEWAY_PATH)

    assert response.status_code == 502
    assert [_level(line) for line in lines] == ["ERROR"]
    line = _access(lines)
    assert line["level"] == "ERROR"
    assert line["status"] == "502"
    assert line["route"] == BAD_GATEWAY_PATH


# --- errors are logged once -----------------------------------------------------------


async def test_unhandled_exception_leaves_one_error_record_and_no_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "GET", CRASH_PATH)

    assert response.status_code == 500
    trace_id = response.json()["traceId"]
    errors = [line for line in lines if _level(line) == "ERROR"]
    assert len(errors) == 1
    assert CRASH_PATH in errors[0]
    assert f" traceId={trace_id} " in errors[0]
    assert errors[0].count("traceId=") == 1
    assert _access_lines(lines) == []


async def test_message_with_newlines_is_still_one_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    _, lines = await _request(client, tap, "GET", CRASH_PATH)

    assert lines and all(line.startswith("timestamp=") for line in lines)
    (error,) = [line for line in lines if _level(line) == "ERROR"]
    assert "\\nTraceback (most recent call last):\\n" in error
    assert "Traceback" not in "\n".join(lines).replace(error, "")


async def test_unmapped_status_leaves_one_error_record_and_no_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "GET", TEAPOT_PATH)

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    errors = [line for line in lines if _level(line) == "ERROR"]
    assert len(errors) == 1
    assert f" traceId={response.json()['traceId']} " in errors[0]
    msg = errors[0].split(" msg=", 1)[1]
    assert "traceId=" not in msg
    assert _access_lines(lines) == []


def _closed_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
    return port


async def test_unreachable_database_leaves_one_warning_record_with_the_trace_id(
    tmp_path: Path, capture_logs: Capture
) -> None:
    settings = Settings(
        cors_allowed_origins=[ALLOWED_ORIGIN],
        database_url=f"postgresql://u:p@127.0.0.1:{_closed_port()}/x",
        sqlite_path=tmp_path / "unused.db",
        auth_secret=SecretStr(TEST_AUTH_SECRET),
    )
    app = create_app(settings)
    tap = LogTap(capture_logs(settings))

    async with _serve(app) as http:
        tap.new_lines()
        response = await http.get(HEALTH_PATH, headers={"X-Correlation-ID": "client-trace-0002"})
        lines = tap.new_lines()

    assert response.status_code == 503
    serious = [line for line in lines if _level(line) in {"WARNING", "ERROR", "CRITICAL"}]
    assert len(serious) == 1
    (warning,) = serious
    assert _level(warning) == "WARNING"
    assert " logger=app.modules.health.service traceId=client-trace-0002 " in warning
    assert warning.count("traceId=") == 1
    msg = warning.split(" msg=", 1)[1]
    assert "client-trace-0002" not in msg
    assert _access_lines(lines) == []


# --- health check and the paths outside /api/v1 ---------------------------------------


async def test_successful_health_check_writes_no_access_line(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "GET", HEALTH_PATH)
    assert response.status_code == 200
    assert _access_lines(lines) == []

    response, lines = await _request(client, tap, "POST", HEALTH_PATH)

    assert response.status_code == 405
    assert len(_access_lines(lines)) == 1


@pytest.mark.parametrize(
    ("method", "path", "headers"),
    [
        (
            "OPTIONS",
            HEALTH_PATH,
            {"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET"},
        ),
        ("GET", "/docs", {}),
        ("GET", "/openapi.json", {}),
        ("GET", "/no-such-path", {}),
    ],
    ids=["preflight", "docs", "openapi", "outside-api-v1"],
)
async def test_preflight_and_paths_outside_api_v1_write_no_access_line(
    client: httpx.AsyncClient, tap: LogTap, method: str, path: str, headers: dict[str, str]
) -> None:
    response, lines = await _request(client, tap, method, path, headers=headers)

    assert response.status_code in {200, 404}
    assert _access_lines(lines) == []


# --- no request content in the log ----------------------------------------------------


async def test_log_output_has_no_query_body_headers_cookies_or_client_address(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(
        client,
        tap,
        "POST",
        f"{PROBE_PATH}?q=CANARY-query",
        json={"displayName": "CANARY-body"},
        headers={
            "Cookie": "session=CANARY-cookie",
            "Authorization": "Bearer CANARY-auth",
            "X-Custom": "CANARY-header",
        },
    )

    assert response.status_code == 200
    output = "\n".join(lines)
    for canary in ("CANARY-query", "CANARY-cookie", "CANARY-auth", "CANARY-header", "CANARY-body"):
        assert canary not in output
    line = _access(lines)
    assert line["route"] == PROBE_PATH
    # httpx.ASGITransport reports the client as 127.0.0.1:123.
    assert "127.0.0.1" not in line.group(0)
    assert ":123" not in line.group(0)


async def test_path_parameter_value_never_reaches_the_log(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    response, lines = await _request(client, tap, "GET", "/api/v1/items/CANARY-answer")

    assert response.status_code == 200
    assert _access(lines)["route"] == ITEM_ROUTE
    assert "CANARY-answer" not in "\n".join(lines)


# --- trace IDs on every record --------------------------------------------------------


async def test_third_party_record_carries_the_trace_id(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    _, lines = await _request(
        client, tap, "GET", THIRD_PARTY_LOG_PATH, headers={"X-Correlation-ID": "client-trace-0003"}
    )

    (record,) = [line for line in lines if f" logger={THIRD_PARTY_LOGGER} " in line]
    assert " level=WARNING " in record
    assert " traceId=client-trace-0003 " in record


# --- format and level -----------------------------------------------------------------


async def test_access_line_matches_the_full_key_value_layout(
    client: httpx.AsyncClient, tap: LogTap
) -> None:
    _, lines = await _request(client, tap, "GET", "/api/v1/items/42")

    (line,) = _access_lines(lines)
    assert re.fullmatch(
        r"timestamp=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z level=INFO logger=app\.access "
        r"traceId=\S+ method=GET route=/api/v1/items/\{item_id\} status=200 "
        r"durationMs=\d+\.\d msg=.+",
        line,
    )


def _probe_app(tmp_path: Path, log_level: LogLevel) -> FastAPI:
    settings = make_test_settings(tmp_path).model_copy(update={"log_level": log_level})
    return _with_probes(create_app(settings))


async def test_warning_log_level_drops_info_records_and_keeps_warnings(
    tmp_path: Path, capture_logs: Capture
) -> None:
    app = _probe_app(tmp_path, "WARNING")
    tap = LogTap(capture_logs(app.state.settings))

    async with _serve(app) as http:
        tap.new_lines()
        ok = await http.get("/api/v1/items/42")
        missing = await http.get(MISSING_PATH)
        lines = tap.new_lines()

    assert (ok.status_code, missing.status_code) == (200, 404)
    assert not [line for line in lines if " level=INFO " in line]
    line = _access(lines)
    assert line["level"] == "WARNING"
    assert line["status"] == "404"


# --- route_template -------------------------------------------------------------------


async def test_route_mounted_under_two_prefixes_resolves_to_the_matching_one(
    tmp_path: Path, capture_logs: Capture
) -> None:
    app = create_app(make_test_settings(tmp_path))
    shared = APIRouter()

    @shared.get("/shared/{key}")
    async def shared_route(key: str) -> dict[str, str]:
        return {}

    for prefix in ("/one", "/two"):
        api = create_api_router()
        api.include_router(shared, prefix=prefix)
        app.include_router(api)
    tap = LogTap(capture_logs(app.state.settings))

    async with _serve(app) as http:
        tap.new_lines()
        await http.get("/api/v1/two/shared/x")
        lines = tap.new_lines()

    assert _access(lines)["route"] == "/api/v1/two/shared/{key}"


def test_route_template_is_none_without_a_matched_route(tmp_path: Path) -> None:
    app = create_app(make_test_settings(tmp_path))

    assert route_template({"type": "http", "app": app, "path": MISSING_PATH}) is None


# --- uvicorn's built-in access log ----------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[2]


def test_uvicorn_built_in_access_log_is_off(tmp_path: Path) -> None:
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"DATABASE_URL", "TEST_DATABASE_URL", "LOG_LEVEL", "SQLITE_PATH"}
    }
    env["CORS_ALLOWED_ORIGINS"] = ALLOWED_ORIGIN
    env["SQLITE_PATH"] = str(tmp_path / "app.db")
    port = free_port()
    base_url = f"http://127.0.0.1:{port}"

    # No --no-access-log on purpose: create_app itself must turn it off (Q10).
    server = subprocess.Popen(  # noqa: S603 - fixed argv, no shell
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_until_healthy(base_url, server)
        response = httpx.get(f"{base_url}{HEALTH_PATH}", params={"q": "CANARY-query"}, timeout=5)
        assert response.status_code == 200
    finally:
        server.terminate()
        stdout, stderr = server.communicate(timeout=30)

    output = stdout + stderr
    assert "CANARY-query" not in output
    assert '"GET /api/v1/health' not in output
    startup = [line for line in output.splitlines() if "Application startup complete" in line]
    assert len(startup) == 1
    assert " traceId=- " in startup[0]
    assert startup[0].startswith("timestamp=")
