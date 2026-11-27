"""Unit tests for step 4: conditions and ``GroundTruthBarrier`` (authz-steps-3-4 D9).

Conditions run only after the cell has passed, in the declared order, and any one that
refuses stops the request even though the cell is on. Each of the six business kinds
(including the reserved ``acting_role``) gets one negative test with a stand-in
condition; answer isolation is tested with the real ``GroundTruthBarrier``, which
refuses every role with ``404`` and never reveals that an answer exists.
"""

import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, cast, get_args

import httpx
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, SystemRole, get_current_principal
from app.core.authz import (
    AccessContext,
    AccessGrant,
    Authorizer,
    ConditionKind,
    GroundTruthBarrier,
    PermissionDeniedError,
    require_permission,
)
from app.core.db import get_db
from app.core.errors import AppError, NotFoundError, register_exception_handlers
from app.core.i18n import MessageCatalog
from app.core.permissions import PermissionKey, TaskRole
from tests.support.authz import (
    FakePermissionMatrixProvider,
    FakeTaskMembershipReader,
    PassingCondition,
    RefusingCondition,
)

DB = cast(AsyncSession, object())
TASK_T = uuid.UUID("66666666-6666-4666-8666-666666666666")
K = PermissionKey


class TaskStateConflictError(AppError):
    """A stand-in for a feature card's own "visible but not allowed now" error."""

    status_code = 409
    code = "TASK_STATE_CONFLICT"
    message_key = "common.internal_error"


@dataclass
class SpyCondition:
    """Records that the wrapped condition was reached, then delegates to it."""

    inner: GroundTruthBarrier
    calls: list[AccessContext] = field(default_factory=list)

    @property
    def kind(self) -> ConditionKind:
        return self.inner.kind

    async def check(self, context: AccessContext, db: AsyncSession) -> None:
        self.calls.append(context)
        await self.inner.check(context, db)


def _member(
    *roles: TaskRole, system_role: SystemRole = "user"
) -> tuple[Principal, Authorizer, FakePermissionMatrixProvider]:
    principal = Principal(user_id=uuid.uuid4(), session_id=uuid.uuid4(), role=system_role)
    reader = FakeTaskMembershipReader()
    reader.grant(TASK_T, principal.user_id, *roles)
    matrix = FakePermissionMatrixProvider()
    return principal, Authorizer(matrix, reader), matrix


def test_there_are_seven_condition_kinds_including_the_reserved_acting_role() -> None:
    assert set(get_args(ConditionKind)) == {
        "task_ownership",
        "task_state",
        "assignment",
        "reviewer_identity",
        "dataset_visibility",
        "answer_isolation",
        "acting_role",
    }


@pytest.mark.parametrize(
    ("kind", "error"),
    [
        ("task_ownership", NotFoundError()),
        ("task_state", TaskStateConflictError()),
        ("assignment", NotFoundError()),
        ("reviewer_identity", NotFoundError()),
        ("dataset_visibility", NotFoundError()),
        ("acting_role", NotFoundError()),
    ],
)
async def test_a_refusing_condition_denies_even_when_the_cell_is_on(
    kind: ConditionKind, error: AppError
) -> None:
    principal, authorizer, _ = _member("project_leader")
    condition = RefusingCondition(kind, error)

    with pytest.raises(type(error)) as raised:
        await authorizer.authorize(
            principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T, conditions=(condition,)
        )

    assert raised.value is error
    assert len(condition.calls) == 1


async def test_all_conditions_passing_lets_the_operation_through_in_order() -> None:
    principal, authorizer, _ = _member("project_leader", "annotator")
    first, second = PassingCondition("task_ownership"), PassingCondition("task_state")

    grant = await authorizer.authorize(
        principal,
        K.ANNOTATION_ANNOTATE,
        DB,
        task_id=TASK_T,
        acting_role="annotator",
        conditions=(first, second),
    )

    assert grant.effective_roles == frozenset({"annotator"})
    (context,) = first.calls
    assert second.calls == [context]
    assert context.principal is principal
    assert context.key is K.ANNOTATION_ANNOTATE
    assert context.task_id == TASK_T
    assert context.effective_roles == frozenset({"annotator"})
    assert context.acting_role == "annotator"


async def test_the_first_refusing_condition_stops_the_rest() -> None:
    principal, authorizer, _ = _member("project_leader")
    refusing, later = (
        RefusingCondition("assignment", NotFoundError()),
        PassingCondition("task_state"),
    )

    with pytest.raises(NotFoundError):
        await authorizer.authorize(
            principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T, conditions=(refusing, later)
        )
    assert later.calls == []


async def test_conditions_do_not_run_when_the_cell_is_off() -> None:
    principal, authorizer, _ = _member("reviewer")
    condition = RefusingCondition("task_ownership", NotFoundError())

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(
            principal, K.TASK_DETAIL_EDIT, DB, task_id=TASK_T, conditions=(condition,)
        )
    assert condition.calls == []


async def test_no_membership_is_not_found_before_any_condition_or_cell() -> None:
    principal, authorizer, matrix = _member()
    condition = PassingCondition("task_ownership")

    with pytest.raises(NotFoundError):
        await authorizer.authorize(
            principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T, conditions=(condition,)
        )
    assert condition.calls == []
    assert matrix.calls == []


async def test_check_conditions_rebuilds_the_context_from_a_grant() -> None:
    principal, authorizer, _ = _member("project_leader")
    grant = await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)
    passing = PassingCondition("assignment")

    await authorizer.check_conditions(grant, (passing,), DB)
    with pytest.raises(NotFoundError):
        await authorizer.check_conditions(
            grant, (RefusingCondition("assignment", NotFoundError()),), DB
        )

    (context,) = passing.calls
    assert (context.principal, context.key, context.task_id) == (principal, grant.key, TASK_T)
    assert context.effective_roles == grant.effective_roles


# --- GroundTruthBarrier ---------------------------------------------------------------


def test_the_barrier_is_the_answer_isolation_kind() -> None:
    assert GroundTruthBarrier().kind == "answer_isolation"


@pytest.mark.parametrize(
    ("system_role", "task_role"),
    [
        ("super_admin", "project_leader"),
        ("user", "project_leader"),
        ("user", "reviewer"),
        ("user", "annotator"),
    ],
)
async def test_the_barrier_refuses_every_role_after_the_cell_has_passed(
    system_role: SystemRole, task_role: TaskRole
) -> None:
    principal, authorizer, matrix = _member(task_role, system_role=system_role)
    matrix.set("task", "annotator", "task.detail.view", True)
    spy = SpyCondition(GroundTruthBarrier())

    grant = await authorizer.authorize(principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T)
    assert grant.effective_roles == frozenset({task_role})
    with pytest.raises(NotFoundError) as raised:
        await authorizer.authorize(
            principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T, conditions=(spy,)
        )

    assert len(spy.calls) == 1
    assert raised.value.params == {}


async def test_the_barrier_is_not_reached_when_the_cell_is_off() -> None:
    principal, authorizer, _ = _member("annotator")
    spy = SpyCondition(GroundTruthBarrier())

    with pytest.raises(PermissionDeniedError):
        await authorizer.authorize(
            principal, K.TASK_DETAIL_VIEW, DB, task_id=TASK_T, conditions=(spy,)
        )
    assert spy.calls == []


async def test_an_annotator_reading_ground_truth_gets_a_plain_not_found_envelope() -> None:
    annotator, _, matrix = _member("annotator")
    matrix.set("task", "annotator", "task.detail.view", True)
    reader = FakeTaskMembershipReader()
    reader.grant(TASK_T, annotator.user_id, "annotator")
    app = FastAPI()
    app.state.message_catalog = MessageCatalog.load()
    app.state.permission_matrix_provider = matrix
    app.state.task_membership_reader = reader
    register_exception_handlers(app)

    async def fake_db() -> AsyncIterator[Any]:
        yield DB

    async def caller() -> Principal:
        return annotator

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_principal] = caller
    reads_answers = require_permission(
        K.TASK_DETAIL_VIEW, task_id_param="taskId", conditions=(GroundTruthBarrier(),)
    )

    @app.get("/tasks/{taskId}/ground-truth")
    async def ground_truth(grant: AccessGrant = Depends(reads_answers)) -> dict[str, str]:  # noqa: B008
        return {"answer": "secret-label", "groundTruth": "secret-label", "isTestItem": "true"}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"/tasks/{TASK_T}/ground-truth")
        missing = await client.get("/no-such-route")

    body = response.json()
    assert response.status_code == 404
    assert body["code"] == "NOT_FOUND"
    assert body["data"] is None
    assert body["message"] == missing.json()["message"]
    serialized = json.dumps(body)
    for leaked in ("secret-label", "answer", "groundTruth", "isTestItem", str(TASK_T)):
        assert leaked not in serialized
