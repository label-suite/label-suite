"""Arrange account state for the e2e journeys directly in this run's database.

The journeys need accounts the platform cannot create yet (a platform member, a
deactivated account, one without a local password) and sessions that have aged
past a limit. There is no endpoint for either until user management lands, so
this helper writes the rows the same way the backend's own test factories do:
through the ORM, with a real argon2id hash. It never mints a token or a cookie;
every journey still signs in through the real sign-in page or endpoint.

Run from ``backend/`` with ``uv run python <this file> <command> ...`` and the
run's ``SQLITE_PATH`` (or ``DATABASE_URL``) in the environment, as the Seeder
setup does. Passwords are read from standard input, never from an argument.
Output is one JSON document on standard output.
"""

import argparse
import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import DatabaseSettings, load_settings
from app.core.db import create_engine
from app.core.email_identity import normalize_email
from app.core.passwords import PasswordHasher
from app.modules.account.models import AccountSession, User


async def _user_id(db: AsyncSession, email: str) -> uuid.UUID:
    found = await db.scalar(select(User.id).where(User.email == normalize_email(email)))
    if found is None:
        raise SystemExit(f"no account with that Email: {email}")
    return found


async def _add(db: AsyncSession, args: argparse.Namespace) -> object:
    plain = None if args.no_local_password else sys.stdin.readline().rstrip("\n")
    user = User(
        id=uuid.uuid4(),
        email=normalize_email(args.email),
        name=args.name,
        hashed_password=None if plain is None else await PasswordHasher().hash(plain),
        role=args.role,
        is_active=not args.inactive,
        anonymized_at=datetime.now(UTC) if args.anonymized else None,
        google_subject=args.google_subject,
        is_seeder=False,
    )
    db.add(user)
    await db.commit()
    return {"id": str(user.id)}


async def _set(db: AsyncSession, args: argparse.Namespace) -> object:
    user_id = await _user_id(db, args.email)
    values: dict[str, object] = {}
    if args.active is not None:
        values["is_active"] = args.active == "true"
    if args.role is not None:
        values["role"] = args.role
    if args.bump_credential_version:
        values["credential_version"] = User.credential_version + 1
    await db.execute(update(User).where(User.id == user_id).values(**values))
    if args.revoke_sessions:
        await db.execute(
            update(AccountSession)
            .where(AccountSession.user_id == user_id, AccountSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
    await db.commit()
    return {"updated": sorted(values) + (["sessions"] if args.revoke_sessions else [])}


async def _age(db: AsyncSession, args: argparse.Namespace) -> object:
    """Move the account's sessions into the past (started and last seen)."""
    user_id = await _user_id(db, args.email)
    started = timedelta(days=args.started_days_ago)
    seen = timedelta(days=args.seen_days_ago, minutes=args.seen_extra_minutes)
    now = datetime.now(UTC)
    await db.execute(
        update(AccountSession)
        .where(AccountSession.user_id == user_id)
        .values(started_at=now - started, last_seen_at=now - seen)
    )
    await db.commit()
    return {"aged": True}


async def _sessions(db: AsyncSession, args: argparse.Namespace) -> object:
    user_id = await _user_id(db, args.email)
    rows = await db.scalars(
        select(AccountSession)
        .where(AccountSession.user_id == user_id)
        .order_by(AccountSession.started_at)
    )

    def stamp(value: datetime | None) -> str | None:
        return None if value is None else value.isoformat()

    return [
        {
            "id": str(row.id),
            "startedAt": stamp(row.started_at),
            "revokedAt": stamp(row.revoked_at),
            "loggedOutAt": stamp(row.logged_out_at),
        }
        for row in rows
    ]


async def _count(db: AsyncSession, _args: argparse.Namespace) -> object:
    return {"users": await db.scalar(select(func.count()).select_from(User))}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    add = commands.add_parser("add", help="add an account; the password comes on stdin")
    add.add_argument("--email", required=True)
    add.add_argument("--name", required=True)
    add.add_argument("--role", choices=["user", "super_admin"], default="user")
    add.add_argument("--inactive", action="store_true")
    add.add_argument("--anonymized", action="store_true")
    add.add_argument("--no-local-password", action="store_true")
    add.add_argument("--google-subject")
    add.set_defaults(run=_add)

    change = commands.add_parser("set", help="change an account")
    change.add_argument("--email", required=True)
    change.add_argument("--active", choices=["true", "false"])
    change.add_argument("--role", choices=["user", "super_admin"])
    change.add_argument("--bump-credential-version", action="store_true")
    change.add_argument("--revoke-sessions", action="store_true")
    change.set_defaults(run=_set)

    age = commands.add_parser("age", help="move the account's sessions into the past")
    age.add_argument("--email", required=True)
    age.add_argument("--started-days-ago", type=int, required=True)
    age.add_argument("--seen-days-ago", type=int, required=True)
    age.add_argument("--seen-extra-minutes", type=int, default=0)
    age.set_defaults(run=_age)

    sessions = commands.add_parser("sessions", help="list the account's sessions")
    sessions.add_argument("--email", required=True)
    sessions.set_defaults(run=_sessions)

    count = commands.add_parser("count", help="count the accounts")
    count.set_defaults(run=_count)
    return parser


async def _main(args: argparse.Namespace) -> object:
    engine = create_engine(load_settings(DatabaseSettings))
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            return await args.run(db, args)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(_main(_parser().parse_args()))))
