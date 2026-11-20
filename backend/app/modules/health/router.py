"""Routes of the health module (api-contract §getHealth)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.envelope import ok
from app.core.schemas import ApiResponse, ErrorResponse
from app.modules.health.schemas import HealthData
from app.modules.health.service import HealthService, get_health_service

__all__ = ["router"]

router = APIRouter()


@router.get("/health", responses={503: {"model": ErrorResponse}})
async def get_health(
    request: Request, service: Annotated[HealthService, Depends(get_health_service)]
) -> ApiResponse[HealthData]:
    """Report service and database availability; deliberately public (S10).

    Raises:
        DatabaseUnavailableError: From the service; the handler turns it into
            a ``503`` ``DATABASE_UNAVAILABLE`` envelope.
    """
    return ok(await service.check(), request)
