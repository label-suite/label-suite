"""Test doubles for authorization steps 2b, 3 and 4 (authz-steps-3-4 design D9).

Each class implements a protocol of ``app.core.authz`` and is handed to ``Authorizer``
directly, or put in ``app.state`` the same way the assembly point wires the real
implementations; none of them replaces an object this project imports.

- ``FakePermissionMatrixProvider``: an in-memory matrix that starts as the 62 initial
  cells and version ``1``; cells can be changed or removed and the version dropped.
- ``FakeTaskMembershipReader``: the active task roles per ``(task_id, user_id)``;
  anyone not listed has none, which is also how a disabled or invited member looks.
- ``RefusingCondition`` and ``PassingCondition``: a step-4 condition of any kind that
  always raises a new instance of the given error, or always passes; both record their calls.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import AccessContext, ConditionKind, MatrixLookup
from app.core.errors import AppError
from app.core.permissions import PermissionKey, PermissionLayer, TaskRole, applicable_cells

__all__ = [
    "FakePermissionMatrixProvider",
    "FakeTaskMembershipReader",
    "PassingCondition",
    "RefusingCondition",
]

CellId = tuple[str, str, str]
"""``(layer, role_key, permission_key)``."""


class FakePermissionMatrixProvider:
    """A ``PermissionMatrixProvider`` over an in-memory matrix.

    Attributes:
        cells: ``(layer, role_key, permission_key)`` -> allowed.
        version: The matrix version, or ``None`` when the version row is missing.
        calls: Every lookup, as ``(layer, key, role_keys)``.
    """

    def __init__(self, cells: Mapping[CellId, bool] | None = None, *, version: int | None = 1):
        initial: dict[CellId, bool] = {
            (c.layer, c.role_key, str(c.key)): c.allowed for c in applicable_cells()
        }
        self.cells: dict[CellId, bool] = dict(initial if cells is None else cells)
        self.version = version
        self.calls: list[tuple[str, str, frozenset[str]]] = []

    def set(self, layer: str, role_key: str, key: str, allowed: bool) -> None:
        """Set one cell, adding the row when it is missing."""
        self.cells[(layer, role_key, key)] = allowed

    def remove(self, layer: str, role_key: str, key: str) -> None:
        """Delete one cell's row."""
        del self.cells[(layer, role_key, key)]

    async def lookup(
        self,
        db: AsyncSession,
        layer: PermissionLayer,
        key: PermissionKey,
        role_keys: frozenset[str],
    ) -> MatrixLookup:
        """Return the version and the requested roles' cells that exist."""
        self.calls.append((layer, str(key), role_keys))
        found = {
            role: allowed
            for (cell_layer, role, cell_key), allowed in self.cells.items()
            if cell_layer == layer and cell_key == str(key) and role in role_keys
        }
        return MatrixLookup(version=self.version, cells=found)


class FakeTaskMembershipReader:
    """A ``TaskMembershipReader`` over a fixed table of active task roles.

    Attributes:
        calls: Every read, as ``(task_id, user_id)``.
    """

    def __init__(self, roles: Mapping[tuple[UUID, UUID], frozenset[TaskRole]] | None = None):
        self._roles = dict(roles or {})
        self.calls: list[tuple[UUID, UUID]] = []

    def grant(self, task_id: UUID, user_id: UUID, *roles: TaskRole) -> None:
        """Make ``roles`` the user's active roles in the task."""
        self._roles[(task_id, user_id)] = frozenset(roles)

    async def active_roles(
        self, db: AsyncSession, task_id: UUID, user_id: UUID
    ) -> frozenset[TaskRole]:
        """Return the user's active roles in the task; empty when there are none."""
        self.calls.append((task_id, user_id))
        return self._roles.get((task_id, user_id), frozenset())


@dataclass
class RefusingCondition:
    """A step-4 condition that always raises a new error built by ``error``.

    Attributes:
        kind: The condition kind it stands in for.
        error: Builds the error to raise on each check, e.g. ``NotFoundError`` for a
            hidden resource; a new instance every time, so no traceback is shared.
        calls: The context of every check.
    """

    kind: ConditionKind
    error: Callable[[], AppError]
    calls: list[AccessContext] = field(default_factory=list)

    async def check(self, context: AccessContext, db: AsyncSession) -> None:
        """Record the call and refuse with a new error."""
        self.calls.append(context)
        raise self.error()


@dataclass
class PassingCondition:
    """A step-4 condition that always passes.

    Attributes:
        kind: The condition kind it stands in for.
        calls: The context of every check.
    """

    kind: ConditionKind
    calls: list[AccessContext] = field(default_factory=list)

    async def check(self, context: AccessContext, db: AsyncSession) -> None:
        """Record the call."""
        self.calls.append(context)
