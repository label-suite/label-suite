"""Unit tests for ``app.mail.unsent_link`` (design D7).

Spec ``mail-delivery`` "未寄出的連結只走專用管道": the link reaches the dedicated logger's own
stderr handler and never a collector on the root logger, and ``configure_logging`` does
not remove that handler.
"""

import io
import logging
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.config import WorkerSettings
from app.core.log_config import configure_logging
from app.mail import record_unsent_link
from app.mail.unsent_link import UNSENT_LINK_LOGGER_NAME

LINK = "https://example.test/set-password?t=CANARY-token"


class _Collector(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.DEBUG)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(record.getMessage())


@pytest.fixture
def root_collector() -> Iterator[_Collector]:
    collector = _Collector()
    root = logging.getLogger()
    root.addHandler(collector)
    try:
        yield collector
    finally:
        root.removeHandler(collector)


def test_the_link_reaches_only_the_dedicated_output(
    root_collector: _Collector, capsys: pytest.CaptureFixture[str]
) -> None:
    record_unsent_link("account_invite", LINK)

    err = capsys.readouterr().err
    assert "CANARY-token" in err
    assert f"logger={UNSENT_LINK_LOGGER_NAME} " in err
    assert "kind=account_invite" in err
    assert not [m for m in root_collector.messages if "CANARY-token" in m]


def test_configure_logging_keeps_the_dedicated_handler(
    tmp_path: Path, root_collector: _Collector, capsys: pytest.CaptureFixture[str]
) -> None:
    buffer = io.StringIO()
    configure_logging(
        WorkerSettings(database_url=None, sqlite_path=tmp_path / "a.db", log_level="ERROR"),
        stream=buffer,
    )

    record_unsent_link("account_invite", LINK)

    assert "CANARY-token" in capsys.readouterr().err
    assert "CANARY-token" not in buffer.getvalue()
    assert not root_collector.messages


def test_the_logger_does_not_propagate() -> None:
    assert logging.getLogger(UNSENT_LINK_LOGGER_NAME).propagate is False


def test_a_malformed_kind_is_refused_without_writing_the_link(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(ValueError, match="kind"):
        record_unsent_link("Bad Kind", LINK)

    assert "CANARY-token" not in capsys.readouterr().err
