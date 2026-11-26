"""Creating the first Seeder admin (main spec ``user-management``, spec 06-01).

Only the initialisation command calls this; no endpoint can create an account. The
command is idempotent for the same Email and refuses everything else, so it never
promotes an existing account and never creates a second Seeder admin.
"""

import enum
import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.passwords import PasswordHasher
from app.modules.account.models import User
from app.modules.account.repository import UserRepository

__all__ = [
    "MAX_PASSWORD_LENGTH",
    "SeederCheck",
    "SeederConflictError",
    "SeederService",
    "password_meets_policy",
]

_MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 1024
"""The longest password accepted; the same limit as ``LoginRequest.password``."""


def password_meets_policy(raw: str) -> bool:
    """Return whether ``raw`` meets the account password rule (spec 01-02 Q5).

    At least 8 characters with an upper-case letter, a lower-case letter and a digit.
    """
    return (
        len(raw) >= _MIN_PASSWORD_LENGTH
        and re.search(r"[A-Z]", raw) is not None
        and re.search(r"[a-z]", raw) is not None
        and re.search(r"[0-9]", raw) is not None
    )


class SeederCheck(enum.Enum):
    """What the command may do for a given Email."""

    CREATE = "create"
    """No Seeder admin and no account with this Email: create one."""
    UNCHANGED = "unchanged"
    """The Seeder admin already has this Email: nothing to do."""
    OTHER_SEEDER = "other_seeder"
    """A Seeder admin with another Email exists: refuse."""
    EMAIL_TAKEN = "email_taken"
    """A regular account has this Email: refuse, never promote it."""


class SeederConflictError(Exception):
    """Another Seeder admin or an account with this Email appeared in the meantime."""


class SeederService:
    """Checks and creates the Seeder admin; owns the creation transaction.

    Args:
        db: The command's session.
        hasher: Hashes the password; a default ``PasswordHasher`` when omitted.
    """

    def __init__(self, db: AsyncSession, hasher: PasswordHasher | None = None) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._hasher = hasher or PasswordHasher()

    async def find_existing(self, normalized_email: str) -> SeederCheck:
        """Decide what the command may do for the already-normalised Email. Reads only."""
        seeder = await self._users.get_seeder()
        if seeder is not None:
            if seeder.email == normalized_email:
                return SeederCheck.UNCHANGED
            return SeederCheck.OTHER_SEEDER
        if await self._users.get_by_email(normalized_email) is not None:
            return SeederCheck.EMAIL_TAKEN
        return SeederCheck.CREATE

    async def create(self, normalized_email: str, name: str, password: str) -> User:
        """Create the active ``super_admin`` Seeder account in one transaction.

        Side effects:
            Inserts one ``users`` row and commits; rolls back on a conflict.

        Raises:
            SeederConflictError: The partial unique index (one Seeder) or the Email
                uniqueness rejected the insert, e.g. two runs at once.
        """
        user = User(
            id=uuid.uuid4(),
            email=normalized_email,
            name=name,
            hashed_password=await self._hasher.hash(password),
            role="super_admin",
            is_active=True,
            is_seeder=True,
        )
        self._users.add(user)
        try:
            await self._db.commit()
        except IntegrityError:
            await self._db.rollback()
            raise SeederConflictError from None
        return user
