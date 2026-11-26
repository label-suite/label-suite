"""Integration tests for the API_DOCS_ENABLED switch (spec runtime-config)."""

from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app
from tests.conftest import make_test_settings

pytestmark = pytest.mark.integration

DOC_PATHS = ["/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"]
ERROR_KEYS = {"success", "code", "message", "data", "timestamp", "traceId", "errors"}


def _client(settings: Settings) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=create_app(settings))
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


def _settings(tmp_path: Path, enabled: bool | None) -> Settings:
    base = make_test_settings(tmp_path)
    if enabled is None:
        return base
    return base.model_copy(update={"api_docs_enabled": enabled})


@pytest.mark.parametrize("enabled", [None, True])
@pytest.mark.parametrize("path", DOC_PATHS)
async def test_docs_routes_are_served_by_default_and_when_true(
    tmp_path: Path, enabled: bool | None, path: str
) -> None:
    async with _client(_settings(tmp_path, enabled)) as http:
        response = await http.get(path)

    assert response.status_code == 200
    if response.headers["content-type"].startswith("application/json"):
        assert "success" not in response.json()


@pytest.mark.parametrize("path", DOC_PATHS)
async def test_docs_routes_return_the_not_found_envelope_when_disabled(
    tmp_path: Path, path: str
) -> None:
    async with _client(_settings(tmp_path, False)) as http:
        response = await http.get(path)
        missing = await http.get("/no-such-path")

    body = response.json()
    assert response.status_code == 404
    assert set(body) == ERROR_KEYS
    assert body["success"] is False
    assert body["code"] == "NOT_FOUND"
    reference = missing.json()
    assert body["message"] == reference["message"]
    assert set(body) == set(reference)
    assert body["errors"] == reference["errors"]


async def test_business_endpoints_still_work_when_docs_are_disabled(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path, False))
    transport = httpx.ASGITransport(app=app)
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=transport, base_url="http://testserver") as http,
    ):
        response = await http.get("/api/v1/health")

    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True
