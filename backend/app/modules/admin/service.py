"""Business logic of the admin module (service layer).

``AdminPermissionMatrixProvider`` implements ``app.core.authz.PermissionMatrixProvider``
over the matrix tables; ``app.main`` puts it in ``app.state.permission_matrix_provider``
so ``app.core`` never imports this module (authz-steps-3-4 design D1, D3).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import MatrixLookup
from app.core.permissions import PermissionKey, PermissionLayer
from app.modules.admin.repository import AdminRolePermissionRepository

__all__ = ["AdminPermissionMatrixProvider"]


class AdminPermissionMatrixProvider:
    """Reads the role permission matrix for authorization step 3.

    Each lookup reads the version row and the requested cells afresh: nothing is
    cached, so a changed cell takes effect on the next decision (ADR-004 D6). Nothing
    is written and the session is never committed; the request owns it.
    """

    async def lookup(
        self,
        db: AsyncSession,
        layer: PermissionLayer,
        key: PermissionKey,
        role_keys: frozenset[str],
    ) -> MatrixLookup:
        """Return the matrix version and the given roles' existing cells for one key.

        Args:
            db: The request's session; only read.
            layer: The key's role layer.
            key: The permission key.
            role_keys: The effective roles of this decision.

        Returns:
            The version (``None`` when the version row is missing) and the cells that
            exist; a missing row is left out, so the authorizer refuses it.
        """
        repository = AdminRolePermissionRepository(db)
        version = await repository.get_version()
        cells = await repository.cells_for(layer, str(key), role_keys)
        return MatrixLookup(version=version, cells=cells)
