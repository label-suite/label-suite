"""Domain errors that services raise instead of ``HTTPException``.

Each ``AppError`` carries the HTTP status, the ``UPPER_SNAKE_CASE`` error code
and the message-catalog key of the envelope ``message``; the exception handlers
turn it into an error envelope. Services never build HTTP responses themselves
(backend-agent-rules B1, api-agent-rules A7).
"""

from collections.abc import Mapping

__all__ = ["AppError", "DatabaseUnavailableError", "NotAcceptableError", "NotFoundError"]


class AppError(Exception):
    """Base class of every error that maps to an error envelope.

    Subclasses set the class attributes ``status_code``, ``code`` and
    ``message_key``.

    Attributes:
        status_code: HTTP status of the error response.
        code: The application error code, e.g. ``NOT_FOUND``.
        message_key: Message-catalog key of the localised envelope message.
        params: Named values substituted into the localised message.
    """

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message_key: str = "common.internal_error"

    def __init__(self, params: Mapping[str, str] | None = None) -> None:
        """Create the error.

        Args:
            params: Optional named values for the message template. They end up
                in a response, so never pass internal identifiers or secrets.
        """
        super().__init__(self.code)
        self.params: dict[str, str] = dict(params or {})


class NotFoundError(AppError):
    """``404``: the resource does not exist or is deliberately hidden (S10)."""

    status_code = 404
    code = "NOT_FOUND"
    message_key = "common.not_found"


class NotAcceptableError(AppError):
    """``406``: every language in ``Accept-Language`` is unsupported or refused."""

    status_code = 406
    code = "NOT_ACCEPTABLE"
    message_key = "common.not_acceptable"


class DatabaseUnavailableError(AppError):
    """``503``: the database cannot be reached or the connection timed out."""

    status_code = 503
    code = "DATABASE_UNAVAILABLE"
    message_key = "common.database_unavailable"
