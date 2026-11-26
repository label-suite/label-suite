"""Where ``AUTH_SECRET`` comes from (login-auth-guard system-design §AUTH_SECRET 的來源).

An explicit ``AUTH_SECRET`` is used on both tiers. Without one, the production tier
(``DATABASE_URL`` set) refuses to start, and the Lite tier reads, or on first start
generates, the file ``auth_secret`` next to the SQLite file, which in a container is the
named data volume. The secret is never logged: the log names only the source and the path,
never the value, its length or a hash of it (Hard Rule 8, security-agent-rules S9).
"""

import contextlib
import logging
import os
import secrets
import stat
from pathlib import Path

from pydantic import SecretStr

from app.core.config import AUTH_SECRET_MIN_LENGTH, ConfigError, Settings

__all__ = ["SECRET_FILE_NAME", "resolve_auth_secret"]

SECRET_FILE_NAME = "auth_secret"  # noqa: S105 - a file name, not a secret
"""The Lite-tier secret file, in the directory of ``SQLITE_PATH``."""

_FILE_MODE = 0o600
_GENERATED_BYTES = 48  # token_urlsafe(48) is 64 characters

logger = logging.getLogger(__name__)


def resolve_auth_secret(settings: Settings) -> SecretStr:
    """Return the secret the API signs its tokens with.

    Args:
        settings: The loaded settings; ``settings.auth_secret`` is ``AUTH_SECRET``
            (already checked to be at least 32 characters) or ``None``.

    Returns:
        ``settings.auth_secret`` when it is set. Otherwise, on the Lite tier, the
        content of ``<directory of SQLITE_PATH>/auth_secret``.

    Side effects:
        Lite tier without ``AUTH_SECRET`` only: creates the directory of
        ``SQLITE_PATH`` when missing; creates ``auth_secret`` with mode ``0600`` when
        missing (several processes starting together still end up with one secret,
        because the file is put in place with ``os.link``, which never overwrites);
        tightens a stored file whose mode is wider than ``0600`` and logs a WARNING;
        logs one INFO line naming the source and the path.

    Raises:
        ConfigError: When the production tier has no ``AUTH_SECRET``, or when the
            stored Lite-tier file holds fewer than 32 characters. The message names
            ``AUTH_SECRET`` and never contains the secret.
    """
    if settings.auth_secret is not None:
        return settings.auth_secret
    if not settings.is_lite():
        raise ConfigError("AUTH_SECRET: required when DATABASE_URL is set")

    path = settings.sqlite_path.parent / SECRET_FILE_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() and _create(path):
        logger.info("AUTH_SECRET not set; generated a new secret at %s", path)
    else:
        logger.info("AUTH_SECRET not set; using the secret stored at %s", path)
    return _read(path)


def _create(path: Path) -> bool:
    """Write a new secret to ``path`` unless another process got there first.

    Returns:
        ``True`` when this call created ``path``; ``False`` when it already existed.
    """
    temp = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, _FILE_MODE)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(secrets.token_urlsafe(_GENERATED_BYTES))
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, _FILE_MODE)  # the umask may have removed bits; never adds any
        try:
            os.link(temp, path)
        except FileExistsError:
            return False
        return True
    finally:
        with contextlib.suppress(FileNotFoundError):
            temp.unlink()


def _read(path: Path) -> SecretStr:
    """Return the secret stored at ``path``, tightening its mode to ``0600`` first."""
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & ~_FILE_MODE:
        path.chmod(_FILE_MODE)
        logger.warning(
            "AUTH_SECRET file %s was readable by others; its mode was changed to 0600", path
        )
    value = path.read_text(encoding="utf-8").strip()
    if len(value) < AUTH_SECRET_MIN_LENGTH:
        raise ConfigError(
            f"AUTH_SECRET: the secret stored at {path} is not valid; "
            "delete the file to generate a new one, or set AUTH_SECRET"
        )
    return SecretStr(value)
