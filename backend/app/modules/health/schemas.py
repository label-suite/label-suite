"""Response schemas of the health module (api-contract §getHealth)."""

from enum import StrEnum

from app.core.schemas import ResponseModel

__all__ = ["HealthData", "HealthStatus"]


class HealthStatus(StrEnum):
    """The only reported state. Adding a value is a breaking change (A10)."""

    OK = "ok"


class HealthData(ResponseModel):
    """The health payload: exactly ``status`` and ``database``, no deployment details.

    Attributes:
        status: The service can handle requests.
        database: One query against the database succeeded.
    """

    status: HealthStatus
    database: HealthStatus
