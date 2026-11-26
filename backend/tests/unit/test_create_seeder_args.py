"""Unit tests for the argument handling of ``create_seeder`` (task 4.4, design D6).

Refused arguments exit 2 before any setting is read or any database is opened; the
database behaviour is covered by ``tests/integration/test_create_seeder.py``.
"""

import io

import pytest

from app.scripts.create_seeder import main, run


def test_main_without_a_name_exits_2_and_names_the_argument(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["--email", "admin@example.org"]) == 2

    assert "--name" in capsys.readouterr().err


async def test_a_refused_argument_never_reads_the_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SQLITE_PATH", "")
    err = io.StringIO()

    code = await run(
        ["--email", "admin@example.org", "--name", "管理員", "--unknown"],
        stdin=io.StringIO(),
        stdout=io.StringIO(),
        stderr=err,
    )

    assert code == 2
    assert "--unknown" in err.getvalue()
