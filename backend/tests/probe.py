"""Probe routes that exist only in tests (clarification Q8, N4; design D13).

The skeleton's only real endpoint takes no input and never fails, so the
integration tests mount these routes under the same ``/api/v1`` parent router
on the app ``create_app`` builds. Nothing here is registered by production code.
"""

import logging
from typing import cast

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import DBAPIError

from app.core.envelope import ok
from app.core.errors import AppError
from app.core.schemas import ApiResponse, RequestModel, ResponseModel
from tests.authz_probe import add_authz_probes

PROBE_PATH = "/api/v1/probe"
CRASH_PATH = "/api/v1/probe-crash"
BAD_RESPONSE_PATH = "/api/v1/probe-bad-response"
CRASH_MESSAGE = "CANARY-boom /srv/secret.py"
DB_ERROR_PATH = "/api/v1/probe-db-error"
_DB_ERROR_PARTS = ("SELECT 'CANARY-sql'", {"secret": "CANARY-param"}, Exception("CANARY-driver"))
ITEM_ROUTE = "/api/v1/items/{item_id}"
BAD_GATEWAY_PATH = "/api/v1/probe-bad-gateway"
TEAPOT_PATH = "/api/v1/probe-teapot"
THIRD_PARTY_LOG_PATH = "/api/v1/probe-third-party-log"
THIRD_PARTY_LOGGER = "thirdparty.lib"
THIRD_PARTY_MESSAGE = "third-party library warning"


class ProbeBody(RequestModel):
    """A body that requires ``displayName`` (camelCase only)."""

    display_name: str


class ProbeData(ResponseModel):
    """The probe's success payload."""

    display_name: str


class ItemData(ResponseModel):
    """The item probe's success payload; it never echoes the path value."""

    found: bool


class ProbeBadGatewayError(AppError):
    """A test-only ``502`` domain error whose raiser logs nothing."""

    status_code = 502
    code = "PROBE_BAD_GATEWAY"
    message_key = "common.internal_error"


class NamedData(ResponseModel):
    """A payload with a required ``name``; the bad-response probe omits it."""

    name: str


probe_router = APIRouter()


@probe_router.post("/probe")
async def create_probe(body: ProbeBody, request: Request) -> ApiResponse[ProbeData]:
    """Echo the validated ``displayName`` in a success envelope."""
    return ok(ProbeData(display_name=body.display_name), request)


@probe_router.get("/probe")
async def get_probe(request: Request) -> ApiResponse[ProbeData]:
    """Return a fixed success envelope; stands in for the health check until group 7."""
    return ok(ProbeData(display_name="probe"), request)


@probe_router.get("/probe-crash")
async def crash_probe() -> ApiResponse[ProbeData]:
    """Raise an unhandled exception whose message must never reach the client."""
    raise RuntimeError(CRASH_MESSAGE)


@probe_router.get("/probe-bad-response")
async def bad_response_probe(request: Request) -> ApiResponse[NamedData]:
    """Return content that lacks the declared ``name``, so response validation fails."""
    envelope = ok({"label": "CANARY-resp"}, request).model_dump(mode="json", by_alias=True)
    # Deliberately wrong at runtime: FastAPI validates the dict against the annotation.
    return cast(ApiResponse[NamedData], envelope)


@probe_router.get("/probe-db-error")
async def db_error_probe() -> ApiResponse[ProbeData]:
    """Raise a driver error whose statement, parameters and cause carry CANARY values."""
    # The values live outside the raise line: traceback frames show source lines.
    statement, params, cause = _DB_ERROR_PARTS
    raise DBAPIError(statement, params, cause)


@probe_router.get("/items/{item_id}")
async def get_item_probe(item_id: str, request: Request) -> ApiResponse[ItemData]:
    """Answer ``200`` for any item; stands in for an endpoint with a path parameter."""
    del item_id  # The value must never reach the response or a log record.
    return ok(ItemData(found=True), request)


@probe_router.get("/probe-bad-gateway")
async def bad_gateway_probe() -> ApiResponse[ProbeData]:
    """Fail with a ``502`` domain error without writing any log record."""
    raise ProbeBadGatewayError()


@probe_router.get("/probe-teapot")
async def teapot_probe() -> ApiResponse[ProbeData]:
    """Raise an ``HTTPException`` whose status has no envelope code (``418``)."""
    raise HTTPException(status_code=418)


@probe_router.get("/probe-third-party-log")
async def third_party_log_probe(request: Request) -> ApiResponse[ProbeData]:
    """Write one ``WARNING`` through a logger outside this repository, then answer ``200``."""
    logging.getLogger(THIRD_PARTY_LOGGER).warning(THIRD_PARTY_MESSAGE)
    return ok(ProbeData(display_name="probe"), request)


# The authorization probes (authz-steps-3-4 design D9) join this router, so the harness
# still mounts exactly one probe router and the parity test's probe paths include them.
add_authz_probes(probe_router)
