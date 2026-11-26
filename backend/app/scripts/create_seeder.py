"""Create the first Seeder admin (system-design §Seeder 初始化指令, design D6).

Run it from ``backend/`` after ``alembic upgrade head``::

    uv run python -m app.scripts.create_seeder --email <Email> --name <display name>

The password is asked twice without echo. For automation, add ``--password-stdin`` and
pipe one line. There is no password option and no password environment variable, so it
never lands in shell history, ``ps`` or ``docker inspect``, and there is no default.
The command reads only the database settings (``DATABASE_URL`` or ``SQLITE_PATH``).

``--password-stdin`` is refused when standard input is a terminal, where the password
would be echoed. A password longer than 1024 characters, the most sign-in accepts, is
refused too.

Exit codes: ``0`` created, or the Seeder admin already has this Email (nothing
changed, no password asked); ``2`` refused or invalid input, nothing written. No output
contains the password or its hash.
"""

import argparse
import asyncio
import getpass
import re
import sys
from collections.abc import Callable, Sequence
from typing import TextIO

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import ConfigError, DatabaseSettings, load_settings
from app.core.db import create_engine
from app.core.email_identity import EmailTooLongError, normalize_email
from app.modules.account.service import (
    MAX_PASSWORD_LENGTH,
    SeederCheck,
    SeederConflictError,
    SeederService,
    password_meets_policy,
)

__all__ = ["main", "run"]

EXIT_OK = 0
EXIT_REFUSED = 2
_NAME_LIMIT = 100
_EMAIL_SHAPE = re.compile(r"[^@\s]+@[^@\s]+")
_REFUSALS = {
    SeederCheck.OTHER_SEEDER: "another Seeder admin already exists; nothing was changed",
    SeederCheck.EMAIL_TAKEN: (
        "an account with this Email already exists; initialisation only creates a new "
        "account and never promotes one"
    ),
}


class _Refused(Exception):
    """Invalid input or a refused request; the message is safe to print."""


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        raise _Refused(message)


def _parse(argv: Sequence[str]) -> argparse.Namespace:
    parser = _Parser(prog="create_seeder", description="Create the first Seeder admin.")
    parser.add_argument("--email", required=True, help="the Seeder admin's Email")
    parser.add_argument("--name", required=True, help="the display name, 1 to 100 characters")
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="read the password as one line from standard input instead of asking",
    )
    return parser.parse_args(argv)


def _identity(args: argparse.Namespace) -> tuple[str, str]:
    try:
        email = normalize_email(args.email)
    except EmailTooLongError:
        raise _Refused("the Email is longer than 254 characters") from None
    if not _EMAIL_SHAPE.fullmatch(email):
        raise _Refused("the Email is not an Email address")
    name = args.name.strip()
    if not 1 <= len(name) <= _NAME_LIMIT:
        raise _Refused("the name must be 1 to 100 characters")
    return email, name


def _password(
    from_stdin: bool,
    stdin: TextIO,
    read_secret: Callable[[str], str],
    interactive: bool,
) -> str:
    if from_stdin:
        raw = stdin.readline().removesuffix("\n").removesuffix("\r")
    elif interactive:
        raw = read_secret("Password (not shown) > ")
        if read_secret("Type it again > ") != raw:
            raise _Refused("the two passwords differ")
    else:
        raise _Refused("standard input is not a terminal; pass --password-stdin")
    if len(raw) > MAX_PASSWORD_LENGTH:
        raise _Refused(
            f"the password is longer than {MAX_PASSWORD_LENGTH} characters, "
            "the most sign-in accepts"
        )
    if not password_meets_policy(raw):
        raise _Refused(
            "the password needs at least 8 characters with an upper-case letter, "
            "a lower-case letter and a digit"
        )
    return raw


async def run(
    argv: Sequence[str],
    *,
    stdin: TextIO,
    stdout: TextIO,
    stderr: TextIO,
    settings: DatabaseSettings | None = None,
    read_secret: Callable[[str], str] = getpass.getpass,
    interactive: bool | None = None,
) -> int:
    """Run the command and return its exit code.

    Args:
        argv: The arguments after the program name.
        stdin: Where ``--password-stdin`` reads from.
        stdout: Where the result line goes.
        stderr: Where a refusal goes.
        settings: The database settings; read from the environment when ``None``.
        read_secret: Asks for the password without echo.
        interactive: Whether ``stdin`` is a terminal; detected when ``None``.

    Side effects:
        Opens its own engine and one session, and disposes the engine at the end;
        inserts the Seeder admin when allowed.
    """
    tty = stdin.isatty() if interactive is None else interactive
    try:
        args = _parse(argv)
        if args.password_stdin and tty:
            # A terminal would echo the password as it is typed; ask instead.
            raise _Refused(
                "--password-stdin reads a pipe, but standard input is a terminal; "
                "leave the option out to be asked without echo"
            )
        email, name = _identity(args)
        database = settings if settings is not None else load_settings(DatabaseSettings)
    except (_Refused, ConfigError) as exc:
        print(f"create_seeder: {exc}", file=stderr)
        return EXIT_REFUSED
    engine = create_engine(database)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = SeederService(db)
            check = await service.find_existing(email)
            if check is SeederCheck.UNCHANGED:
                print(f"The Seeder admin {email} already exists; nothing was changed.", file=stdout)
                return EXIT_OK
            if check in _REFUSALS:
                raise _Refused(_REFUSALS[check])
            password = _password(args.password_stdin, stdin, read_secret, tty)
            await service.create(email, name, password)
    except (_Refused, SeederConflictError) as exc:
        reason = str(exc) or "another Seeder admin or an account with this Email exists"
        print(f"create_seeder: {reason}", file=stderr)
        return EXIT_REFUSED
    finally:
        await engine.dispose()
    print(f"Created the Seeder admin {email}.", file=stdout)
    return EXIT_OK


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point of ``python -m app.scripts.create_seeder``."""
    return asyncio.run(
        run(
            sys.argv[1:] if argv is None else argv,
            stdin=sys.stdin,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
    )


if __name__ == "__main__":
    sys.exit(main())
