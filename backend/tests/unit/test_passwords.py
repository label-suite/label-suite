"""Unit tests for ``app.core.passwords`` (login-auth-guard task 3.1, system-design T6).

The hash is argon2id, verification runs off the event loop, and a login for an account
that does not exist still pays for one full verification, so the response time does not
tell whether the account exists.
"""

import secrets
import threading

import pytest
from argon2 import PasswordHasher as Argon2Hasher

from app.core.passwords import PasswordHasher

PLAIN = "Correct-Horse-7"


async def test_hash_is_argon2id_and_never_contains_the_input() -> None:
    hashed = await PasswordHasher().hash(PLAIN)

    assert hashed.startswith("$argon2id$")
    assert PLAIN not in hashed


async def test_hashing_the_same_input_twice_gives_different_salts() -> None:
    hasher = PasswordHasher()

    assert await hasher.hash(PLAIN) != await hasher.hash(PLAIN)


async def test_verify_accepts_the_matching_input() -> None:
    hasher = PasswordHasher()

    assert await hasher.verify(await hasher.hash(PLAIN), PLAIN) is True


@pytest.mark.parametrize("attempt", ["correct-horse-7", "Correct-Horse-7 ", "", "x" * 200])
async def test_verify_rejects_any_other_input(attempt: str) -> None:
    hasher = PasswordHasher()

    assert await hasher.verify(await hasher.hash(PLAIN), attempt) is False


@pytest.mark.parametrize("stored", ["", "not-a-hash", "$argon2id$v=19$broken", "$2b$12$abc"])
async def test_verify_against_a_malformed_hash_is_false_not_an_error(stored: str) -> None:
    assert await PasswordHasher().verify(stored, PLAIN) is False


async def test_verify_runs_off_the_event_loop_thread(monkeypatch: pytest.MonkeyPatch) -> None:
    hasher = PasswordHasher()
    hashed = await hasher.hash(PLAIN)
    seen: list[int] = []
    original = Argon2Hasher.verify

    def spy(self: Argon2Hasher, stored: str | bytes, attempt: str | bytes) -> bool:
        seen.append(threading.get_ident())
        return original(self, stored, attempt)

    monkeypatch.setattr(Argon2Hasher, "verify", spy)

    await hasher.verify(hashed, PLAIN)

    assert seen
    assert threading.get_ident() not in seen


async def test_verify_dummy_runs_one_full_argon2_verification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    hasher = PasswordHasher()
    await hasher.verify_dummy(PLAIN)  # warm the stand-in hash outside the count
    calls: list[str] = []
    original = Argon2Hasher.verify

    def spy(self: Argon2Hasher, stored: str | bytes, attempt: str | bytes) -> bool:
        calls.append(str(stored))
        return original(self, stored, attempt)

    monkeypatch.setattr(Argon2Hasher, "verify", spy)

    result = await hasher.verify_dummy(secrets.token_urlsafe(12))

    assert result is None
    assert len(calls) == 1
    assert calls[0].startswith("$argon2id$")
