"""Account service layer (system-design §元件清單, T11).

A package rather than one file because the services together exceed the 400-line
limit (B11); import-linter still treats ``app.modules.account.service`` as one layer.
Callers import from here, not from the submodules.
"""

from app.modules.account.service.errors import (
    GoogleFlowInvalidError,
    GoogleLoginRejectedError,
    GoogleUnavailableError,
    InvalidCredentialsError,
    RefreshConflictError,
    SessionExpiredError,
    SessionInvalidError,
)
from app.modules.account.service.google import (
    GoogleAuthorization,
    GoogleLoginService,
    get_google_login_service,
)
from app.modules.account.service.login import (
    LoginOptionsService,
    PasswordLoginService,
    get_login_options_service,
    get_password_login_service,
)
from app.modules.account.service.seeder import (
    MAX_PASSWORD_LENGTH,
    SeederCheck,
    SeederConflictError,
    SeederService,
    password_meets_policy,
)
from app.modules.account.service.session import (
    AccountPrincipalLoader,
    IssuedSession,
    SessionPolicy,
    SessionService,
    SourceInfo,
    get_session_service,
    session_data,
)

__all__ = [
    "MAX_PASSWORD_LENGTH",
    "AccountPrincipalLoader",
    "GoogleAuthorization",
    "GoogleFlowInvalidError",
    "GoogleLoginRejectedError",
    "GoogleLoginService",
    "GoogleUnavailableError",
    "InvalidCredentialsError",
    "IssuedSession",
    "LoginOptionsService",
    "PasswordLoginService",
    "RefreshConflictError",
    "SeederCheck",
    "SeederConflictError",
    "SeederService",
    "SessionExpiredError",
    "SessionInvalidError",
    "SessionPolicy",
    "SessionService",
    "SourceInfo",
    "get_google_login_service",
    "get_login_options_service",
    "get_password_login_service",
    "get_session_service",
    "password_meets_policy",
    "session_data",
]
