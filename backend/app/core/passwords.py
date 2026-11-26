"""Password hashing with argon2id (login-auth-guard system-design T6).

Hashing and verifying take tens of milliseconds of CPU, so both run in a worker thread
instead of blocking the event loop. ``verify_dummy`` does one full verification against a
stand-in hash, so a login for an account that does not exist costs as much as one that
does, and the response time does not reveal which.
"""

import asyncio
import functools
import secrets

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

__all__ = ["PasswordHasher"]


@functools.cache
def _argon2() -> Argon2Hasher:
    """Return the shared argon2id hasher with the library's RFC 9106 defaults."""
    return Argon2Hasher()


@functools.cache
def _dummy_hash() -> str:
    """Return a hash of a random value nobody knows, made once per process."""
    return _argon2().hash(secrets.token_urlsafe(32))


def _verify(stored: str, attempt: str) -> bool:
    try:
        return _argon2().verify(stored, attempt)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


class PasswordHasher:
    """Hash and verify passwords with argon2id, off the event loop.

    Stateless; the argon2 parameters are the library defaults (argon2id, RFC 9106 low
    memory profile).
    """

    async def hash(self, raw: str) -> str:
        """Return the argon2id hash of ``raw``, with a fresh random salt.

        Side effects:
            Runs in a worker thread.
        """
        return await asyncio.to_thread(_argon2().hash, raw)

    async def verify(self, hashed: str, raw: str) -> bool:
        """Return whether ``raw`` matches ``hashed``.

        A malformed or non-argon2 ``hashed`` gives ``False``, never an exception.

        Side effects:
            Runs in a worker thread.
        """
        return await asyncio.to_thread(_verify, hashed, raw)

    async def verify_dummy(self, raw: str) -> None:
        """Spend one full verification of ``raw`` against a stand-in hash and discard it.

        Call it where an account was not found (or has no local password), so the
        failure takes as long as a wrong password would (system-design T6).

        Side effects:
            Runs in a worker thread; the first call in a process also creates the
            stand-in hash.
        """
        await asyncio.to_thread(_verify, await asyncio.to_thread(_dummy_hash), raw)
