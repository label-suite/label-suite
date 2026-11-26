"""Shared helpers for the account tests: create accounts and read back persisted state.

Accounts are written through the ORM with a real argon2id hash, the same way the
Seeder command writes one; nothing here bypasses a security check of the API.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.passwords import PasswordHasher
from app.modules.account.models import AccountRefreshToken, AccountSession, User

PLAIN = "Correct-Horse-7"
"""The password every test account gets unless a test says otherwise."""


async def add_user(
    db: AsyncSession,
    *,
    email: str = "user@example.com",
    name: str = "王小明",
    plain: str | None = PLAIN,
    role: str = "user",
    is_active: bool = True,
    anonymized: bool = False,
    google_subject: str | None = None,
    is_seeder: bool = False,
) -> User:
    """Insert and commit an account; ``plain=None`` leaves it without a local password."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        name=name,
        hashed_password=None if plain is None else await PasswordHasher().hash(plain),
        role=role,
        is_active=is_active,
        anonymized_at=datetime.now(UTC) if anonymized else None,
        google_subject=google_subject,
        is_seeder=is_seeder,
    )
    db.add(user)
    await db.commit()
    return user


async def sessions_of(db: AsyncSession, user_id: uuid.UUID) -> list[AccountSession]:
    """Return the account's login sessions, freshly read, oldest first."""
    result = await db.execute(
        select(AccountSession)
        .where(AccountSession.user_id == user_id)
        .order_by(AccountSession.started_at)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars())


async def tokens_of(db: AsyncSession, session_id: uuid.UUID) -> list[AccountRefreshToken]:
    """Return the session's refresh tokens, freshly read, oldest first."""
    result = await db.execute(
        select(AccountRefreshToken)
        .where(AccountRefreshToken.session_id == session_id)
        .order_by(AccountRefreshToken.issued_at)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars())


async def reload_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Return the account, freshly read."""
    result = await db.execute(
        select(User).where(User.id == user_id).execution_options(populate_existing=True)
    )
    return result.scalar_one()
