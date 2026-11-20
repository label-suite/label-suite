"""Shared schema bases, response envelopes and pagination (api-agent-rules A1-A3).

Rules for feature changes: request bodies and query models inherit
``RequestModel``; response schemas inherit ``ResponseModel``. Neither inherits
``ApiModel`` directly.

Generic envelopes override ``model_parametrized_name`` so a parametrized class's
``__name__`` and JSON Schema ``title`` read ``XResponse``, ``XPageResponse`` and
``XPage``. Pydantic still keys ``components.schemas`` as ``ApiResponse_X_``;
``app.core.openapi`` renames those keys to the ``title`` (design D6).
"""

import math
from datetime import UTC, datetime
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    WithJsonSchema,
    computed_field,
)
from pydantic.alias_generators import to_camel

__all__ = [
    "ApiModel",
    "ApiResponse",
    "ErrorDetail",
    "ErrorResponse",
    "PaginatedResponse",
    "PaginationParams",
    "RequestModel",
    "ResponseModel",
    "Timestamp",
]


def _format_timestamp(value: datetime) -> str:
    """Format ``value`` as ISO 8601 UTC with millisecond precision and a ``Z`` suffix.

    A naive ``value`` is taken to be UTC already.
    """
    if value.tzinfo is not None:
        value = value.astimezone(UTC)
    return value.replace(tzinfo=None).isoformat(timespec="milliseconds") + "Z"


Timestamp = Annotated[
    datetime,
    PlainSerializer(_format_timestamp, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "format": "date-time"}),
]
"""Envelope time: serialised in JSON as e.g. ``2026-11-20T08:15:30.123Z``."""


class ApiModel(BaseModel):
    """Common schema configuration: camelCase aliases and no undeclared fields.

    Do not inherit this directly; use ``RequestModel`` or ``ResponseModel``.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        serialize_by_alias=True,
        extra="forbid",
    )


class RequestModel(ApiModel):
    """Base for request bodies and query models: validates camelCase aliases only.

    A snake_case field name such as ``display_name`` counts as an undeclared
    field and fails with ``extra_forbidden`` (#503 ruling 3).
    """

    model_config = ConfigDict(validate_by_alias=True, validate_by_name=False)


class ResponseModel(ApiModel):
    """Base for response schemas.

    Backend code may build instances from Python field names or ORM objects;
    serialisation always uses the camelCase aliases.
    """

    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        from_attributes=True,
    )


def _is_model_class(param: Any) -> bool:
    return isinstance(param, type) and issubclass(param, BaseModel)


class ApiResponse[T](ResponseModel):
    """The success envelope wrapping every ``/api/v1`` success body.

    Attributes:
        success: Always ``True`` for a success envelope.
        code: ``"OK"`` on success, an ``UPPER_SNAKE_CASE`` code on error.
        message: The message already localised for the request.
        data: The endpoint's payload.
        timestamp: When the envelope was built (UTC).
        trace_id: The request's correlation ID, equal to ``X-Correlation-ID``.
    """

    success: bool
    code: str
    message: str
    data: T
    timestamp: Timestamp
    trace_id: str

    @classmethod
    def model_parametrized_name(cls, params: tuple[Any, ...]) -> str:
        """Name ``ApiResponse[X]`` as ``XResponse`` (``XPageResponse`` for pages)."""
        if len(params) == 1 and _is_model_class(params[0]):
            return f"{params[0].__name__}Response"
        return super().model_parametrized_name(params)


class ErrorDetail(ResponseModel):
    """One field-level validation error of a ``422`` response.

    Attributes:
        location: ``body``, ``query``, ``path``, ``header`` or ``cookie``.
        field: Dot-joined camelCase field path; ``""`` for the whole location.
        code: The Pydantic error type, e.g. ``missing``.
        message: The Pydantic message (English, not localised).
    """

    location: str
    field: str
    code: str
    message: str


class ErrorResponse(ApiResponse[None]):
    """The error envelope shared by every ``4xx`` and ``5xx`` response.

    ``data`` is always ``None``; ``errors`` is a non-empty list only for ``422``
    and ``None`` otherwise.
    """

    data: None
    errors: list[ErrorDetail] | None


class PaginatedResponse[T](ResponseModel):
    """A list page; the last three fields are derived from the first four.

    Attributes:
        items: The items on this page.
        total: Total number of matching items.
        limit: The page size actually applied.
        offset: The offset actually applied.
    """

    items: list[T]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_more(self) -> bool:
        """Whether another page follows: ``offset + limit < total``."""
        return self.offset + self.limit < self.total

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_pages(self) -> int:
        """``ceil(total / limit)``; ``0`` when ``total`` is ``0``."""
        return math.ceil(self.total / self.limit)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def next_offset(self) -> int | None:
        """``offset + limit`` when ``has_more``, otherwise ``None``."""
        return self.offset + self.limit if self.has_more else None

    @classmethod
    def model_parametrized_name(cls, params: tuple[Any, ...]) -> str:
        """Name ``PaginatedResponse[X]`` as ``XPage``."""
        if len(params) == 1 and _is_model_class(params[0]):
            return f"{params[0].__name__}Page"
        return super().model_parametrized_name(params)


class PaginationParams(RequestModel):
    """Pagination query parameters.

    Attributes:
        limit: Page size, default 20, from 1 to 100.
        offset: Number of items to skip, default 0, at least 0.
    """

    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
