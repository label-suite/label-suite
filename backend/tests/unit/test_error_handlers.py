"""Unit tests for ``register_exception_handlers`` on a bare FastAPI app (design D4).

The full assembly, middlewares and database are covered by the integration
tests; here only the handler mapping is checked: ``AppError``, Starlette's
``HTTPException`` for ``404``/``405`` (keeping ``Allow``) and
``RequestValidationError``; and which of them mark the request as already
logged (request-access-log design D2).
"""

import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from starlette.exceptions import HTTPException

from app.core.errors import (
    AppError,
    DatabaseUnavailableError,
    NotFoundError,
    register_exception_handlers,
)
from app.core.i18n import MessageCatalog
from app.core.log_config import install_trace_id_record_factory, is_error_logged
from app.core.middleware import CorrelationIdMiddleware
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

    @app.get("/database-logged")
    async def database_logged() -> None:
        raise DatabaseUnavailableError(already_logged=True)

    @app.get("/teapot")
    async def teapot() -> None:
        raise HTTPException(status_code=418, detail="CANARY-detail")

    @app.get("/teapot/{name}")
    async def named_teapot(name: str) -> None:
        raise HTTPException(status_code=418)

    @app.post("/body")
    async def body(payload: Body) -> None:
        return None

    app.add_middleware(CorrelationIdMiddleware)
    return app


class _ScopeRecorder:
    """Wraps an ASGI app and keeps every HTTP scope after the app returns."""

    def __init__(self, app: FastAPI) -> None:
        self.app = app
        self.scopes: list[dict[str, Any]] = []

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        await self.app(scope, receive, send)
        if scope["type"] == "http":
            self.scopes.append(scope)


@pytest.fixture
def recorder() -> _ScopeRecorder:
    return _ScopeRecorder(_build_app())


@pytest.fixture
async def client(recorder: _ScopeRecorder) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=recorder)
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


async def test_unmapped_http_exception_log_escapes_the_request_path(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR)

    response = await client.get("/teapot/%1B%5B31mFORGED")

    assert response.status_code == 500
    errors = [record for record in caplog.records if record.levelno == logging.ERROR]
    assert len(errors) == 1
    message = errors[0].getMessage()
    assert "GET /teapot/\\x1b[31mFORGED" in message
    assert "\x1b" not in message


async def test_unmapped_http_exception_log_carries_the_trace_id_outside_the_message(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR)
    install_trace_id_record_factory()

    response = await client.get("/teapot")

    errors = [record for record in caplog.records if record.levelno == logging.ERROR]
    assert len(errors) == 1
    assert getattr(errors[0], "trace_id", None) == response.json()["traceId"]
    assert "traceId=" not in errors[0].getMessage()
    assert response.json()["traceId"] not in errors[0].getMessage()


# --- already-logged marker (request-access-log design D2) -----------------------------


@pytest.mark.parametrize(
    ("path", "marked"),
    [
        ("/teapot", True),
        ("/database-logged", True),
        ("/database", False),
        ("/missing", False),
        ("/no-such-resource", False),
    ],
)
async def test_only_errors_already_logged_mark_the_request(
    client: httpx.AsyncClient, recorder: _ScopeRecorder, path: str, marked: bool
) -> None:
    await client.get(path)

    (scope,) = recorder.scopes
    assert is_error_logged(scope) is marked


def test_app_error_is_not_already_logged_by_default() -> None:
    assert AppError().already_logged is False
    assert NotFoundError().already_logged is False
    assert DatabaseUnavailableError(already_logged=True).already_logged is True


async def test_already_logged_never_reaches_the_response(client: httpx.AsyncClient) -> None:
    response = await client.get("/database-logged")

    assert response.status_code == 503
    assert set(response.json()) == {
        "success",
        "code",
        "message",
        "data",
        "timestamp",
        "traceId",
        "errors",
    }
    assert "already" not in response.text.lower()
    assert "logged" not in response.text.lower()
