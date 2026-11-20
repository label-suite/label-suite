"""Integration tests for localisation, 406 and unhandled exceptions (task 5.1).

The probe ``GET`` stands in for the health check until group 7 adds it.
"""

import logging
from typing import Any

import httpx
import pytest

from tests.conftest import ALLOWED_ORIGIN
from tests.probe import (
    BAD_RESPONSE_PATH,
    CRASH_MESSAGE,
    CRASH_PATH,
    DB_ERROR_PATH,
    PROBE_PATH,
)

ERROR_KEYS = {"success", "code", "message", "data", "timestamp", "traceId", "errors"}
MISSING_PATH = "/api/v1/no-such-resource"


def _assert_error(response: httpx.Response, status: int, code: str) -> dict[str, Any]:
    body: dict[str, Any] = response.json()
    assert response.status_code == status
    assert set(body) == ERROR_KEYS
    assert body["success"] is False
    assert body["code"] == code
    assert body["data"] is None
    assert body["errors"] is None
    assert body["traceId"] == response.headers["X-Correlation-ID"]
    return body


# --- message language ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("accept_language", "message", "content_language"),
    [
        ("en", "Success", "en"),
        ("zh-TW", "成功", "zh-TW"),
        ("zh-TW;q=0.5, en;q=0.9", "Success", "en"),
        ("fr, en;q=0.5", "Success", "en"),
        ("fr, *;q=0.1", "成功", "zh-TW"),
        ("zh", "成功", "zh-TW"),
        ("zh-Hant", "成功", "zh-TW"),
        ("ZH-tw", "成功", "zh-TW"),
        ("EN", "Success", "en"),
    ],
)
async def test_success_message_follows_the_language_preference(
    client: httpx.AsyncClient, accept_language: str, message: str, content_language: str
) -> None:
    response = await client.get(PROBE_PATH, headers={"Accept-Language": accept_language})

    assert response.status_code == 200
    assert response.json()["message"] == message
    assert response.headers["Content-Language"] == content_language


async def test_message_defaults_to_zh_tw_without_a_preference(client: httpx.AsyncClient) -> None:
    response = await client.get(MISSING_PATH)

    assert response.json()["message"] == "找不到指定的資源"
    assert response.headers["Content-Language"] == "zh-TW"


async def test_error_message_is_localised_too(client: httpx.AsyncClient) -> None:
    response = await client.get(MISSING_PATH, headers={"Accept-Language": "en"})

    assert response.json()["message"] == "The requested resource was not found."


async def test_success_and_error_responses_both_carry_content_language(
    client: httpx.AsyncClient,
) -> None:
    success = await client.get(PROBE_PATH, headers={"Accept-Language": "en"})
    failure = await client.get(MISSING_PATH, headers={"Accept-Language": "en"})

    assert success.headers["Content-Language"] == "en"
    assert failure.headers["Content-Language"] == "en"


async def test_field_error_messages_stay_english(client: httpx.AsyncClient) -> None:
    response = await client.post(PROBE_PATH, json={}, headers={"Accept-Language": "zh-TW"})

    body = response.json()
    assert body["message"] == "輸入資料有誤，請檢查標示的欄位"
    field = next(e for e in body["errors"] if e["field"] == "displayName")
    assert field["message"] == "Field required"


# --- 406 -------------------------------------------------------------------------------


@pytest.mark.parametrize("accept_language", ["fr", "zh-TW;q=0, en;q=0, *;q=0"])
async def test_only_rejected_languages_returns_a_zh_tw_406(
    client: httpx.AsyncClient, accept_language: str
) -> None:
    response = await client.get(PROBE_PATH, headers={"Accept-Language": accept_language})

    body = _assert_error(response, 406, "NOT_ACCEPTABLE")
    assert body["message"] == "不支援所要求的語言"
    assert response.headers["Content-Language"] == "zh-TW"


async def test_paths_outside_api_v1_never_return_406(client: httpx.AsyncClient) -> None:
    response = await client.get("/openapi.json", headers={"Accept-Language": "fr"})

    assert response.status_code != 406


# --- unhandled exceptions --------------------------------------------------------------


async def test_unhandled_exception_returns_a_500_envelope_without_internals(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(CRASH_PATH, headers={"Origin": ALLOWED_ORIGIN})

    body = _assert_error(response, 500, "INTERNAL_ERROR")
    assert body["message"] == "系統發生錯誤，請稍後再試"
    for leaked in ("CANARY-boom", "/srv/secret.py", "Traceback", "RuntimeError"):
        assert leaked not in response.text
    assert response.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN


async def test_unhandled_exception_message_is_localised(client: httpx.AsyncClient) -> None:
    response = await client.get(CRASH_PATH, headers={"Accept-Language": "en"})

    _assert_error(response, 500, "INTERNAL_ERROR")
    assert response.json()["message"] == "Something went wrong. Please try again later."
    assert response.headers["Content-Language"] == "en"


async def test_response_not_matching_its_declared_shape_returns_a_500_envelope(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(BAD_RESPONSE_PATH)

    _assert_error(response, 500, "INTERNAL_ERROR")
    for leaked in ("CANARY-resp", "Field required", "ResponseValidationError", "name"):
        assert leaked not in response.text


async def test_unhandled_exception_log_has_the_trace_id_and_no_request_content(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR)

    response = await client.get(
        CRASH_PATH,
        params={"q": "CANARY-query"},
        headers={"Cookie": "session=CANARY-cookie"},
    )

    trace_id = response.json()["traceId"]
    errors = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(errors) == 1
    record = errors[0]
    logged = record.getMessage() + (caplog.text or "")
    assert trace_id in record.getMessage()
    assert CRASH_PATH in record.getMessage()
    assert "RuntimeError" in record.getMessage()
    assert "Traceback" in record.getMessage()
    assert "CANARY-cookie" not in logged
    assert "CANARY-query" not in logged
    assert CRASH_MESSAGE not in caplog.text


@pytest.mark.parametrize(
    ("path", "exception_type"),
    [(DB_ERROR_PATH, "DBAPIError"), (BAD_RESPONSE_PATH, "ResponseValidationError")],
)
async def test_unhandled_log_never_carries_data_from_the_exception_text(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture, path: str, exception_type: str
) -> None:
    caplog.set_level(logging.DEBUG)

    response = await client.get(path)

    assert response.status_code == 500
    assert exception_type in caplog.text
    assert "CANARY" not in caplog.text


@pytest.mark.parametrize(
    ("method", "path", "headers", "payload", "status", "code"),
    [
        ("GET", MISSING_PATH, {}, None, 404, "NOT_FOUND"),
        ("PUT", PROBE_PATH, {}, None, 405, "METHOD_NOT_ALLOWED"),
        ("GET", PROBE_PATH, {"Accept-Language": "fr"}, None, 406, "NOT_ACCEPTABLE"),
        ("POST", PROBE_PATH, {}, {}, 422, "VALIDATION_FAILED"),
        ("GET", CRASH_PATH, {}, None, 500, "INTERNAL_ERROR"),
    ],
)
async def test_generic_error_codes_map_to_http_statuses(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    headers: dict[str, str],
    payload: dict[str, Any] | None,
    status: int,
    code: str,
) -> None:
    response = await client.request(method, path, headers=headers, json=payload)

    assert response.status_code == status
    assert response.json()["code"] == code
    assert response.headers["X-Correlation-ID"] == response.json()["traceId"]
