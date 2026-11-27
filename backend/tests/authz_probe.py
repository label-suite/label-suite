"""Authorization probe routes that exist only in tests (authz-steps-3-4 design D8, D9).

No production endpoint declares a permission yet, so the integration tests reach
``require_permission`` through these routes. ``tests/probe.py`` includes
``add_authz_probes(probe_router)``, so the harness mounts them under the same
``/api/v1`` parent router and the parity test sees them as probe paths.

For every whitelisted key there are three routes, so a test picks any key in any scope:

- ``system_path(key)``: a platform-scope operation (no task).
- ``task_path(key, task_id)``: a task-scoped operation; the handler declares
  ``taskId: UUID``, so a malformed ID would be a ``422`` if authorization ran later.
- ``acting_path(key, task_id, role)``: a task-scoped operation with an acting role.

Further routes carry a key outside the whitelist, declared step-4 conditions and the
ground-truth barrier. The condition doubles are module-level so a test can read their
``calls``; a test that does clears them first. Every success returns only
``{"granted": true}``.
"""

from collections.abc import Sequence
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Request

from app.core.authz import (
    AccessCondition,
    AccessGrant,
    ConditionKind,
    GroundTruthBarrier,
    require_permission,
)
from app.core.envelope import ok
from app.core.errors import AppError, NotFoundError
from app.core.permissions import PermissionKey
from app.core.schemas import ApiResponse, ResponseModel
from tests.support.authz import PassingCondition, RefusingCondition

__all__ = [
    "ANSWER_PATH",
    "EDIT_HIDDEN_CONDITION",
    "PASSING_CONDITIONS",
    "REFUSING_CONDITIONS",
    "UNKNOWN_KEY",
    "ProbeTaskStateError",
    "acting_path",
    "add_authz_probes",
    "answer_path",
    "conditions_path",
    "edit_hidden_path",
    "passing_path",
    "system_path",
    "task_path",
    "unknown_key_path",
]

UNKNOWN_KEY = "admin.unknown.view"
"""A value outside the whitelist; production code cannot spell it (design D2)."""

PREFIX = "/authz-probe"
ANSWER_PATH = PREFIX + "/tasks/{taskId}/ground-truth"


class ProbeTaskStateError(AppError):
    """A test-only ``409``: what a task-state condition raises for a visible task."""

    status_code = 409
    code = "PROBE_TASK_STATE_CONFLICT"
    message_key = "common.internal_error"


class GrantData(ResponseModel):
    """The probe's success payload; never the grant itself."""

    granted: bool


def _slug(key: str) -> str:
    return key.replace(".", "-").replace("_", "-")


def system_path(key: str) -> str:
    """Return the API path of the platform-scope probe for ``key``."""
    return f"/api/v1{PREFIX}/system-{_slug(key)}"


def task_path(key: str, task_id: object) -> str:
    """Return the API path of the task-scoped probe for ``key`` in ``task_id``."""
    return f"/api/v1{PREFIX}/tasks/{task_id}/task-{_slug(key)}"


def acting_path(key: str, task_id: object, role: str) -> str:
    """Return the API path of the task-scoped probe for ``key`` acting as ``role``."""
    return f"/api/v1{PREFIX}/tasks/{task_id}/roles/{role}/acting-{_slug(key)}"


def unknown_key_path() -> str:
    """Return the API path of the platform-scope probe that declares ``UNKNOWN_KEY``."""
    return system_path(UNKNOWN_KEY)


def conditions_path(kind: str, task_id: object) -> str:
    """Return the path of the ``task.detail.view`` probe whose ``kind`` condition refuses."""
    return f"/api/v1{PREFIX}/tasks/{task_id}/refusing-{_slug(kind)}"


def passing_path(task_id: object) -> str:
    """Return the path of the ``task.detail.view`` probe with two passing conditions."""
    return f"/api/v1{PREFIX}/tasks/{task_id}/passing-conditions"


def edit_hidden_path(task_id: object) -> str:
    """Return the path of the ``task.detail.edit`` probe with a refusing ownership condition."""
    return f"/api/v1{PREFIX}/tasks/{task_id}/edit-hidden"


def answer_path(task_id: object) -> str:
    """Return the path of the ``task.detail.view`` probe that reads ground truth."""
    return "/api/v1" + ANSWER_PATH.replace("{taskId}", str(task_id))


REFUSING_CONDITIONS: dict[ConditionKind, RefusingCondition] = {
    "task_ownership": RefusingCondition("task_ownership", NotFoundError()),
    "task_state": RefusingCondition("task_state", ProbeTaskStateError()),
    "assignment": RefusingCondition("assignment", NotFoundError()),
    "reviewer_identity": RefusingCondition("reviewer_identity", NotFoundError()),
    "dataset_visibility": RefusingCondition("dataset_visibility", NotFoundError()),
    "acting_role": RefusingCondition("acting_role", NotFoundError()),
}
"""One refusing condition per kind except ``answer_isolation`` (the real barrier)."""

PASSING_CONDITIONS = (PassingCondition("task_ownership"), PassingCondition("task_state"))
EDIT_HIDDEN_CONDITION = RefusingCondition("task_ownership", NotFoundError())
"""Declared by the ``task.detail.edit`` probe; must not run when the cell is off."""


def _add_system_probe(router: APIRouter, path: str, key: PermissionKey) -> None:
    dependency = require_permission(key)

    async def probe(
        request: Request, grant: Annotated[AccessGrant, Depends(dependency)]
    ) -> ApiResponse[GrantData]:
        del grant
        return ok(GrantData(granted=True), request)

    router.add_api_route(path, probe, methods=["GET"])


def _add_task_probe(
    router: APIRouter,
    path: str,
    key: PermissionKey,
    *,
    acting: bool = False,
    conditions: Sequence[AccessCondition] = (),
) -> None:
    dependency = require_permission(
        key,
        task_id_param="taskId",
        acting_role_param="actingRole" if acting else None,
        conditions=conditions,
    )

    async def probe(
        request: Request,
        task_id: Annotated[UUID, Path(alias="taskId")],
        grant: Annotated[AccessGrant, Depends(dependency)],
    ) -> ApiResponse[GrantData]:
        del task_id, grant
        return ok(GrantData(granted=True), request)

    router.add_api_route(path, probe, methods=["GET"])


def add_authz_probes(router: APIRouter) -> None:
    """Add every authorization probe route to ``router``.

    The routes are added to ``router`` itself rather than included as a sub-router:
    FastAPI 0.165 keeps an included router as one lazy entry in ``router.routes``, so
    ``test_harness_parity.probe_paths()`` would not see the probe paths.
    """
    for key in PermissionKey:
        slug = _slug(key)
        _add_system_probe(router, f"{PREFIX}/system-{slug}", key)
        _add_task_probe(router, f"{PREFIX}/tasks/{{taskId}}/task-{slug}", key)
        _add_task_probe(
            router,
            f"{PREFIX}/tasks/{{taskId}}/roles/{{actingRole}}/acting-{slug}",
            key,
            acting=True,
        )
    # Deliberately outside the type: the authorizer must still refuse it (S3).
    _add_system_probe(
        router, f"{PREFIX}/system-{_slug(UNKNOWN_KEY)}", cast(PermissionKey, UNKNOWN_KEY)
    )
    view = PermissionKey.TASK_DETAIL_VIEW
    for kind, condition in REFUSING_CONDITIONS.items():
        _add_task_probe(
            router,
            f"{PREFIX}/tasks/{{taskId}}/refusing-{_slug(kind)}",
            view,
            conditions=[condition],
        )
    _add_task_probe(
        router, f"{PREFIX}/tasks/{{taskId}}/passing-conditions", view, conditions=PASSING_CONDITIONS
    )
    _add_task_probe(
        router,
        f"{PREFIX}/tasks/{{taskId}}/edit-hidden",
        PermissionKey.TASK_DETAIL_EDIT,
        conditions=[EDIT_HIDDEN_CONDITION],
    )
    _add_task_probe(router, ANSWER_PATH, view, conditions=[GroundTruthBarrier()])
