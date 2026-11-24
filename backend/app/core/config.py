"""The single settings entry point (backend-agent-rules B10).

Settings come only from environment variables (Hard Rule 8). They are split in
two layers so that migrations can run without app-only settings:

- ``DatabaseSettings`` holds ``DATABASE_URL`` and ``SQLITE_PATH`` and derives the
  async SQLAlchemy URL. Alembic's ``env.py`` reads only this class.
- ``Settings`` extends it with the CORS and API-docs settings the API needs.

Always build either class through ``load_settings`` so a validation failure turns
into a ``ConfigError`` that names the environment variable and the reason but
never echoes the configured value (security-agent-rules S9).
"""

from pathlib import Path
from typing import Annotated, Any
from urllib.parse import urlsplit

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, NoDecode

__all__ = ["ConfigError", "DatabaseSettings", "Settings", "load_settings"]

_ASYNC_POSTGRES_SCHEME = "postgresql+asyncpg"
_ACCEPTED_POSTGRES_SCHEMES = frozenset({"postgresql", "postgresql+asyncpg", "postgres"})
_ORIGIN_SCHEMES = frozenset({"http", "https"})


class ConfigError(Exception):
    """Raised when the environment does not form a valid configuration.

    The message holds one ``"<ENV_VAR>: <reason>"`` line per problem and never
    contains a configured value. It is a start-up and migration error only and is
    never turned into an HTTP response.
    """


class DatabaseSettings(BaseSettings):
    """Database settings shared by the API and the Alembic environment.

    Attributes:
        database_url: The production-tier PostgreSQL URL, normalised to the
            ``postgresql+asyncpg`` driver; ``None`` selects the Lite tier.
        sqlite_path: Absolute path of the Lite-tier SQLite file.
    """

    database_url: str | None = None
    sqlite_path: Path = Path("./data/label_suite.db")

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalise_database_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        scheme, separator, rest = value.partition("://")
        if not separator or scheme.lower() not in _ACCEPTED_POSTGRES_SCHEMES:
            raise ValueError(
                "unsupported scheme; only postgresql, postgresql+asyncpg and postgres are accepted"
            )
        return f"{_ASYNC_POSTGRES_SCHEME}://{rest}"

    @field_validator("sqlite_path", mode="after")
    @classmethod
    def _absolute_sqlite_path(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    def is_lite(self) -> bool:
        """Return whether the Lite tier (SQLite) is selected, i.e. no ``DATABASE_URL``."""
        return self.database_url is None

    def async_database_url(self) -> str:
        """Return the SQLAlchemy async URL for the selected tier.

        Returns:
            The normalised ``postgresql+asyncpg://`` URL when ``DATABASE_URL`` is
            set, otherwise ``sqlite+aiosqlite:///<absolute SQLITE_PATH>``.
        """
        if self.database_url is not None:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.sqlite_path}"


class Settings(DatabaseSettings):
    """Full API settings: the database layer plus CORS.

    Attributes:
        cors_allowed_origins: The explicit origin list (the only required
            setting); each item is ``http(s)://host[:port]`` without a path, and
            ``*`` is rejected (Hard Rule 7).
        cors_allow_credentials: Whether CORS responses allow credentials.
        api_docs_enabled: Whether the built-in ``/docs``, ``/docs/oauth2-redirect``,
            ``/redoc`` and ``/openapi.json`` routes are served; the production
            compose file pins it to false.
    """

    cors_allowed_origins: Annotated[list[str], NoDecode]
    cors_allow_credentials: bool = True
    api_docs_enabled: bool = True

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",")]
        elif isinstance(value, list | tuple):
            items = [str(item).strip() for item in value]
        else:
            raise ValueError("must be a comma-separated list of origins")
        origins = [item for item in items if item]
        if not origins:
            raise ValueError("must list at least one origin")
        if any("*" in origin for origin in origins):
            raise ValueError('must not contain "*"; list every origin explicitly')
        for origin in origins:
            if not _is_plain_origin(origin):
                raise ValueError("each origin must be http(s)://host[:port] without a path")
        return origins


def _is_plain_origin(origin: str) -> bool:
    """Return whether ``origin`` is ``http(s)://host[:port]`` with nothing else."""
    try:
        parts = urlsplit(origin)
        _ = parts.port  # raises ValueError for a non-numeric or out-of-range port
    except ValueError:
        return False
    return (
        parts.scheme in _ORIGIN_SCHEMES
        and bool(parts.hostname)
        and parts.username is None
        and parts.password is None
        and parts.path == ""
        and parts.query == ""
        and parts.fragment == ""
        and not origin.endswith(("?", "#"))
    )


def load_settings[SettingsT: DatabaseSettings](cls: type[SettingsT]) -> SettingsT:
    """Build ``cls`` from the environment, hiding values from any error.

    Args:
        cls: ``DatabaseSettings`` or a subclass such as ``Settings``.

    Returns:
        The validated settings instance.

    Raises:
        ConfigError: When validation fails. The message has one
            ``"<ENV_VAR>: <reason>"`` line per error, where ``<ENV_VAR>`` is the
            upper-cased field name (there is no env prefix), and contains no
            configured value. The original ``ValidationError`` is suppressed
            (``from None``) because its text and traceback include the input.
    """
    try:
        return cls()
    except ValidationError as exc:
        lines = []
        for error in exc.errors(include_input=False, include_url=False):
            loc = error["loc"]
            name = str(loc[0]).upper() if loc else "CONFIGURATION"
            lines.append(f"{name}: {error['msg']}")
        raise ConfigError("\n".join(lines)) from None
