"""Unit tests for ``register_exception_handlers`` on a bare FastAPI app (design D4).

The full assembly, middlewares and database are covered by the integration
tests; here only the handler mapping is checked: ``AppError``, Starlette's
``HTTPException`` for ``404``/``405`` (keeping ``Allow``) and
``RequestValidationError``.
"""

from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI
from starlette.exceptions import HTTPException

from app.core.errors import (
    DatabaseUnavailableError,
    NotFoundError,
    register_exception_handlers,
)
from app.core.i18n import MessageCatalog
from app.core.schemas import RequestModel


class Body(RequestModel):
    display_name: str


def _build_app() -> FastAPI:
    app = FastAPI()
    app.state.message_catalog = MessageCatalog.load()
    register_exception_handlers(app)

    @app.get("/missing")
    async def missing() -> None:
        raise NotFoundError()

    @app.get("/database")
    async def database() -> None:
        raise DatabaseUnavailableError()

    @app.get("/teapot")
    async def teapot() -> None:
        raise HTTPException(status_code=418, detail="CANARY-detail")

    @app.post("/body")
    async def body(payload: Body) -> None:
        return None

    return app


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=_build_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.parametrize(
    ("path", "status", "code", "message"),
    [
        ("/missing", 404, "NOT_FOUND", "找不到指定的資源"),
        ("/database", 503, "DATABASE_UNAVAILABLE", "資料庫暫時無法連線，請稍後再試"),
    ],
)
async def test_app_error_becomes_an_error_envelope(
    client: httpx.AsyncClient, path: str, status: int, code: str, message: str
) -> None:
    response = await client.get(path)

    body = response.json()
    assert response.status_code == status
    assert body["success"] is False
    assert body["code"] == code
    assert body["message"] == message
    assert body["data"] is None
    assert body["errors"] is None


async def test_unknown_route_becomes_a_not_found_envelope(client: httpx.AsyncClient) -> None:
    response = await client.get("/no-such-resource")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert response.json()["message"] == "找不到指定的資源"


async def test_wrong_method_becomes_a_method_not_allowed_envelope_with_allow(
    client: httpx.AsyncClient,
) -> None:
    response = await client.delete("/missing")

    assert response.status_code == 405
    assert response.json()["code"] == "METHOD_NOT_ALLOWED"
    assert response.json()["message"] == "不支援這個操作"
    assert "GET" in response.headers["Allow"]


async def test_validation_error_becomes_a_422_envelope_with_details(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post("/body", json={"nickName": "CANARY-value"})

    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "VALIDATION_FAILED"
    assert body["message"] == "輸入資料有誤，請檢查標示的欄位"
    assert {(e["location"], e["field"], e["code"]) for e in body["errors"]} == {
        ("body", "displayName", "missing"),
        ("body", "nickName", "extra_forbidden"),
    }
    assert "CANARY-value" not in response.text


async def test_http_exception_without_a_defined_code_becomes_internal_error(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/teapot")

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.json()["message"] == "系統發生錯誤，請稍後再試"
    assert "CANARY-detail" not in response.text
