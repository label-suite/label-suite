"""Unit tests for the envelope builders and the 422 detail conversion (design D4, D5).

Covers the ``timestamp`` format, ``traceId`` read from the correlation-ID context
variable, the zh-TW fallback when the scope has no locale, and that a
``RequestValidationError`` becomes ``ErrorDetail`` items with exactly four keys
and none of the submitted values.
"""

import json
import re
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.core.envelope import (
    correlation_id_var,
    current_trace_id,
    error_response,
    success,
)
from app.core.errors import validation_error_details
from app.core.i18n import MessageCatalog
from app.core.schemas import ErrorDetail, RequestModel, ResponseModel

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


@pytest.fixture(scope="module")
def catalog() -> MessageCatalog:
    return MessageCatalog.load()


@pytest.fixture
def correlation_id() -> Iterator[str]:
    value = "client-trace-0001"
    token = correlation_id_var.set(value)
    yield value
    correlation_id_var.reset(token)


def _body(response: Any) -> dict[str, Any]:
    parsed: dict[str, Any] = json.loads(response.body)
    return parsed


def _assert_recent(timestamp: str) -> None:
    built = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    assert abs(datetime.now(UTC) - built) < timedelta(seconds=5)


class Item(ResponseModel):
    display_name: str


# --- traceId ---------------------------------------------------------------------------


def test_current_trace_id_reads_the_correlation_context_variable(correlation_id: str) -> None:
    assert current_trace_id() == correlation_id


def test_current_trace_id_outside_a_request_is_a_fresh_uuid4() -> None:
    assert UUID4.match(current_trace_id())


# --- error envelope --------------------------------------------------------------------


def test_error_response_has_the_error_envelope_fields(
    catalog: MessageCatalog, correlation_id: str
) -> None:
    response = error_response(404, "NOT_FOUND", "common.not_found", catalog=catalog, state={})

    body = _body(response)
    assert response.status_code == 404
    assert set(body) == {"success", "code", "message", "data", "timestamp", "traceId", "errors"}
    assert body["success"] is False
    assert body["code"] == "NOT_FOUND"
    assert body["data"] is None
    assert body["errors"] is None
    assert body["traceId"] == correlation_id


def test_error_response_timestamp_is_utc_with_milliseconds(catalog: MessageCatalog) -> None:
    body = _body(error_response(404, "NOT_FOUND", "common.not_found", catalog=catalog, state={}))

    assert TIMESTAMP.match(body["timestamp"])
    _assert_recent(body["timestamp"])


@pytest.mark.parametrize("state", [None, {}, {"locale": "fr"}, {"correlation_id": "x"}])
def test_error_message_falls_back_to_zh_tw_without_a_locale_in_scope(
    catalog: MessageCatalog, state: dict[str, Any] | None
) -> None:
    response = error_response(404, "NOT_FOUND", "common.not_found", catalog=catalog, state=state)

    assert _body(response)["message"] == "找不到指定的資源"
    assert response.headers["Content-Language"] == "zh-TW"


def test_error_message_uses_the_locale_in_scope(catalog: MessageCatalog) -> None:
    response = error_response(
        404, "NOT_FOUND", "common.not_found", catalog=catalog, state={"locale": "en"}
    )

    assert _body(response)["message"] == "The requested resource was not found."
    assert response.headers["Content-Language"] == "en"


def test_error_response_keeps_extra_headers_and_details(catalog: MessageCatalog) -> None:
    detail = ErrorDetail(location="body", field="displayName", code="missing", message="m")
    response = error_response(
        422,
        "VALIDATION_FAILED",
        "common.validation_failed",
        catalog=catalog,
        state={},
        errors=[detail],
        headers={"Allow": "GET"},
    )

    body = _body(response)
    assert response.headers["Allow"] == "GET"
    assert body["errors"] == [
        {"location": "body", "field": "displayName", "code": "missing", "message": "m"}
    ]


# --- success envelope ------------------------------------------------------------------


def test_success_envelope_has_six_fields_and_ok_code(
    catalog: MessageCatalog, correlation_id: str
) -> None:
    envelope = success(Item(display_name="A"), catalog=catalog, state={})

    body = envelope.model_dump(mode="json")
    assert set(body) == {"success", "code", "message", "data", "timestamp", "traceId"}
    assert body["success"] is True
    assert body["code"] == "OK"
    assert body["message"] == "成功"
    assert body["data"] == {"displayName": "A"}
    assert body["traceId"] == correlation_id
    assert TIMESTAMP.match(body["timestamp"])
    _assert_recent(body["timestamp"])


def test_success_message_uses_the_locale_in_scope(catalog: MessageCatalog) -> None:
    envelope = success(Item(display_name="A"), catalog=catalog, state={"locale": "en"})

    assert envelope.message == "Success"


# --- RequestValidationError -> ErrorDetail ---------------------------------------------


class Probe(RequestModel):
    display_name: str


def _validation_error(payload: dict[str, Any]) -> RequestValidationError:
    with pytest.raises(ValidationError) as caught:
        Probe.model_validate(payload)
    errors = [{**error, "loc": ("body", *error["loc"])} for error in caught.value.errors()]
    return RequestValidationError(errors, body=payload)


def test_validation_details_have_exactly_four_keys_and_no_submitted_values() -> None:
    exc = _validation_error({"displayName": 12345, "secretAnswer": "CANARY-7f3a"})
    assert any("input" in error for error in exc.errors())

    details = validation_error_details(exc)

    dumped = [detail.model_dump(mode="json") for detail in details]
    assert all(set(item) == {"location", "field", "code", "message"} for item in dumped)
    assert {(item["field"], item["code"]) for item in dumped} == {
        ("displayName", "string_type"),
        ("secretAnswer", "extra_forbidden"),
    }
    serialised = json.dumps(dumped)
    assert "CANARY-7f3a" not in serialised
    assert "12345" not in serialised


def test_validation_details_split_location_and_field() -> None:
    exc = RequestValidationError(
        [
            {
                "type": "missing",
                "loc": ("body", "items", 0, "displayName"),
                "msg": "Field required",
            },
            {"type": "json_invalid", "loc": ("body", 15), "msg": "JSON decode error"},
            {"type": "missing", "loc": ("body",), "msg": "Field required"},
            {"type": "int_parsing", "loc": ("query", "limit"), "msg": "bad", "input": "x"},
        ]
    )

    details = validation_error_details(exc)

    assert [(d.location, d.field, d.code, d.message) for d in details] == [
        ("body", "items.0.displayName", "missing", "Field required"),
        ("body", "", "json_invalid", "JSON decode error"),
        ("body", "", "missing", "Field required"),
        ("query", "limit", "int_parsing", "bad"),
    ]


def test_current_trace_id_fallback_values_differ() -> None:
    assert current_trace_id() != current_trace_id()
    assert uuid.UUID(current_trace_id()).version == 4
