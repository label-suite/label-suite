"""Integration tests for the Seeder initialisation command (task 4.4, design D6).

Spec 06-01 "部署者建立第一位 Seeder 管理員", "重複執行初始化", "以既有帳號執行初始化"; main
spec ``user-management`` "Seeder 管理員只能由初始化指令建立"; spec ``auth-guard`` "Seeder
管理員的角色是系統管理員". The command runs against the same test database as the app.
"""

import asyncio
import io
import os
import secrets
import subprocess
import sys
from pathlib import Path

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.passwords import PasswordHasher
from app.main import create_app
from app.modules.account.repository import UserRepository
from app.modules.account.service import SeederConflictError, SeederService
from app.scripts.create_seeder import run
from tests.conftest import (
    BACKEND_DIR,
    TEST_DATABASE_URL,
    make_test_database_settings,
    make_test_settings,
)
from tests.factories.accounts import add_user, reload_user, sessions_of
from tests.support.browser import Browser

pytestmark = pytest.mark.integration

ADMIN = "admin@example.org"


def _fresh_password() -> str:
    return "Aa1" + secrets.token_urlsafe(12)


async def _run(
    tmp_path: Path, *args: str, stdin: str = "", secrets_typed: list[str] | None = None
) -> tuple[int, str]:
    out, err = io.StringIO(), io.StringIO()
    typed = iter(secrets_typed or [])
    code = await run(
        list(args),
        stdin=io.StringIO(stdin),
        stdout=out,
        stderr=err,
        settings=make_test_database_settings(tmp_path),
        read_secret=lambda prompt: next(typed),
        interactive=secrets_typed is not None,
    )
    return code, out.getvalue() + err.getvalue()


async def test_the_first_seeder_admin_is_created_and_can_sign_in(
    tmp_path: Path, account_db: AsyncSession, client: httpx.AsyncClient
) -> None:
    password = _fresh_password()

    code, output = await _run(
        tmp_path,
        "--email",
        " Admin@Example.org ",
        "--name",
        "管理員",
        "--password-stdin",
        stdin=password + "\n",
    )

    assert code == 0
    assert ADMIN in output
    seeder = await UserRepository(account_db).get_seeder()
    assert seeder is not None
    assert (seeder.email, seeder.name, seeder.role, seeder.is_active) == (
        ADMIN,
        "管理員",
        "super_admin",
        True,
    )
    assert seeder.hashed_password is not None
    assert password not in output and seeder.hashed_password not in output
    browser = Browser(client)
    assert (await browser.sign_in(ADMIN, password)).status_code == 201
    me = await browser.me()
    assert me.json()["data"]["user"]["role"] == "super_admin"
    assert "seeder" not in me.text.lower()


async def test_running_again_with_the_same_email_changes_nothing(
    tmp_path: Path, account_db: AsyncSession
) -> None:
    password = _fresh_password()
    args = ("--email", ADMIN, "--name", "管理員", "--password-stdin")
    assert (await _run(tmp_path, *args, stdin=password + "\n"))[0] == 0
    seeder = await UserRepository(account_db).get_seeder()
    assert seeder is not None
    stored = seeder.hashed_password

    code, _ = await _run(tmp_path, *args, stdin=_fresh_password() + "\n")

    assert code == 0
    assert await UserRepository(account_db).count() == 1
    assert (await reload_user(account_db, seeder.id)).hashed_password == stored


async def test_another_email_once_a_seeder_exists_fails(
    tmp_path: Path, account_db: AsyncSession
) -> None:
    await add_user(account_db, email=ADMIN, role="super_admin", is_seeder=True)

    code, _ = await _run(
        tmp_path,
        "--email",
        "second@example.org",
        "--name",
        "第二位",
        "--password-stdin",
        stdin=_fresh_password() + "\n",
    )

    assert code == 2
    assert await UserRepository(account_db).count() == 1


async def test_an_existing_account_is_never_promoted(
    tmp_path: Path, account_db: AsyncSession, client: httpx.AsyncClient
) -> None:
    user = await add_user(account_db, email="member@example.org")
    assert (await Browser(client).sign_in("member@example.org")).status_code == 201

    code, _ = await _run(
        tmp_path,
        "--email",
        "member@example.org",
        "--name",
        "成員",
        "--password-stdin",
        stdin=_fresh_password() + "\n",
    )

    assert code == 2
    after = await reload_user(account_db, user.id)
    assert (after.role, after.is_seeder, after.hashed_password) == (
        "user",
        False,
        user.hashed_password,
    )
    assert [row.revoked_at for row in await sessions_of(account_db, user.id)] == [None]


@pytest.mark.parametrize(
    ("args", "stdin"),
    [
        (("--email", ADMIN, "--name", "管理員", "--password-stdin"), "short1A\n"),
        (("--email", ADMIN, "--name", "管理員", "--password-stdin"), "alllowercase123\n"),
        (("--email", ADMIN, "--name", "管理員", "--password-stdin"), "\n"),
        (("--email", "a" * 250 + "@x.org", "--name", "管理員", "--password-stdin"), "Aa1bbbbbbb\n"),
        (("--email", "not-an-email", "--name", "管理員", "--password-stdin"), "Aa1bbbbbbb\n"),
        (("--email", ADMIN, "--name", "   ", "--password-stdin"), "Aa1bbbbbbb\n"),
        (("--email", ADMIN, "--name", "管理員"), "Aa1bbbbbbb\n"),
    ],
    ids=["too-short", "no-upper", "empty", "email-too-long", "bad-email", "blank-name", "no-tty"],
)
async def test_invalid_input_fails_without_writing(
    tmp_path: Path, account_db: AsyncSession, args: tuple[str, ...], stdin: str
) -> None:
    code, output = await _run(tmp_path, *args, stdin=stdin)

    assert code == 2
    assert await UserRepository(account_db).count() == 0
    assert stdin.strip() == "" or stdin.strip() not in output


async def test_the_interactive_prompt_asks_twice_and_needs_a_match(
    tmp_path: Path, account_db: AsyncSession
) -> None:
    args = ("--email", ADMIN, "--name", "管理員")

    mismatch, _ = await _run(tmp_path, *args, secrets_typed=["Aa1bbbbbbb", "Aa1ccccccc"])
    created, _ = await _run(tmp_path, *args, secrets_typed=["Aa1bbbbbbb", "Aa1bbbbbbb"])

    assert (mismatch, created) == (2, 0)
    seeder = await UserRepository(account_db).get_seeder()
    assert seeder is not None and seeder.hashed_password is not None
    assert await PasswordHasher().verify(seeder.hashed_password, "Aa1bbbbbbb")


async def test_a_password_option_does_not_exist(tmp_path: Path, account_db: AsyncSession) -> None:
    code, _ = await _run(tmp_path, "--email", ADMIN, "--name", "管理員", "--password", "Aa1bbbbbbb")

    assert code == 2
    assert await UserRepository(account_db).count() == 0


async def test_the_module_entry_point_runs_with_stdin(
    tmp_path: Path, account_db: AsyncSession
) -> None:
    password = _fresh_password()
    env = {k: v for k, v in os.environ.items() if k not in {"DATABASE_URL", "SQLITE_PATH"}}
    if TEST_DATABASE_URL is not None:
        env["DATABASE_URL"] = TEST_DATABASE_URL
    env["SQLITE_PATH"] = str(tmp_path / "test.db")

    done = await asyncio.to_thread(
        subprocess.run,
        [
            sys.executable,
            "-m",
            "app.scripts.create_seeder",
            "--email",
            ADMIN,
            "--name",
            "管理員",
            "--password-stdin",
        ],
        input=password + "\n",
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
        env=env,
        check=False,
        timeout=60,
    )  # fixed argv, no shell

    assert done.returncode == 0, done.stderr
    assert password not in done.stdout + done.stderr
    assert await UserRepository(account_db).get_seeder() is not None


def test_no_endpoint_creates_an_account(tmp_path: Path) -> None:
    # The production assembly, not the harness: test-only probe routes are not endpoints.
    paths = create_app(make_test_settings(tmp_path)).openapi()["paths"]

    assert not [path for path in paths if "user" in path or "seeder" in path]


async def test_a_seeder_created_in_between_makes_the_insert_fail_cleanly(
    account_db: AsyncSession,
) -> None:
    await add_user(account_db, email=ADMIN, role="super_admin", is_seeder=True)

    with pytest.raises(SeederConflictError):
        await SeederService(account_db).create("late@example.org", "晚到", _fresh_password())

    assert await UserRepository(account_db).count() == 1


async def test_password_stdin_from_a_terminal_is_refused(
    tmp_path: Path, account_db: AsyncSession
) -> None:
    code, output = await _run(
        tmp_path,
        "--email",
        ADMIN,
        "--name",
        "管理員",
        "--password-stdin",
        secrets_typed=["Aa1bbbbbbb", "Aa1bbbbbbb"],
    )

    assert code == 2
    assert "terminal" in output
    assert await UserRepository(account_db).count() == 0


@pytest.mark.parametrize(("length", "expected"), [(1024, 0), (1025, 2)])
async def test_the_password_has_the_same_1024_character_limit_as_sign_in(
    tmp_path: Path, account_db: AsyncSession, length: int, expected: int
) -> None:
    password = "Aa1" + "b" * (length - 3)

    code, output = await _run(
        tmp_path, "--email", ADMIN, "--name", "管理員", "--password-stdin", stdin=password + "\n"
    )

    assert code == expected
    assert password not in output
    assert await UserRepository(account_db).count() == (1 if expected == 0 else 0)
    if expected == 2:
        assert "1024" in output
