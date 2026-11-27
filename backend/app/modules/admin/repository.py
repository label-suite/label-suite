"""Data access of the admin module (backend-agent-rules B1, B4, B5).

``AdminRolePermissionRepository`` only reads the role permission matrix through
SQLAlchemy; it never writes and never commits. Editing the matrix arrives with the
role settings page (#729).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import PermissionLayer
from app.modules.admin.models import AdminRolePermission, AdminRolePermissionVersion

__all__ = ["AdminRolePermissionRepository"]


class AdminRolePermissionRepository:
    """Reads ``admin_role_permission`` and ``admin_role_permission_version``.

    Args:
        session: The async session of the current request.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_version(self) -> int | None:
        """Return the matrix version, or ``None`` when the version row does not exist."""
        result = await self._session.execute(select(AdminRolePermissionVersion.version))
        return result.scalar_one_or_none()

    async def cells_for(
        self, layer: PermissionLayer, key: str, role_keys: frozenset[str]
    ) -> dict[str, bool]:
        """Return the existing cells of one key for the given roles of one layer.

        Args:
            layer: The role layer (``role_type``) of the cells.
            key: The permission key.
            role_keys: The roles whose cells are wanted; an empty set reads nothing.

        Returns:
            ``role_key`` -> ``allowed`` for every requested role that has a row; a role
            without a row is absent, never filled in.
        """
        if not role_keys:
            return {}
        result = await self._session.execute(
            select(AdminRolePermission.role_key, AdminRolePermission.allowed).where(
                AdminRolePermission.role_type == layer,
                AdminRolePermission.permission_key == key,
                AdminRolePermission.role_key.in_(sorted(role_keys)),
            )
        )
        return {role_key: bool(allowed) for role_key, allowed in result}
