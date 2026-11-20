"""Unit tests for ``LocaleMiddleware`` and ``UnhandledExceptionMiddleware`` (design D3, D4).

Each middleware wraps a tiny ASGI app, so the edge cases that the assembled app
cannot easily reach are checked here: a failure after the response started, and
non-HTTP scopes.
"""

import json
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

import pytest

from app.core.i18n import MessageCatalog
from app.core.middleware import LocaleMiddleware, UnhandledExceptionMiddleware

Message = MutableMapping[str, Any]
Scope = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]


@pytest.fixture(scope="module")
def catalog() -> MessageCatalog:
    return MessageCatalog.load()


def _scope(path: str, headers: list[tuple[bytes, bytes]] | None = None) -> Scope:
    return {"type": "http", "method": "GET", "path": path, "headers": headers or [], "state": {}}


async def _receive() -> Message:
    return {"type": "http.request", "body": b"", "more_body": False}


async def _call(app: Any, scope: Scope) -> list[Message]:
    sent: list[Message] = []

    async def send(message: Message) -> None:
        sent.append(message)

    await app(scope, _receive, send)
    return sent


async def _empty_ok(scope: Scope, receive: Receive, send: Send) -> None:
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"{}"})


def _headers(message: Message) -> dict[str, str]:
    return {k.decode().lower(): v.decode() for k, v in message["headers"]}


# --- LocaleMiddleware ------------------------------------------------------------------


async def test_locale_is_stored_in_scope_state_and_content_language_added(
    catalog: MessageCatalog,
) -> None:
    seen: dict[str, Any] = {}

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        seen.update(scope["state"])
        await _empty_ok(scope, receive, send)

    scope = _scope("/api/v1/x", [(b"accept-language", b"en")])
    sent = await _call(LocaleMiddleware(inner, catalog=catalog), scope)

    assert seen["locale"] == "en"
    assert _headers(sent[0])["content-language"] == "en"


async def test_locale_middleware_ignores_paths_outside_api_v1(catalog: MessageCatalog) -> None:
    scope = _scope("/api/v10", [(b"accept-language", b"fr")])
    sent = await _call(LocaleMiddleware(_empty_ok, catalog=catalog), scope)

    assert sent[0]["status"] == 200
    assert "content-language" not in _headers(sent[0])
    assert "locale" not in scope["state"]


async def test_rejected_languages_get_a_zh_tw_406_without_reaching_the_app(
    catalog: MessageCatalog,
) -> None:
    called = False

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        nonlocal called
        called = True

    scope = _scope("/api/v1", [(b"accept-language", b"fr")])
    sent = await _call(LocaleMiddleware(inner, catalog=catalog), scope)

    body = json.loads(sent[1]["body"])
    assert called is False
    assert sent[0]["status"] == 406
    assert _headers(sent[0])["content-language"] == "zh-TW"
    assert body["code"] == "NOT_ACCEPTABLE"
    assert body["message"] == "不支援所要求的語言"


async def test_locale_middleware_passes_non_http_scopes_through(catalog: MessageCatalog) -> None:
    seen: list[str] = []

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        seen.append(scope["type"])

    await LocaleMiddleware(inner, catalog=catalog)({"type": "lifespan"}, _receive, _noop_send)

    assert seen == ["lifespan"]


async def _noop_send(message: Message) -> None:
    return None


# --- UnhandledExceptionMiddleware ------------------------------------------------------


async def test_exception_before_the_response_becomes_a_500_envelope(
    catalog: MessageCatalog,
) -> None:
    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        raise RuntimeError("CANARY-unit")

    scope = _scope("/api/v1/x")
    scope["state"]["locale"] = "en"
    sent = await _call(UnhandledExceptionMiddleware(inner, catalog=catalog), scope)

    body = json.loads(sent[1]["body"])
    assert sent[0]["status"] == 500
    assert body["code"] == "INTERNAL_ERROR"
    assert body["message"] == "Something went wrong. Please try again later."
    assert _headers(sent[0])["content-language"] == "en"
    assert "CANARY-unit" not in sent[1]["body"].decode()


async def test_exception_after_the_response_started_is_re_raised(
    catalog: MessageCatalog,
) -> None:
    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        await send({"type": "http.response.start", "status": 200, "headers": []})
        raise RuntimeError("late")

    with pytest.raises(RuntimeError, match="late"):
        await _call(UnhandledExceptionMiddleware(inner, catalog=catalog), _scope("/api/v1/x"))


async def test_unhandled_middleware_passes_non_http_scopes_through(
    catalog: MessageCatalog,
) -> None:
    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        raise RuntimeError("lifespan failure")

    with pytest.raises(RuntimeError, match="lifespan failure"):
        await UnhandledExceptionMiddleware(inner, catalog=catalog)(
            {"type": "lifespan"}, _receive, _noop_send
        )
