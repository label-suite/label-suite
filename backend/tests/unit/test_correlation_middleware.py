"""Unit tests for ``CorrelationIdMiddleware`` (spec ``request-correlation``).

A minimal ASGI app stands in for FastAPI: it echoes the correlation ID it sees in
``scope["state"]`` and in the context variable, so the tests check the accept and
discard rules, generation, and the response header without the full app.
"""

import json
import re
from collections.abc import AsyncIterator

import httpx
import pytest
from starlette.types import Receive, Scope, Send

from app.core.envelope import current_correlation_id
from app.core.middleware import CorrelationIdMiddleware

UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


async def echo_app(scope: Scope, receive: Receive, send: Send) -> None:
    """Respond with the correlation ID from scope state and from the context variable."""
    body = json.dumps(
        {"state": scope["state"]["correlation_id"], "context": current_correlation_id()}
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"application/json")],
        }
    )
    await send({"type": "http.response.body", "body": body})


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=CorrelationIdMiddleware(echo_app))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_generates_a_lowercase_uuid4_when_no_header_is_sent(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/")

    value = response.headers["X-Correlation-ID"]
    assert UUID4.match(value)
    assert response.json() == {"state": value, "context": value}


@pytest.mark.parametrize(
    "supplied",
    ["client-trace-0001", "ABCDEFGH", "a" * 64, "12345678-abcd-EFGH-0000"],
)
async def test_reuses_a_supplied_value_that_matches_the_format(
    client: httpx.AsyncClient, supplied: str
) -> None:
    response = await client.get("/", headers={"X-Correlation-ID": supplied})

    assert response.headers["X-Correlation-ID"] == supplied
    assert response.json() == {"state": supplied, "context": supplied}


@pytest.mark.parametrize(
    "supplied",
    ["abc", "has space_and_underscore", "a" * 65, "", "trace_0001x", "trace-0001!"],
)
async def test_discards_a_supplied_value_that_does_not_match_the_format(
    client: httpx.AsyncClient, supplied: str
) -> None:
    response = await client.get("/", headers={"X-Correlation-ID": supplied})

    value = response.headers["X-Correlation-ID"]
    assert response.status_code == 200
    assert value != supplied
    assert UUID4.match(value)
    assert response.json() == {"state": value, "context": value}


async def test_two_requests_get_different_values(client: httpx.AsyncClient) -> None:
    first = await client.get("/")
    second = await client.get("/")

    assert first.headers["X-Correlation-ID"] != second.headers["X-Correlation-ID"]


async def test_replaces_a_correlation_header_set_by_the_inner_app() -> None:
    async def app_with_header(scope: Scope, receive: Receive, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 204,
                "headers": [(b"x-correlation-id", b"inner-value-0000")],
            }
        )
        await send({"type": "http.response.body", "body": b""})

    transport = httpx.ASGITransport(app=CorrelationIdMiddleware(app_with_header))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/", headers={"X-Correlation-ID": "client-trace-0001"})

    assert response.headers.get_list("X-Correlation-ID") == ["client-trace-0001"]


async def test_context_variable_is_reset_after_the_request(client: httpx.AsyncClient) -> None:
    await client.get("/")

    assert current_correlation_id() is None


async def test_passes_non_http_scopes_through_untouched() -> None:
    seen: list[Scope] = []

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        seen.append(scope)

    async def receive() -> dict[str, str]:
        return {"type": "lifespan.startup"}

    async def send(_message: object) -> None:
        return None

    scope: Scope = {"type": "lifespan", "asgi": {"version": "3.0"}}
    await CorrelationIdMiddleware(inner)(scope, receive, send)

    assert seen == [{"type": "lifespan", "asgi": {"version": "3.0"}}]
