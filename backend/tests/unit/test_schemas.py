"""Unit tests for the shared schema bases and envelopes in ``app.core.schemas``.

Covers spec ``api-envelope`` (pagination scenarios and camelCase response
fields) and the parametrized names of the generic envelopes (design D6). The
``components.schemas`` keys are renamed and asserted in ``app.core.openapi``.
"""

import json
import re
from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.schemas import (
    ApiResponse,
    ErrorDetail,
    ErrorResponse,
    PaginatedResponse,
    PaginationParams,
    RequestModel,
    ResponseModel,
)

PAGE_KEYS = {"items", "total", "limit", "offset", "hasMore", "totalPages", "nextOffset"}
ENVELOPE_KEYS = {"success", "code", "message", "data", "timestamp", "traceId"}


class TaskItem(ResponseModel):
    """A sample list item used only to name components."""

    item_id: int
    display_name: str


class HealthData(ResponseModel):
    """Stand-in for the health module's data type (added in a later task)."""

    status: str


class DisplayNameBody(RequestModel):
    """A request body that requires ``displayName``."""

    display_name: str


def _page(total: int, limit: int, offset: int) -> dict[str, Any]:
    page = PaginatedResponse[TaskItem](items=[], total=total, limit=limit, offset=offset)
    dumped: dict[str, Any] = page.model_dump(mode="json")
    return dumped


def _all_keys(value: Any) -> list[str]:
    if isinstance(value, dict):
        keys = list(value)
        for child in value.values():
            keys.extend(_all_keys(child))
        return keys
    if isinstance(value, list):
        return [key for child in value for key in _all_keys(child)]
    return []


# --- pagination -----------------------------------------------------------------------


def test_middle_page_derives_has_more_total_pages_and_next_offset() -> None:
    page = _page(total=45, limit=20, offset=20)

    assert set(page) == PAGE_KEYS
    assert page["hasMore"] is True
    assert page["totalPages"] == 3
    assert page["nextOffset"] == 40


def test_last_page_has_no_next_page() -> None:
    page = _page(total=45, limit=20, offset=40)

    assert page["hasMore"] is False
    assert page["totalPages"] == 3
    assert page["nextOffset"] is None


def test_empty_result_has_zero_pages() -> None:
    page = _page(total=0, limit=20, offset=0)

    assert page["items"] == []
    assert page["hasMore"] is False
    assert page["totalPages"] == 0
    assert page["nextOffset"] is None


def test_offset_beyond_total_is_a_valid_empty_page() -> None:
    page = _page(total=5, limit=20, offset=40)

    assert page["items"] == []
    assert page["hasMore"] is False
    assert page["nextOffset"] is None


def test_page_items_are_serialised_in_camel_case() -> None:
    page = PaginatedResponse[TaskItem](
        items=[TaskItem(item_id=1, display_name="A")], total=1, limit=20, offset=0
    )

    assert page.model_dump(mode="json")["items"] == [{"itemId": 1, "displayName": "A"}]


def test_pagination_params_default_to_limit_20_offset_0() -> None:
    params = PaginationParams.model_validate({})

    assert params.limit == 20
    assert params.offset == 0


@pytest.mark.parametrize("value", [1, 100])
def test_pagination_params_accept_limit_bounds(value: int) -> None:
    assert PaginationParams.model_validate({"limit": value}).limit == value


@pytest.mark.parametrize(
    ("field", "value"),
    [("limit", 0), ("limit", 101), ("offset", -1)],
)
def test_pagination_params_reject_out_of_range_values(field: str, value: int) -> None:
    with pytest.raises(ValidationError) as excinfo:
        PaginationParams.model_validate({field: value})

    assert [error["loc"] for error in excinfo.value.errors()] == [(field,)]


# --- camelCase and the request/response bases -----------------------------------------


def test_response_envelope_keys_are_camel_case_at_every_level() -> None:
    envelope = ApiResponse[PaginatedResponse[TaskItem]](
        success=True,
        code="OK",
        message="成功",
        data=PaginatedResponse[TaskItem](
            items=[TaskItem(item_id=1, display_name="A")], total=1, limit=20, offset=0
        ),
        timestamp=datetime(2026, 11, 20, 8, 15, 30, 123456, tzinfo=UTC),
        trace_id="3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
    )

    dumped = envelope.model_dump(mode="json")

    assert set(dumped) == ENVELOPE_KEYS
    assert "traceId" in dumped
    assert "trace_id" not in dumped
    assert all("_" not in key for key in _all_keys(dumped))


def test_envelope_timestamp_serialises_as_utc_milliseconds_with_z() -> None:
    envelope = ApiResponse[HealthData](
        success=True,
        code="OK",
        message="成功",
        data=HealthData(status="ok"),
        timestamp=datetime(2026, 11, 20, 8, 15, 30, 123456, tzinfo=UTC),
        trace_id="trace-0001",
    )

    timestamp = envelope.model_dump(mode="json")["timestamp"]

    assert timestamp == "2026-11-20T08:15:30.123Z"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", timestamp)


def test_error_response_has_seven_camel_case_keys() -> None:
    error = ErrorResponse(
        success=False,
        code="VALIDATION_FAILED",
        message="輸入資料有誤，請檢查標示的欄位",
        data=None,
        timestamp=datetime(2026, 11, 20, 8, 15, 30, tzinfo=UTC),
        trace_id="trace-0001",
        errors=[
            ErrorDetail(location="body", field="displayName", code="missing", message="m"),
        ],
    )

    dumped = json.loads(error.model_dump_json())

    assert set(dumped) == ENVELOPE_KEYS | {"errors"}
    assert dumped["data"] is None
    assert dumped["errors"] == [
        {"location": "body", "field": "displayName", "code": "missing", "message": "m"}
    ]


def test_request_model_rejects_snake_case_field_names() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DisplayNameBody.model_validate({"display_name": "A"})

    errors = {(error["loc"], error["type"]) for error in excinfo.value.errors()}
    assert (("display_name",), "extra_forbidden") in errors
    assert (("displayName",), "missing") in errors


def test_request_model_accepts_camel_case_and_rejects_unknown_fields() -> None:
    assert DisplayNameBody.model_validate({"displayName": "A"}).display_name == "A"

    with pytest.raises(ValidationError) as excinfo:
        DisplayNameBody.model_validate({"displayName": "A", "nickName": "B"})

    assert [(e["loc"], e["type"]) for e in excinfo.value.errors()] == [
        (("nickName",), "extra_forbidden")
    ]


def test_response_model_builds_from_field_names_and_serialises_camel_case() -> None:
    item = TaskItem(item_id=7, display_name="A")

    assert item.model_dump(mode="json") == {"itemId": 7, "displayName": "A"}
    assert item.model_dump_json() == '{"itemId":7,"displayName":"A"}'


def test_response_model_builds_from_attributes() -> None:
    class Row:
        item_id = 3
        display_name = "Row"

    assert TaskItem.model_validate(Row()).model_dump(mode="json") == {
        "itemId": 3,
        "displayName": "Row",
    }


# --- parametrized names (design D6) ---------------------------------------------------


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        (ApiResponse[HealthData], "HealthDataResponse"),
        (ApiResponse[PaginatedResponse[TaskItem]], "TaskItemPageResponse"),
        (PaginatedResponse[TaskItem], "TaskItemPage"),
    ],
    ids=["envelope", "paginated-envelope", "page"],
)
def test_parametrized_generic_name_and_schema_title(model: Any, expected: str) -> None:
    assert model.__name__ == expected
    assert model.model_json_schema()["title"] == expected
