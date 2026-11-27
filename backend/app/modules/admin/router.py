"""Routes of the admin module (HTTP layer).

The router has no route and is not mounted, so the admin module adds no operation and
no OpenAPI tag (authz-steps-3-4 design D3). It exists because the ``Module layers``
contract requires the router layer in every module; the role settings endpoints are
added with #729.
"""

from fastapi import APIRouter

__all__ = ["router"]

router = APIRouter()
