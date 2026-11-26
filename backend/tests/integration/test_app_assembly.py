"""Integration tests for the assembled app: envelopes, correlation IDs, CORS (task 4.3).

Requests go through ``create_app`` with every production middleware and handler;
the test-only probe router stands in for endpoints that take input. Group 4 has
no ``LocaleMiddleware`` yet, so every message is the zh-TW fallback (design D5).
"""

import io
import logging
import os
import re
import shutil
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import APIRouter, FastAPI

from app.core.config import ConfigError, DatabaseSettings, Settings
from app.core.log_config import is_repo_handler
from app.main import create_api_router, create_app
from tests.conftest import ALLOWED_ORIGIN
from tests.probe import PROBE_PATH

pytestmark = pytest.mark.integration

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
CODE = re.compile(r"^[A-Z][A-Z0-9_]*$")
ERROR_KEYS = {"success", "code", "message", "data", "timestamp", "traceId", "errors"}
MISSING_PATH = "/api/v1/no-such-resource"
BACKEND_DIR = Path(__file__).resolve().parents[2]


def _assert_error_envelope(response: httpx.Response, status: int, code: str) -> dict[str, Any]:
    body: dict[str, Any] = response.json()
    assert response.status_code == status
    assert set(body) == ERROR_KEYS
    assert body["success"] is False
    assert body["code"] == code
    assert CODE.match(body["code"])
    assert body["data"] is None
    assert body["traceId"] == response.headers["X-Correlation-ID"]
    return body


# --- error envelopes -------------------------------------------------------------------


async def test_unknown_path_returns_a_not_found_envelope_with_null_errors(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(MISSING_PATH)

    body = _assert_error_envelope(response, 404, "NOT_FOUND")
    assert body["errors"] is None
    assert body["message"] == "找不到指定的資源"


async def test_unsupported_method_returns_a_method_not_allowed_envelope(
    client: httpx.AsyncClient,
) -> None:
    response = await client.delete(PROBE_PATH)

    body = _assert_error_envelope(response, 405, "METHOD_NOT_ALLOWED")
    assert body["errors"] is None
    # Starlette's Allow lists the methods of the first route matching the path,
    # and the probe declares GET and POST as separate routes.
    allow = {method.strip() for method in response.headers["Allow"].split(",")}
    assert allow
    assert allow <= {"GET", "POST"}


async def test_missing_body_field_returns_a_422_envelope_with_field_errors(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(PROBE_PATH, json={})

    body = _assert_error_envelope(response, 422, "VALIDATION_FAILED")
    assert body["message"] == "輸入資料有誤，請檢查標示的欄位"
    assert all(set(e) == {"location", "field", "code", "message"} for e in body["errors"])
    missing = [e for e in body["errors"] if e["field"] == "displayName"]
    assert len(missing) == 1
    assert missing[0]["location"] == "body"
    assert missing[0]["code"] == "missing"
    assert missing[0]["message"]


async def test_undeclared_body_field_is_rejected(client: httpx.AsyncClient) -> None:
    response = await client.post(PROBE_PATH, json={"displayName": "A", "nickName": "B"})

    body = _assert_error_envelope(response, 422, "VALIDATION_FAILED")
    assert ("body", "nickName", "extra_forbidden") in {
        (e["location"], e["field"], e["code"]) for e in body["errors"]
    }


async def test_snake_case_body_field_is_rejected(client: httpx.AsyncClient) -> None:
    response = await client.post(PROBE_PATH, json={"display_name": "A"})

    body = _assert_error_envelope(response, 422, "VALIDATION_FAILED")
    found = {(e["location"], e["field"], e["code"]) for e in body["errors"]}
    assert ("body", "display_name", "extra_forbidden") in found
    assert ("body", "displayName", "missing") in found


async def test_unparseable_json_returns_a_422_envelope(client: httpx.AsyncClient) -> None:
    response = await client.post(
        PROBE_PATH, content=b'{"displayName":', headers={"Content-Type": "application/json"}
    )

    body = _assert_error_envelope(response, 422, "VALIDATION_FAILED")
    assert body["errors"]
    assert all(e["location"] == "body" for e in body["errors"])
    invalid = [e for e in body["errors"] if e["code"] == "json_invalid"]
    assert invalid
    assert all(e["field"] == "" for e in invalid)


async def test_validation_errors_do_not_echo_submitted_values(client: httpx.AsyncClient) -> None:
    response = await client.post(
        PROBE_PATH, json={"displayName": 12345, "secretAnswer": "CANARY-7f3a"}
    )

    body = _assert_error_envelope(response, 422, "VALIDATION_FAILED")
    assert "CANARY-7f3a" not in response.text
    assert "12345" not in response.text
    assert all(set(e) == {"location", "field", "code", "message"} for e in body["errors"])


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [("GET", PROBE_PATH, None), ("GET", MISSING_PATH, None), ("POST", PROBE_PATH, {})],
)
async def test_envelope_timestamp_is_utc_with_milliseconds(
    client: httpx.AsyncClient, method: str, path: str, payload: dict[str, Any] | None
) -> None:
    response = await client.request(method, path, json=payload)

    timestamp = response.json()["timestamp"]
    assert TIMESTAMP.match(timestamp)
    built = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    assert abs(datetime.now(UTC) - built) < timedelta(seconds=5)


async def test_valid_body_returns_a_success_envelope(client: httpx.AsyncClient) -> None:
    response = await client.post(PROBE_PATH, json={"displayName": "A"})

    assert response.status_code == 200
    assert response.json()["data"] == {"displayName": "A"}
    assert response.json()["message"] == "成功"


# --- correlation IDs -------------------------------------------------------------------


async def test_success_response_header_matches_trace_id(client: httpx.AsyncClient) -> None:
    response = await client.get(PROBE_PATH)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == {"success", "code", "message", "data", "timestamp", "traceId"}
    assert body["code"] == "OK"
    assert response.headers["X-Correlation-ID"] == body["traceId"]
    assert UUID4.match(body["traceId"])


async def test_each_request_gets_a_different_trace_id(client: httpx.AsyncClient) -> None:
    first = await client.get(PROBE_PATH)
    second = await client.get(PROBE_PATH)

    assert first.json()["traceId"] != second.json()["traceId"]


async def test_well_formed_client_correlation_id_is_reused(client: httpx.AsyncClient) -> None:
    response = await client.get(PROBE_PATH, headers={"X-Correlation-ID": "client-trace-0001"})

    assert response.headers["X-Correlation-ID"] == "client-trace-0001"
    assert response.json()["traceId"] == "client-trace-0001"


@pytest.mark.parametrize("value", ["abc", "trace_0001x", "a" * 65])
async def test_malformed_client_correlation_id_is_discarded(
    client: httpx.AsyncClient, value: str
) -> None:
    response = await client.get(PROBE_PATH, headers={"X-Correlation-ID": value})

    assert response.json()["traceId"] != value
    assert UUID4.match(response.json()["traceId"])
    assert response.headers["X-Correlation-ID"] == response.json()["traceId"]


async def test_not_found_response_carries_the_correlation_id(client: httpx.AsyncClient) -> None:
    response = await client.get(MISSING_PATH)

    assert response.headers["X-Correlation-ID"] == response.json()["traceId"]


# --- CORS ------------------------------------------------------------------------------


def _preflight_headers() -> dict[str, str]:
    return {
        "Origin": ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "accept-language,x-correlation-id",
    }


async def test_preflight_response_carries_the_correlation_id(client: httpx.AsyncClient) -> None:
    response = await client.options(PROBE_PATH, headers=_preflight_headers())

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"]


async def test_preflight_lists_methods_and_headers_explicitly(client: httpx.AsyncClient) -> None:
    response = await client.options(PROBE_PATH, headers=_preflight_headers())

    methods = [m.strip() for m in response.headers["Access-Control-Allow-Methods"].split(",")]
    allowed = {
        h.strip().lower() for h in response.headers["Access-Control-Allow-Headers"].split(",")
    }
    assert methods == ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    assert {"accept-language", "x-correlation-id"} <= allowed
    assert "*" not in allowed


async def test_allowed_origin_gets_cross_origin_headers(client: httpx.AsyncClient) -> None:
    response = await client.get(PROBE_PATH, headers={"Origin": ALLOWED_ORIGIN})

    assert response.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


async def test_allowed_origin_response_exposes_the_correlation_header(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(PROBE_PATH, headers={"Origin": ALLOWED_ORIGIN})

    exposed = {
        h.strip().lower() for h in response.headers["Access-Control-Expose-Headers"].split(",")
    }
    assert "x-correlation-id" in exposed


async def test_unlisted_origin_gets_no_cross_origin_headers(client: httpx.AsyncClient) -> None:
    response = await client.get(PROBE_PATH, headers={"Origin": "http://evil.example"})

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers


async def test_unlisted_origin_preflight_is_not_an_error_envelope(
    client: httpx.AsyncClient,
) -> None:
    response = await client.options(
        "/api/v1/health",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
    )

    assert 400 <= response.status_code < 500
    assert "Access-Control-Allow-Origin" not in response.headers
    try:
        body = response.json()
    except ValueError:
        body = None
    assert not (isinstance(body, dict) and {"success", "code", "traceId"} <= set(body))


# --- start-up --------------------------------------------------------------------------


def test_server_refuses_to_start_without_allowed_origins(tmp_path: Path) -> None:
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"CORS_ALLOWED_ORIGINS", "DATABASE_URL", "TEST_DATABASE_URL"}
    }
    env["SQLITE_PATH"] = str(tmp_path / "app.db")

    uv = shutil.which("uv")
    assert uv is not None, "the start-up test runs the documented `uv run uvicorn` command"

    result = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [uv, "run", "uvicorn", "app.main:create_app", "--factory", "--port", "0"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    assert result.returncode != 0
    assert "CORS_ALLOWED_ORIGINS" in result.stderr


# --- log output (request-access-log task 1.3) -----------------------------------------

_LOG_PROBE_PATH = "/api/v1/probe-log-levels"


def _with_log_level_probe(app: FastAPI) -> FastAPI:
    router = APIRouter()

    @router.get("/probe-log-levels")
    async def log_levels() -> dict[str, str]:
        logger = logging.getLogger("app.probe")
        logger.info("CANARY-info-record")
        logger.debug("CANARY-debug-record")
        return {}

    api = create_api_router()
    api.include_router(router)
    app.include_router(api)
    return app


def _create_app_from_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, log_level: str | None
) -> tuple[FastAPI, io.StringIO]:
    """Build the app from the environment with stderr redirected to a buffer."""
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ALLOWED_ORIGIN)
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "app.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    if log_level is None:
        monkeypatch.delenv("LOG_LEVEL", raising=False)
    else:
        monkeypatch.setenv("LOG_LEVEL", log_level)
    stderr = io.StringIO()
    monkeypatch.setattr(sys, "stderr", stderr)
    return create_app(), stderr


async def _get(app: FastAPI, path: str) -> httpx.Response:
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            return await http.get(path)


def test_creating_the_app_twice_keeps_one_repo_root_handler(tmp_path: Path) -> None:
    settings = Settings(
        cors_allowed_origins=[ALLOWED_ORIGIN],
        database_url=None,
        sqlite_path=tmp_path / "app.db",
    )

    create_app(settings)
    create_app(settings)

    assert sum(is_repo_handler(handler) for handler in logging.getLogger().handlers) == 1


async def test_info_is_written_and_debug_is_not_when_log_level_is_unset(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    app, stderr = _create_app_from_env(monkeypatch, tmp_path, None)

    response = await _get(_with_log_level_probe(app), _LOG_PROBE_PATH)

    assert response.status_code == 200
    output = stderr.getvalue()
    assert re.search(
        r"level=INFO logger=app\.probe traceId=\S+ msg=CANARY-info-record$", output, re.M
    )
    assert "CANARY-debug-record" not in output


@pytest.mark.parametrize("log_level", ["warning", "WARNING"])
async def test_warning_log_level_drops_info_whatever_its_case(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, log_level: str
) -> None:
    app, stderr = _create_app_from_env(monkeypatch, tmp_path, log_level)

    response = await _get(_with_log_level_probe(app), _LOG_PROBE_PATH)

    assert response.status_code == 200
    assert "CANARY-info-record" not in stderr.getvalue()
    assert "level=INFO" not in stderr.getvalue()


def test_invalid_log_level_fails_before_logging_is_configured(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    root = logging.getLogger()
    root_level = root.level

    with pytest.raises(ConfigError) as caught:
        _create_app_from_env(monkeypatch, tmp_path, "CANARY-verbose")

    assert "LOG_LEVEL" in str(caught.value)
    assert "CANARY-verbose" not in str(caught.value)
    assert not any(is_repo_handler(handler) for handler in root.handlers)
    assert root.level == root_level


@pytest.mark.parametrize("log_level", [None, "DEBUG"])
async def test_lite_health_check_writes_no_database_records(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, log_level: str | None
) -> None:
    # Explicitly Lite (SQLite through aiosqlite), even when TEST_DATABASE_URL is set.
    database = DatabaseSettings(database_url=None, sqlite_path=tmp_path / "lite.db")
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    settings = Settings(
        cors_allowed_origins=[ALLOWED_ORIGIN],
        database_url=database.database_url,
        sqlite_path=database.sqlite_path,
        **({} if log_level is None else {"log_level": log_level}),
    )
    stderr = io.StringIO()
    monkeypatch.setattr(sys, "stderr", stderr)
    app = create_app(settings)

    response = await _get(app, "/api/v1/health")

    assert response.status_code == 200
    output = stderr.getvalue()
    assert "SELECT 1" not in output
    assert not re.search(r"level=(INFO|DEBUG) logger=(sqlalchemy|aiosqlite|asyncpg)", output), (
        output
    )
