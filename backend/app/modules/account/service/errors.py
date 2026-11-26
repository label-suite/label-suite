"""The account module's errors; codes and statuses follow ``api-contract.md``.

None of them carries a parameter: no response says which account, session or reason
was involved (spec 01-05 §不能通行的登入狀態不說明原因).
"""

from app.core.errors import AppError

__all__ = [
    "GoogleFlowInvalidError",
    "GoogleLoginRejectedError",
    "GoogleUnavailableError",
    "InvalidCredentialsError",
    "RefreshConflictError",
    "SessionExpiredError",
    "SessionInvalidError",
]


class InvalidCredentialsError(AppError):
    """``401``: no such account, wrong password, inactive, anonymised or no local password."""

    status_code = 401
    code = "ACCOUNT_INVALID_CREDENTIALS"
    message_key = "account.invalid_credentials"


class SessionExpiredError(AppError):
    """``401``: the session passed the 90-day or the 7-day limit."""

    status_code = 401
    code = "ACCOUNT_SESSION_EXPIRED"
    message_key = "account.session_expired"


class SessionInvalidError(AppError):
    """``401``: a refresh cookie was sent but cannot be used, for any other reason."""

    status_code = 401
    code = "ACCOUNT_SESSION_INVALID"
    message_key = "account.session_invalid"


class RefreshConflictError(AppError):
    """``409``: the same refresh token was used a third time within the grace period."""

    status_code = 409
    code = "ACCOUNT_REFRESH_CONFLICT"
    message_key = "account.refresh_conflict"


class GoogleLoginRejectedError(AppError):
    """``401``: no usable account for this Google account; one code for every reason."""

    status_code = 401
    code = "ACCOUNT_GOOGLE_REJECTED"
    message_key = "account.google_rejected"


class GoogleFlowInvalidError(AppError):
    """``400``: the Google sign-in flow did not verify (cookie, state or Google's answer)."""

    status_code = 400
    code = "ACCOUNT_GOOGLE_FLOW_INVALID"
    message_key = "account.google_flow_invalid"


class GoogleUnavailableError(AppError):
    """``409``: this deployment has no Google sign-in configured."""

    status_code = 409
    code = "ACCOUNT_GOOGLE_UNAVAILABLE"
    message_key = "account.google_unavailable"
