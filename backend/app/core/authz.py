"""What the caller may do: authorization steps 2b, 3 and 4 (authz-steps-3-4 design D1).

``require_permission`` is the dependency an endpoint that needs a permission declares;
it runs after ``get_current_principal`` (steps 1 and 2) and hands the handler an
``AccessGrant``. ``Authorizer`` decides in a fixed order and stops at the first step
that fails; there is no default allow (security-agent-rules S3):

- 2b, task-scoped operations only: the caller's active task roles, read through the
  ``TaskMembershipReader``. None, or an acting role the caller does not hold, is
  ``NotFoundError``, so a non-member cannot tell whether the task exists.
- 3a-3d: the key is whitelisted and enabled, its layer matches the operation's scope,
  the matrix version row exists, and every effective role's cell exists with at least
  one on. Every refusal is the same ``PermissionDeniedError`` (``403``).
- 4: the declared conditions, in order; each raises its own error.
  ``GroundTruthBarrier`` is the answer-isolation condition and refuses everyone.

``app.core`` imports no business module, so the matrix, the task memberships and the
business conditions are protocols here; the modules holding the data implement them and
``app.main`` puts the provider and the reader in ``app.state``. Nothing is cached.
"""

from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_current_principal
from app.core.db import get_db
from app.core.errors import AppError, NotFoundError
from app.core.permissions import (
    PERMISSION_REGISTRY,
    TASK_ROLES,
    PermissionKey,
    PermissionLayer,
    PermissionSpec,
    TaskRole,
)

__all__ = [
    "AccessCondition",
    "AccessContext",
    "AccessGrant",
    "Authorizer",
    "ConditionKind",
    "GroundTruthBarrier",
    "MatrixLookup",
    "PermissionDeniedError",
    "PermissionMatrixProvider",
    "TaskMembershipReader",
    "require_permission",
]

ConditionKind = Literal[
    "task_ownership", "task_state", "assignment", "reviewer_identity",
    "dataset_visibility", "answer_isolation", "acting_role",
]  # fmt: skip
"""Step-4 condition kinds; ``acting_role`` is reserved for conditions that depend on the
role the caller acts as (for example hiding test-set markers from an annotator)."""


class PermissionDeniedError(AppError):
    """``403``: step 3 refused; the same response for every reason, with no params."""

    status_code = 403
    code = "PERMISSION_DENIED"
    message_key = "common.permission_denied"


@dataclass(frozen=True)
class MatrixLookup:
    """What one matrix read returned.

    Attributes:
        version: The matrix version, or ``None`` when the version row does not exist.
        cells: The requested roles' cells that exist, by role key; a missing role
            means its row is missing.
    """

    version: int | None
    cells: Mapping[str, bool]


@dataclass(frozen=True)
class AccessContext:
    """The input of a step-4 condition.

    Attributes:
        principal: The caller.
        key: The permission key that passed step 3.
        task_id: The task of a task-scoped operation, otherwise ``None``.
        effective_roles: The roles whose cells were checked.
        acting_role: The role the caller acts as, or ``None``.
    """

    principal: Principal
    key: PermissionKey
    task_id: UUID | None
    effective_roles: frozenset[str]
    acting_role: TaskRole | None


@dataclass(frozen=True)
class AccessGrant:
    """The result of a successful authorization, handed to the handler and service.

    Never part of a response schema.

    Attributes:
        principal: The caller.
        key: The permission key that was granted.
        task_id: The task of a task-scoped operation, otherwise ``None``.
        task_roles: All of the caller's active task roles in that task.
        effective_roles: The roles whose cells were checked: the system role, the
            union of the task roles, or only the acting role.
        acting_role: The role the caller acts as, or ``None``.
        matrix_version: The matrix version the decision was made on.
    """

    principal: Principal
    key: PermissionKey
    task_id: UUID | None
    task_roles: frozenset[TaskRole]
    effective_roles: frozenset[str]
    acting_role: TaskRole | None
    matrix_version: int


class PermissionMatrixProvider(Protocol):
    """Reads the permission matrix; implemented by the module that owns it."""

    async def lookup(
        self,
        db: AsyncSession,
        layer: PermissionLayer,
        key: PermissionKey,
        role_keys: frozenset[str],
    ) -> MatrixLookup:
        """Return the matrix version and the given roles' cells for one key.

        Implementations only read; they never write or commit.
        """
        ...


class TaskMembershipReader(Protocol):
    """Reads task memberships; implemented by the module that owns them."""

    async def active_roles(
        self, db: AsyncSession, task_id: UUID, user_id: UUID
    ) -> frozenset[TaskRole]:
        """Return the user's active roles in the task.

        Invited and disabled memberships are not active, so they are not returned; a
        task the user has no role in, or that does not exist, gives an empty set.
        Implementations only read.
        """
        ...


class AccessCondition(Protocol):
    """One step-4 condition; implemented by the module that holds its data."""

    @property
    def kind(self) -> ConditionKind:
        """The kind of condition."""
        ...

    async def check(self, context: AccessContext, db: AsyncSession) -> None:
        """Return when the condition holds; otherwise raise.

        Raises:
            NotFoundError: When the resource is not visible to the caller.
            AppError: The condition's own error when the resource is visible but the
                operation is not allowed in its current state.
        """
        ...


@dataclass(frozen=True)
class GroundTruthBarrier:
    """The answer-isolation condition: reading ground truth is closed to every caller.

    Only the authorised scoring process reads ground truth, and it does not go through
    request authorization, so no role and no matrix setting can open this.
    """

    kind: ConditionKind = "answer_isolation"

    async def check(self, context: AccessContext, db: AsyncSession) -> None:
        """Always refuse with the plain not-found error, which does not hint at answers.

        Raises:
            NotFoundError: Always.
        """
        raise NotFoundError


class Authorizer:
    """Decides steps 2b, 3 and 4 for one request; reads only, never commits."""

    def __init__(
        self, matrix: PermissionMatrixProvider, memberships: TaskMembershipReader | None = None
    ) -> None:
        """Create the authorizer from a matrix provider and an optional membership reader.

        Without a reader, a task-scoped operation is a wiring error (``RuntimeError``).
        """
        self._matrix = matrix
        self._memberships = memberships

    async def authorize(
        self,
        principal: Principal,
        key: PermissionKey,
        db: AsyncSession,
        *,
        task_id: UUID | None = None,
        acting_role: TaskRole | None = None,
        conditions: Sequence[AccessCondition] = (),
    ) -> AccessGrant:
        """Run steps 2b, 3 and 4 in order and return the grant.

        Args:
            principal: The caller from steps 1 and 2.
            key: The operation's permission key.
            db: The request's session; only read.
            task_id: The task of a task-scoped operation, or ``None``.
            acting_role: The role the caller acts as, or ``None`` for the union.
            conditions: The step-4 conditions, run in order after the cell passes.

        Returns:
            The grant, with the effective roles and the matrix version.

        Raises:
            NotFoundError: No active role in the task, or the acting role is not one of
                them; or a condition found the resource hidden.
            PermissionDeniedError: Step 3 refused.
            AppError: A condition's own error.
            RuntimeError: A task-scoped operation without a membership reader.
        """
        task_roles: frozenset[TaskRole] = frozenset()
        if task_id is not None:
            task_roles = await self._task_roles(principal, task_id, db)
            if acting_role is not None and acting_role not in task_roles:
                raise NotFoundError
        spec = self._resolve_spec(key, task_scoped=task_id is not None)
        if spec.layer == "system":
            role_keys: frozenset[str] = frozenset({principal.role})
        elif acting_role is not None:
            role_keys = frozenset({acting_role})
        else:
            role_keys = frozenset(task_roles)
        lookup = await self._matrix.lookup(db, spec.layer, spec.key, role_keys)
        version = self._require_cell(role_keys, lookup)
        grant = AccessGrant(
            principal=principal,
            key=spec.key,
            task_id=task_id,
            task_roles=task_roles,
            effective_roles=role_keys,
            acting_role=acting_role,
            matrix_version=version,
        )
        await self.check_conditions(grant, conditions, db)
        return grant

    async def check_conditions(
        self, grant: AccessGrant, conditions: Sequence[AccessCondition], db: AsyncSession
    ) -> None:
        """Run step-4 conditions for an existing grant, in order.

        A service calls this before touching a record that a condition needs to see.

        Raises:
            NotFoundError: A condition found the resource hidden.
            AppError: A condition's own error.
        """
        context = AccessContext(
            principal=grant.principal,
            key=grant.key,
            task_id=grant.task_id,
            effective_roles=grant.effective_roles,
            acting_role=grant.acting_role,
        )
        for condition in conditions:
            await condition.check(context, db)

    async def _task_roles(
        self, principal: Principal, task_id: UUID, db: AsyncSession
    ) -> frozenset[TaskRole]:
        if self._memberships is None:
            raise RuntimeError("a task-scoped operation needs app.state.task_membership_reader")
        roles = await self._memberships.active_roles(db, task_id, principal.user_id)
        if not roles:
            raise NotFoundError
        return roles

    @staticmethod
    def _resolve_spec(key: PermissionKey, *, task_scoped: bool) -> PermissionSpec:
        spec = PERMISSION_REGISTRY.get(key)
        if spec is None or not spec.enabled:
            raise PermissionDeniedError
        if (spec.layer == "task") != task_scoped:
            raise PermissionDeniedError
        return spec

    @staticmethod
    def _require_cell(role_keys: frozenset[str], lookup: MatrixLookup) -> int:
        if lookup.version is None:
            raise PermissionDeniedError
        if any(role not in lookup.cells for role in role_keys):
            raise PermissionDeniedError
        if not any(lookup.cells[role] for role in role_keys):
            raise PermissionDeniedError
        return lookup.version


def require_permission(
    key: PermissionKey,
    *,
    task_id_param: str | None = None,
    acting_role_param: str | None = None,
    conditions: Sequence[AccessCondition] = (),
) -> Callable[..., Awaitable[AccessGrant]]:
    """Build the FastAPI dependency that authorizes one operation.

    Use it as ``grant: AccessGrant = Depends(require_permission(...))``. The task ID
    and the acting role are read only from the named path parameters, never from the
    query or the body. Each request builds an ``Authorizer`` from
    ``app.state.permission_matrix_provider`` and ``app.state.task_membership_reader``.

    Args:
        key: The operation's permission key.
        task_id_param: The path parameter holding the task ID of a task-scoped
            operation, or ``None`` for a platform-layer operation.
        acting_role_param: The path parameter holding the acting role, or ``None``.
        conditions: The step-4 conditions of the operation.

    Returns:
        The dependency; it returns the ``AccessGrant``.

    Raises:
        ValueError: ``acting_role_param`` without ``task_id_param``.

    The dependency raises ``NotFoundError`` for a path value it cannot convert (not a
    UUID, not a task role) and what ``Authorizer.authorize`` raises; ``RuntimeError``
    for a missing provider, reader (task-scoped only) or declared path parameter.
    """
    if acting_role_param is not None and task_id_param is None:
        raise ValueError("acting_role_param requires task_id_param")
    declared = tuple(conditions)

    async def dependency(
        request: Request,
        principal: Principal = Depends(get_current_principal),  # noqa: B008 - FastAPI dependency
        db: AsyncSession = Depends(get_db),  # noqa: B008 - FastAPI dependency
    ) -> AccessGrant:
        state = request.app.state
        matrix: PermissionMatrixProvider | None = getattr(state, "permission_matrix_provider", None)
        memberships: TaskMembershipReader | None = getattr(state, "task_membership_reader", None)
        if matrix is None:
            raise RuntimeError("app.state.permission_matrix_provider is required")
        if task_id_param is not None and memberships is None:
            raise RuntimeError("a task-scoped operation needs app.state.task_membership_reader")
        task_id = _task_id(request, task_id_param)
        acting_role = _acting_role(request, acting_role_param)
        return await Authorizer(matrix, memberships).authorize(
            principal, key, db, task_id=task_id, acting_role=acting_role, conditions=declared
        )

    return dependency


def _path_value(request: Request, name: str) -> str:
    if name not in request.path_params:
        raise RuntimeError(f"path parameter {name!r} is not in the route")
    return str(request.path_params[name])


def _task_id(request: Request, name: str | None) -> UUID | None:
    try:
        return None if name is None else UUID(_path_value(request, name))
    except ValueError:
        raise NotFoundError from None


def _acting_role(request: Request, name: str | None) -> TaskRole | None:
    if name is None:
        return None
    value = _path_value(request, name)
    role = next((role for role in TASK_ROLES if role == value), None)
    if role is None:
        raise NotFoundError
    return role
