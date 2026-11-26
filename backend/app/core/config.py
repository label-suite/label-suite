"""The single settings entry point (backend-agent-rules B10).

Settings come only from environment variables (Hard Rule 8). They are split in
two layers so that migrations can run without app-only settings:

- ``DatabaseSettings`` holds ``DATABASE_URL`` and ``SQLITE_PATH`` and derives the
  async SQLAlchemy URL. Alembic's ``env.py`` reads only this class.
- ``Settings`` extends it with the CORS, API-docs, log-level and login settings
  the API needs (``AUTH_SECRET``, the three ``GOOGLE_*`` and ``RESEND_API_KEY``).
  An empty string counts as unset for the login settings, because Compose passes
  an unset ``${VAR:-}`` as an empty string (login-auth-guard design D4).

Always build either class through ``load_settings`` so a validation failure turns
into a ``ConfigError`` that names the environment variable and the reason but
never echoes the configured value (security-agent-rules S9).
"""

import ipaddress
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode

__all__ = ["ConfigError", "DatabaseSettings", "LogLevel", "Settings", "load_settings"]

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
"""The accepted ``LOG_LEVEL`` values, upper case (clarification Q12)."""

_ASYNC_POSTGRES_SCHEME = "postgresql+asyncpg"
_ACCEPTED_POSTGRES_SCHEMES = frozenset({"postgresql", "postgresql+asyncpg", "postgres"})
_ORIGIN_SCHEMES = frozenset({"http", "https"})
AUTH_SECRET_MIN_LENGTH = 32
"""The shortest accepted ``AUTH_SECRET``, in characters (login-auth-guard system-design)."""
_GOOGLE_FIELDS = ("google_client_id", "google_client_secret", "google_redirect_uri")


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
    """Full API settings: the database layer plus CORS, API docs, log level and login.

    Attributes:
        cors_allowed_origins: The explicit origin list (the only required
            setting); each item is ``http(s)://host[:port]`` without a path, and
            ``*`` is rejected (Hard Rule 7).
        cors_allow_credentials: Whether CORS responses allow credentials.
        api_docs_enabled: Whether the built-in ``/docs``, ``/docs/oauth2-redirect``,
            ``/redoc`` and ``/openapi.json`` routes are served; the production
            compose file pins it to false.
        log_level: The lowest level the whole backend writes, from
            ``LOG_LEVEL``; case-insensitive, normalised to upper case and
            ``INFO`` by default. The database engine, pool and driver loggers do
            not follow it (``configure_logging`` pins them to ``WARNING``), and
            ``DatabaseSettings`` (Alembic) never reads it.
        forwarded_allow_ips: The proxy addresses uvicorn trusts for
            ``X-Forwarded-For`` and ``X-Forwarded-Proto``, from
            ``FORWARDED_ALLOW_IPS``: a comma-separated list of single IP addresses or
            CIDR networks, trimmed, ``["127.0.0.1", "::1"]`` by default. The backend
            only validates it; uvicorn reads the same variable and does the matching.
            ``*``, a zero-length prefix, host bits, hostnames, empty items and an
            empty list are rejected because uvicorn would trust everyone or drop them
            silently.
        auth_secret: ``AUTH_SECRET``, at least 32 characters; ``None`` when unset or
            empty. ``create_app`` replaces ``None`` with the value
            ``resolve_auth_secret`` returns (generated on the Lite tier, required on
            the production tier), so after start-up it is always set.
        google_client_id: ``GOOGLE_CLIENT_ID``; ``None`` when unset or empty.
        google_client_secret: ``GOOGLE_CLIENT_SECRET``; ``None`` when unset or empty.
        google_redirect_uri: ``GOOGLE_REDIRECT_URI``; ``None`` when unset or empty.
            The three Google settings are set together or not at all; a partial set
            is rejected, naming each missing variable.
        resend_api_key: ``RESEND_API_KEY``; ``None`` when unset or empty. Only
            whether it is set matters today (``mail_configured``).
    """

    cors_allowed_origins: Annotated[list[str], NoDecode]
    cors_allow_credentials: bool = True
    api_docs_enabled: bool = True
    log_level: LogLevel = "INFO"
    forwarded_allow_ips: Annotated[list[str], NoDecode] = ["127.0.0.1", "::1"]  # noqa: RUF012
    auth_secret: SecretStr | None = None
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str | None = None
    resend_api_key: SecretStr | None = None

    @field_validator(
        "auth_secret",
        "google_client_id",
        "google_client_secret",
        "google_redirect_uri",
        "resend_api_key",
        mode="before",
    )
    @classmethod
    def _empty_is_unset(cls, value: Any) -> Any:
        if isinstance(value, str) and value == "":
            return None
        if isinstance(value, SecretStr) and value.get_secret_value() == "":
            return None
        return value

    @field_validator("auth_secret", mode="after")
    @classmethod
    def _long_enough_auth_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and len(value.get_secret_value()) < AUTH_SECRET_MIN_LENGTH:
            raise ValueError(f"must be at least {AUTH_SECRET_MIN_LENGTH} characters")
        return value

    @model_validator(mode="after")
    def _google_all_or_nothing(self) -> "Settings":
        missing = [name for name in _GOOGLE_FIELDS if getattr(self, name) is None]
        if 0 < len(missing) < len(_GOOGLE_FIELDS):
            raise ValueError(
                "\n".join(
                    f"{name.upper()}: required when any Google setting is set; set "
                    "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI "
                    "together, or none of them"
                    for name in missing
                )
            )
        return self

    def google_configured(self) -> bool:
        """Return whether this deployment has Google sign-in configured (all three set)."""
        return all(getattr(self, name) is not None for name in _GOOGLE_FIELDS)

    def mail_configured(self) -> bool:
        """Return whether this deployment has a mail service, i.e. ``RESEND_API_KEY`` is set."""
        return self.resend_api_key is not None

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_case_log_level(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.upper()
        return value

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

    @field_validator("forwarded_allow_ips", mode="before")
    @classmethod
    def _parse_forwarded_allow_ips(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",")]
        elif isinstance(value, list | tuple):
            items = [str(item).strip() for item in value]
        else:
            raise ValueError("must be a comma-separated list of IP addresses or networks")
        if not items or items == [""]:
            raise ValueError("must list at least one IP address or network")
        for item in items:
            if not _is_trusted_proxy_entry(item):
                raise ValueError(
                    "each item must be a single IP address or a CIDR network with no host "
                    "bits set and a non-zero prefix length; "
                    '"*", hostnames and empty items are not accepted'
                )
        return items


def _is_trusted_proxy_entry(item: str) -> bool:
    """Return whether ``item`` is a single IP address or a strict, non-zero-prefix network."""
    try:
        if "/" not in item:
            ipaddress.ip_address(item)
            return True
        return ipaddress.ip_network(item, strict=True).prefixlen > 0
    except ValueError:
        return False


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
            if loc:
                lines.append(f"{str(loc[0]).upper()}: {error['msg']}")
            elif error["type"] == "value_error" and "ctx" in error:
                # A whole-model check (the Google all-or-nothing rule) already writes
                # one "<ENV_VAR>: <reason>" line per problem.
                lines.append(str(error["ctx"]["error"]))
            else:
                lines.append(f"CONFIGURATION: {error['msg']}")
        raise ConfigError("\n".join(lines)) from None
