"""Integration tests for ``GET /api/v1/health`` through the real app (task 7.1).

Covers spec health-check, the health parts of api-envelope, request-correlation
and response-localization, and the runtime-config scenarios that start the
service and call the health check (design D10).
"""

import asyncio
import logging
import re
import socket
import time
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import Settings
from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN, TEST_DATABASE_URL

pytestmark = pytest.mark.integration

HEALTH_PATH = "/api/v1/health"
SUCCESS_KEYS = {"success", "code", "message", "data", "timestamp", "traceId"}
ERROR_KEYS = SUCCESS_KEYS | {"errors"}
UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
UNAVAILABLE_EN = "The database is temporarily unavailable. Please try again later."

requires_postgres = pytest.mark.skipif(
    TEST_DATABASE_URL is None, reason="needs TEST_DATABASE_URL (PostgreSQL)"
)


@asynccontextmanager
async def _serve(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """Run ``app``'s lifespan and yield a client talking to it in-process."""
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


def _settings(database_url: str, tmp_path: Path) -> Settings:
    return Settings(
        cors_allowed_origins=[ALLOWED_ORIGIN],
        cors_allow_credentials=True,
        database_url=database_url,
        sqlite_path=tmp_path / "unused.db",
    )


def _keys_at_every_level(value: Any) -> Iterator[str]:
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _keys_at_every_level(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keys_at_every_level(item)


# --- success ---------------------------------------------------------------------------


async def test_health_returns_the_full_success_envelope(client: httpx.AsyncClient) -> None:
    response = await client.get(HEALTH_PATH)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == SUCCESS_KEYS
    assert body["success"] is True
    assert body["code"] == "OK"
    assert isinstance(body["message"], str) and body["message"]
    assert isinstance(body["traceId"], str) and body["traceId"]
    assert body["data"] == {"status": "ok", "database": "ok"}


async def test_health_header_matches_the_trace_id_and_is_a_uuid4(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(HEALTH_PATH)

    header = response.headers["X-Correlation-ID"]
    assert header == response.json()["traceId"]
    assert UUID4.match(header)


async def test_health_response_keys_are_camel_case(client: httpx.AsyncClient) -> None:
    body = (await client.get(HEALTH_PATH)).json()

    assert "traceId" in body
    assert "trace_id" not in body
    assert not [key for key in _keys_at_every_level(body) if "_" in key]


@pytest.mark.parametrize(("accept_language", "message"), [("en", "Success"), ("zh-TW", "成功")])
async def test_health_message_follows_the_language_preference(
    client: httpx.AsyncClient, accept_language: str, message: str
) -> None:
    response = await client.get(HEALTH_PATH, headers={"Accept-Language": accept_language})

    assert response.json()["message"] == message


async def test_health_needs_no_credentials(client: httpx.AsyncClient) -> None:
    client.cookies.clear()

    response = await client.get(HEALTH_PATH)

    assert "Authorization" not in response.request.headers
    assert "Cookie" not in response.request.headers
    assert response.status_code == 200


async def test_undeclared_query_parameters_are_ignored(client: httpx.AsyncClient) -> None:
    response = await client.get(HEALTH_PATH, params={"verbose": "true"})

    assert response.status_code == 200
    assert response.json()["data"] == {"status": "ok", "database": "ok"}


async def test_a_body_on_get_is_ignored(client: httpx.AsyncClient) -> None:
    response = await client.request(
        "GET",
        HEALTH_PATH,
        content=b'{"unexpected": 1}',
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"status": "ok", "database": "ok"}


# --- methods ---------------------------------------------------------------------------


@pytest.mark.parametrize("method", ["POST", "DELETE"])
async def test_methods_other_than_get_return_a_405_envelope(
    client: httpx.AsyncClient, method: str
) -> None:
    response = await client.request(method, HEALTH_PATH)

    body = response.json()
    assert response.status_code == 405
    assert set(body) == ERROR_KEYS
    assert body["code"] == "METHOD_NOT_ALLOWED"
    assert body["data"] is None
    assert "GET" in response.headers["Allow"]
    assert body["traceId"] == response.headers["X-Correlation-ID"]


async def test_head_is_not_supported(client: httpx.AsyncClient) -> None:
    response = await client.head(HEALTH_PATH)

    assert response.status_code == 405


# --- deployment information ------------------------------------------------------------


@pytest.mark.postgres
@requires_postgres
async def test_health_response_carries_no_deployment_information(
    client: httpx.AsyncClient,
) -> None:
    assert TEST_DATABASE_URL is not None
    url = make_url(TEST_DATABASE_URL)

    response = await client.get(HEALTH_PATH)

    assert response.status_code == 200
    assert set(response.json()["data"]) == {"status", "database"}
    text = response.text.lower()
    for fragment in ("postgresql", "postgres", "sqlite", "asyncpg", TEST_DATABASE_URL.lower()):
        assert fragment not in text
    for part in (url.host, url.password, url.database):
        assert part is not None
        assert part.lower() not in text


# --- database unavailable --------------------------------------------------------------


def _closed_port() -> int:
    """Return a local port that nothing listens on."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
    return port


async def test_unreachable_database_returns_a_503_envelope(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    port = _closed_port()
    app = create_app(_settings(f"postgresql://CANARY-user:CANARY-pw@127.0.0.1:{port}/x", tmp_path))

    async with _serve(app) as http:
        response = await http.get(HEALTH_PATH, headers={"Accept-Language": "en"})

    body = response.json()
    assert response.status_code == 503
    assert set(body) == ERROR_KEYS
    assert body["success"] is False
    assert body["code"] == "DATABASE_UNAVAILABLE"
    assert body["data"] is None
    assert body["errors"] is None
    assert body["message"] == UNAVAILABLE_EN
    assert body["traceId"] == response.headers["X-Correlation-ID"]
    for fragment in ("CANARY", "127.0.0.1", str(port), "refused", "connect"):
        assert fragment not in response.text
    assert "CANARY" not in caplog.text


async def test_unavailable_message_is_localised(tmp_path: Path) -> None:
    app = create_app(_settings(f"postgresql://u:p@127.0.0.1:{_closed_port()}/x", tmp_path))

    async with _serve(app) as http:
        response = await http.get(HEALTH_PATH, headers={"Accept-Language": "zh-TW"})

    assert response.status_code == 503
    assert response.json()["message"] == "資料庫暫時無法連線，請稍後再試"


async def test_silent_database_times_out_within_the_limit(tmp_path: Path) -> None:
    accepted: list[asyncio.StreamWriter] = []

    async def accept_and_stay_silent(
        _reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        accepted.append(writer)

    server = await asyncio.start_server(accept_and_stay_silent, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    app = create_app(_settings(f"postgresql://u:p@127.0.0.1:{port}/x", tmp_path))
    try:
        async with _serve(app) as http:
            started = time.monotonic()
            response = await http.get(HEALTH_PATH)
            elapsed = time.monotonic() - started
    finally:
        for writer in accepted:
            writer.close()
        server.close()
        await server.wait_closed()

    assert accepted, "the client must have opened a TCP connection that then got no reply"
    assert response.status_code == 503
    assert response.json()["code"] == "DATABASE_UNAVAILABLE"
    assert 4.0 <= elapsed <= 10.0


# --- runtime configuration -------------------------------------------------------------


def _clear_service_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("DATABASE_URL", "SQLITE_PATH", "CORS_ALLOW_CREDENTIALS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ALLOWED_ORIGIN)


async def test_starts_with_only_the_allowed_origins_set(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_service_environment(monkeypatch)
    monkeypatch.chdir(tmp_path)
    assert not (tmp_path / "data").exists()

    async with _serve(create_app()) as http:
        response = await http.get(HEALTH_PATH)

    assert response.status_code == 200
    assert (tmp_path / "data" / "label_suite.db").is_file()


async def test_lite_tier_without_database_url(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_service_environment(monkeypatch)
    lite = tmp_path / "lite.db"
    monkeypatch.setenv("SQLITE_PATH", str(lite))

    async with _serve(create_app()) as http:
        response = await http.get(HEALTH_PATH)

    assert response.status_code == 200
    assert lite.is_file()


def _with_scheme(scheme: str) -> str:
    assert TEST_DATABASE_URL is not None
    _, rest = TEST_DATABASE_URL.split("://", 1)
    return f"{scheme}://{rest}"


@pytest.mark.postgres
@requires_postgres
@pytest.mark.parametrize("scheme", ["postgresql", "postgresql+asyncpg", "postgres"])
async def test_production_tier_with_database_url(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, scheme: str
) -> None:
    _clear_service_environment(monkeypatch)
    lite = tmp_path / "never.db"
    monkeypatch.setenv("SQLITE_PATH", str(lite))
    monkeypatch.setenv("DATABASE_URL", _with_scheme(scheme))

    async with _serve(create_app()) as http:
        response = await http.get(HEALTH_PATH)

    assert response.status_code == 200
    assert not lite.exists()


async def test_connections_return_to_the_pool_after_requests(app: FastAPI) -> None:
    async with _serve(app) as http:
        responses = [await http.get(HEALTH_PATH) for _ in range(20)]
        engine: AsyncEngine = app.state.engine
        checked_out = engine.pool.checkedout()  # type: ignore[attr-defined]

    assert [response.status_code for response in responses] == [200] * 20
    assert checked_out == 0
