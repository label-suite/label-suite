"""Routes of the account module (``api-contract.md`` §端點總覽).

The router turns HTTP into service calls: it builds ``SourceInfo``, sets and clears the
login cookies through ``SessionCookies`` (the only place that writes cookies), adds
``Location`` to the ``201`` responses and wraps data in the envelope. Handler docstrings
become the published operation descriptions, so they stay free of internal names.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.core.auth import AuthenticationRequiredError, Principal, get_current_principal
from app.core.cookies import SessionCookies
from app.core.envelope import ok
from app.core.paths import API_V1_PREFIX
from app.core.schemas import ApiResponse, ErrorResponse
from app.modules.account.schemas import (
    GoogleAuthorizationData,
    GoogleSessionRequest,
    LoginOptionsData,
    LoginRequest,
    RefreshRequest,
    SessionData,
)
from app.modules.account.service import (
    GoogleFlowInvalidError,
    GoogleLoginRejectedError,
    GoogleLoginService,
    IssuedSession,
    LoginOptionsService,
    PasswordLoginService,
    SessionExpiredError,
    SessionInvalidError,
    SessionService,
    SourceInfo,
    get_google_login_service,
    get_login_options_service,
    get_password_login_service,
    get_session_service,
    session_data,
)

__all__ = ["router"]

router = APIRouter()

CURRENT_SESSION_LOCATION = f"{API_V1_PREFIX}/current-session"
_ERROR: dict[str, object] = {"model": ErrorResponse}


def _now() -> datetime:
    return datetime.now(UTC)


def _source(request: Request) -> SourceInfo:
    address = request.client.host if request.client is not None else ""
    return SourceInfo(address=address, user_agent=request.headers.get("user-agent", ""))


def _deliver(response: Response, issued: IssuedSession, now: datetime) -> None:
    SessionCookies.set_session(
        response,
        access_value=issued.access_token,
        refresh_value=issued.refresh_token,
        csrf_value=issued.csrf_token,
        expires_at=issued.expires_at,
        now=now,
    )
    response.headers["Location"] = CURRENT_SESSION_LOCATION


@router.get("/auth-options")
async def get_auth_options(
    request: Request,
    service: Annotated[LoginOptionsService, Depends(get_login_options_service)],
) -> ApiResponse[LoginOptionsData]:
    """Return which sign-in options this deployment offers. Needs no credentials."""
    return ok(service.get(), request)


@router.post("/sessions", status_code=201, responses={401: _ERROR})
async def create_session(
    request: Request,
    response: Response,
    body: LoginRequest,
    service: Annotated[PasswordLoginService, Depends(get_password_login_service)],
) -> ApiResponse[SessionData]:
    """Sign in with Email and password and start a session on this device."""
    now = _now()
    issued = await service.login(body.email, body.password, _source(request), now)
    _deliver(response, issued, now)
    return ok(session_data(issued.user), request)


@router.get("/current-session", responses={401: _ERROR})
async def get_current_session(
    request: Request,
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[SessionService, Depends(get_session_service)],
) -> ApiResponse[SessionData]:
    """Return the signed-in caller."""
    return ok(await service.current(principal), request)


@router.post("/session-refreshes", status_code=201, responses={401: _ERROR, 409: _ERROR})
async def create_session_refresh(
    request: Request,
    response: Response,
    body: RefreshRequest,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> ApiResponse[SessionData]:
    """Extend the session of this device and rotate its credentials. The body is ``{}``."""
    raw = SessionCookies.read_refresh(request)
    if raw is None:
        raise AuthenticationRequiredError
    now = _now()
    try:
        issued = await service.refresh(raw, now)
    except (SessionExpiredError, SessionInvalidError) as exc:
        exc.response_hook = SessionCookies.clear
        raise
    _deliver(response, issued, now)
    return ok(session_data(issued.user), request)


@router.delete("/current-session", status_code=204)
async def delete_current_session(
    request: Request,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> Response:
    """Sign this device out. Always answers 204 and clears the session cookies."""
    await service.logout(SessionCookies.read_refresh(request), _now())
    response = Response(status_code=204)
    SessionCookies.clear(response)
    return response


@router.get("/google-authorization", responses={409: _ERROR})
async def get_google_authorization(
    request: Request,
    response: Response,
    service: Annotated[GoogleLoginService, Depends(get_google_login_service)],
) -> ApiResponse[GoogleAuthorizationData]:
    """Start Google sign-in: return Google's authorisation URL for a full-page navigation."""
    started = await service.begin()
    SessionCookies.set_oidc_flow(response, started.flow_cookie)
    return ok(GoogleAuthorizationData(authorization_url=started.url), request)


@router.post("/google-sessions", status_code=201, responses={400: _ERROR, 401: _ERROR, 409: _ERROR})
async def create_google_session(
    request: Request,
    response: Response,
    body: GoogleSessionRequest,
    service: Annotated[GoogleLoginService, Depends(get_google_login_service)],
) -> ApiResponse[SessionData]:
    """Finish Google sign-in with the code and state Google returned, and start a session."""
    now = _now()
    try:
        issued = await service.complete(
            body.code, body.state, SessionCookies.read_oidc_flow(request), _source(request), now
        )
    except (GoogleFlowInvalidError, GoogleLoginRejectedError) as exc:
        exc.response_hook = SessionCookies.clear_oidc_flow
        raise
    _deliver(response, issued, now)
    SessionCookies.clear_oidc_flow(response)
    return ok(session_data(issued.user), request)
