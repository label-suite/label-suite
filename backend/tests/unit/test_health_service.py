"""Unit tests for ``HealthService.check`` (design D4, spec health-check)."""

import asyncio
import logging

import pytest
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.core.envelope import correlation_id_var
from app.core.errors import DatabaseUnavailableError
from app.core.log_config import install_trace_id_record_factory
from app.modules.health.schemas import HealthData, HealthStatus
from app.modules.health.service import HealthService

CANARY_URL = "postgresql://u:CANARY-pw@CANARY-host:5432/x"


class FakeRepository:
    """Stands in for ``HealthRepository``; ``ping`` raises ``error`` when set."""

    def __init__(self, error: BaseException | None = None) -> None:
        self.error = error
        self.calls = 0

    async def ping(self) -> None:
        self.calls += 1
        if self.error is not None:
            raise self.error


async def test_check_reports_ok_when_the_ping_succeeds() -> None:
    repository = FakeRepository()

    result = await HealthService(repository).check()

    assert result == HealthData(status=HealthStatus.OK, database=HealthStatus.OK)
    assert repository.calls == 1


@pytest.mark.parametrize(
    "error",
    [
        OperationalError("SELECT 1", {}, Exception(f"could not connect to {CANARY_URL}")),
        DBAPIError("SELECT 1", {}, Exception(f"driver failure at {CANARY_URL}")),
        ConnectionRefusedError(f"connect to {CANARY_URL} refused"),
        OSError(f"no route to {CANARY_URL}"),
        TimeoutError(f"timed out reaching {CANARY_URL}"),
        PoolTimeoutError(f"QueuePool limit reached for {CANARY_URL}"),
    ],
    ids=["operational", "dbapi", "connection-refused", "os", "timeout", "pool-timeout"],
)
async def test_check_turns_connection_failures_into_database_unavailable(
    error: BaseException, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    install_trace_id_record_factory()

    token = correlation_id_var.set("client-trace-0002")
    try:
        with pytest.raises(DatabaseUnavailableError) as caught:
            await HealthService(FakeRepository(error)).check()
    finally:
        correlation_id_var.reset(token)

    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__ is True
    assert caught.value.already_logged is True
    warnings = [record for record in caplog.records if record.levelno == logging.WARNING]
    assert len(warnings) == 1
    message = warnings[0].getMessage()
    assert type(error).__name__ in message
    assert getattr(warnings[0], "trace_id", None) == "client-trace-0002"
    assert "traceId=" not in message
    assert "client-trace-0002" not in message
    assert "CANARY" not in caplog.text


class HangingRepository:
    """A ``ping`` that never answers in time, like a hung pooled connection."""

    def __init__(self) -> None:
        self.cancelled = False

    async def ping(self) -> None:
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            self.cancelled = True
            raise


async def test_check_bounds_a_hanging_ping_and_reports_database_unavailable(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr("app.modules.health.service.POSTGRES_CONNECT_TIMEOUT_SECONDS", 0.01)
    caplog.set_level(logging.WARNING)
    repository = HangingRepository()

    with pytest.raises(DatabaseUnavailableError) as caught:
        await asyncio.wait_for(HealthService(repository).check(), timeout=2)

    assert caught.value.__cause__ is None
    assert repository.cancelled is True
    assert caught.value.already_logged is True
    warnings = [record for record in caplog.records if record.levelno == logging.WARNING]
    assert len(warnings) == 1
    assert "TimeoutError" in warnings[0].getMessage()
    assert "traceId=" not in warnings[0].getMessage()


async def test_check_lets_unrelated_errors_through() -> None:
    with pytest.raises(RuntimeError):
        await HealthService(FakeRepository(RuntimeError("bug"))).check()
