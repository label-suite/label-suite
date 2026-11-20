"""Probe routes that exist only in tests (clarification Q8, N4; design D13).

The skeleton's only real endpoint takes no input and never fails, so the
integration tests mount these routes under the same ``/api/v1`` parent router
on the app ``create_app`` builds. Nothing here is registered by production code.
"""

from typing import Any

from fastapi import APIRouter, Request

from app.core.envelope import ok
from app.core.schemas import ApiResponse, RequestModel, ResponseModel

PROBE_PATH = "/api/v1/probe"
CRASH_PATH = "/api/v1/probe-crash"
BAD_RESPONSE_PATH = "/api/v1/probe-bad-response"
CRASH_MESSAGE = "CANARY-boom /srv/secret.py"


class ProbeBody(RequestModel):
    """A body that requires ``displayName`` (camelCase only)."""

    display_name: str


class ProbeData(ResponseModel):
    """The probe's success payload."""

    display_name: str


class NamedData(ResponseModel):
    """A payload with a required ``name``; the bad-response probe omits it."""

    name: str


probe_router = APIRouter()


@probe_router.post("/probe", response_model=ApiResponse[ProbeData])
async def create_probe(body: ProbeBody, request: Request) -> ApiResponse[ProbeData]:
    """Echo the validated ``displayName`` in a success envelope."""
    return ok(ProbeData(display_name=body.display_name), request)


@probe_router.get("/probe", response_model=ApiResponse[ProbeData])
async def get_probe(request: Request) -> ApiResponse[ProbeData]:
    """Return a fixed success envelope; stands in for the health check until group 7."""
    return ok(ProbeData(display_name="probe"), request)


@probe_router.get("/probe-crash", response_model=ApiResponse[ProbeData])
async def crash_probe() -> ApiResponse[ProbeData]:
    """Raise an unhandled exception whose message must never reach the client."""
    raise RuntimeError(CRASH_MESSAGE)


@probe_router.get("/probe-bad-response", response_model=ApiResponse[NamedData])
async def bad_response_probe(request: Request) -> Any:
    """Return content that lacks the declared ``name``, so response validation fails."""
    envelope = ok({"label": "CANARY-resp"}, request).model_dump(mode="json", by_alias=True)
    return envelope
