"""Unit tests for ``app.core.auth`` (login-auth-guard task 3.2, design D7).

``get_current_principal`` is steps 1 and 2 of authorization: it reads only the
``__Host-ls_at`` cookie, decodes the access token and hands the claims to the
``PrincipalLoader`` in ``app.state``. Whatever fails, the caller gets the same
``401 AUTH_REQUIRED`` envelope with the same message. The loader here is a stand-in;
the real ``AccountPrincipalLoader`` and its database checks are covered by the
integration tests of group 4.
"""

import secrets
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
import pytest
from fastapi import Depends, FastAPI
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    AuthenticationRequiredError,
    Principal,
    PrincipalLoader,
    get_current_principal,
)
from app.core.cookies import ACCESS_COOKIE
from app.core.db import get_db
from app.core.errors import AppError, register_exception_handlers
from app.core.i18n import MessageCatalog
from app.core.tokens import AccessClaims, AccessTokenCodec, TokenKeys

USER_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
SESSION_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")
FAKE_DB = object()


class RecordingLoader:
    """A ``PrincipalLoader`` stand-in that accepts or rejects every call."""

    def __init__(self, *, accept: bool) -> None:
        self.accept = accept
        self.calls: list[tuple[AccessClaims, Any]] = []

    async def load(self, claims: AccessClaims, db: AsyncSession) -> Principal:
        self.calls.append((claims, db))
        if not self.accept:
            raise AuthenticationRequiredError()
        return Principal(user_id=claims.user_id, session_id=claims.session_id, role="super_admin")


def _keys() -> TokenKeys:
    return TokenKeys.derive(SecretStr(secrets.token_urlsafe(48)))


def _build_app(keys: TokenKeys, loader: PrincipalLoader) -> FastAPI:
    app = FastAPI()
    app.state.message_catalog = MessageCatalog.load()
    app.state.access_codec = AccessTokenCodec(keys.access)
    app.state.principal_loader = loader
    register_exception_handlers(app)

    async def fake_db() -> AsyncIterator[Any]:
        yield FAKE_DB

    app.dependency_overrides[get_db] = fake_db

    @app.get("/me")
    async def me(principal: Principal = Depends(get_current_principal)) -> dict[str, str]:  # noqa: B008
        return {"user": str(principal.user_id), "role": principal.role}

    return app


async def _get(app: FastAPI, **kwargs: Any) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get("/me", **kwargs)


def _token(keys: TokenKeys, *, expires_in: timedelta = timedelta(minutes=15)) -> str:
    now = datetime.now(UTC)
    return AccessTokenCodec(keys.access).issue(
        user_id=USER_ID,
        session_id=SESSION_ID,
        credential_version=0,
        role="user",
        issued_at=now - timedelta(minutes=1),
        expires_at=now + expires_in,
    )


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{ACCESS_COOKIE}={value}"}


def test_authentication_required_error_maps_to_401_auth_required() -> None:
    error = AuthenticationRequiredError()

    assert isinstance(error, AppError)
    assert (error.status_code, error.code, error.message_key) == (
        401,
        "AUTH_REQUIRED",
        "common.auth_required",
    )
    assert error.params == {}


def test_principal_carries_only_user_session_and_role() -> None:
    assert set(Principal.__dataclass_fields__) == {"user_id", "session_id", "role"}


async def test_a_valid_cookie_and_an_accepting_loader_give_the_principal() -> None:
    keys = _keys()
    loader = RecordingLoader(accept=True)

    response = await _get(_build_app(keys, loader), headers=_cookie(_token(keys)))

    assert response.status_code == 200
    assert response.json() == {"user": str(USER_ID), "role": "super_admin"}
    ((claims, db),) = loader.calls
    assert (claims.user_id, claims.session_id, claims.credential_version) == (
        USER_ID,
        SESSION_ID,
        0,
    )
    assert db is FAKE_DB


def _tampered(keys: TokenKeys) -> str:
    header, payload, signature = _token(keys).split(".")
    first = "A" if signature[0] != "A" else "B"
    return f"{header}.{payload}.{first}{signature[1:]}"


def _wrong_claims(keys: TokenKeys) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": "nobody",
            "sid": str(SESSION_ID),
            "credential_version": 0,
            "role": "user",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        keys.access,
        algorithm="HS256",
    )


REJECTED_REQUESTS: dict[str, Any] = {
    "no cookie": lambda keys: {},
    "bearer header only": lambda keys: {"headers": {"Authorization": f"Bearer {_token(keys)}"}},
    "token in the query": lambda keys: {"params": {"access_token": _token(keys)}},
    "unprefixed cookie name": lambda keys: {"headers": {"Cookie": f"ls_at={_token(keys)}"}},
    "empty cookie": lambda keys: {"headers": _cookie("")},
    "garbage cookie": lambda keys: {"headers": _cookie("not-a-jwt")},
    "tampered signature": lambda keys: {"headers": _cookie(_tampered(keys))},
    "expired token": lambda keys: {"headers": _cookie(_token(keys, expires_in=-timedelta(1)))},
    "another secret": lambda keys: {"headers": _cookie(_token(_keys()))},
    "malformed claims": lambda keys: {"headers": _cookie(_wrong_claims(keys))},
}


@pytest.mark.parametrize("case", REJECTED_REQUESTS)
async def test_every_unusable_credential_is_rejected_before_the_loader(case: str) -> None:
    keys = _keys()
    loader = RecordingLoader(accept=True)

    response = await _get(_build_app(keys, loader), **REJECTED_REQUESTS[case](keys))

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"
    assert loader.calls == []


async def test_a_loader_rejection_is_the_same_401() -> None:
    keys = _keys()
    loader = RecordingLoader(accept=False)

    response = await _get(_build_app(keys, loader), headers=_cookie(_token(keys)))

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"
    assert len(loader.calls) == 1


async def test_every_rejection_has_the_same_body_apart_from_time_and_trace() -> None:
    keys = _keys()
    bodies: list[dict[str, Any]] = []
    for case in REJECTED_REQUESTS.values():
        response = await _get(_build_app(keys, RecordingLoader(accept=True)), **case(keys))
        bodies.append(response.json())
    refused = await _get(
        _build_app(keys, RecordingLoader(accept=False)), headers=_cookie(_token(keys))
    )
    bodies.append(refused.json())

    stripped = [
        {k: v for k, v in body.items() if k not in {"timestamp", "traceId"}} for body in bodies
    ]
    assert all(body == stripped[0] for body in stripped)
    assert stripped[0] == {
        "success": False,
        "code": "AUTH_REQUIRED",
        "message": "請先登入",
        "data": None,
        "errors": None,
    }
    for body in bodies:
        assert str(USER_ID) not in str(body)
        assert str(SESSION_ID) not in str(body)
