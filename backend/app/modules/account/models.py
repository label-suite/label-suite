"""ORM models of the ``account`` table group (data-table-dictionary §二).

Three tables land here: ``users``, ``account_session`` and
``account_refresh_token``. Columns, nullability and constraints follow the
dictionary; constraint names come from ``NAMING_CONVENTION`` so SQLite and
PostgreSQL carry the same names.

Accounts are never deleted (PRD: only deactivation and reactivation), so there is
no soft-delete column and ``account_session.user_id`` restricts deletion. No row is
written by a migration: the first account comes from the Seeder initialisation
command (capability ``user-management``).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime

__all__ = [
    "SYSTEM_ROLES",
    "AccountRefreshToken",
    "AccountSession",
    "User",
]

SYSTEM_ROLES: tuple[str, ...] = ("user", "super_admin")
"""Allowed values of ``users.role``: platform member and system admin (spec 01-05).

The ``ck_users_role_allowed`` constraint lists the same values; changing one
without the other needs a new migration.
"""


def _utc_now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    """A platform account that can sign in (``users``).

    Accounts have no delete path: they are deactivated, or anonymised in place on a
    deletion request (ADR-008 D7). ``hashed_password``, ``google_subject`` and
    ``credential_version`` are read only by the authentication flow and never
    returned in any response.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 100", name="name_length"),
        CheckConstraint("length(contact_info) <= 255", name="contact_info_length"),
        CheckConstraint(
            "role IN (" + ", ".join(f"'{role}'" for role in SYSTEM_ROLES) + ")",
            name="role_allowed",
        ),
        CheckConstraint("credential_version >= 0", name="credential_version_non_negative"),
        Index(
            None,
            "is_seeder",
            unique=True,
            postgresql_where=text("is_seeder"),
            sqlite_where=text("is_seeder"),
        ),
        {"comment": "Platform accounts; never deleted, only deactivated or anonymised."},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, comment="Internal account identifier."
    )
    email: Mapped[str] = mapped_column(
        String(254),
        unique=True,
        comment="Sign-in and mail address, stored already normalised (NFKC + casefold).",
    )
    name: Mapped[str] = mapped_column(
        String(100), comment="Display name, 1 to 100 characters; may repeat across accounts."
    )
    contact_info: Mapped[str] = mapped_column(
        String(255),
        server_default="",
        default="",
        comment="Contact details the user entered; empty string when left blank.",
    )
    avatar_url: Mapped[str | None] = mapped_column(
        Text, comment="Location of the uploaded avatar; NULL shows the default avatar."
    )
    hashed_password: Mapped[str | None] = mapped_column(
        String, comment="Password hash; NULL means no local password (Google sign-in only)."
    )
    role: Mapped[str] = mapped_column(
        String, comment="Platform-level role: 'user' or 'super_admin'."
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, comment="Whether the account may sign in; deactivation ends every session."
    )
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=_utc_now, comment="When the account was created (UTC); immutable."
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        default=_utc_now,
        onupdate=_utc_now,
        comment="When the account was last changed (UTC).",
    )
    anonymized_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, comment="When the account was anonymised (UTC); NULL if never."
    )
    google_subject: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        comment="OIDC 'sub' of the linked Google account; NULL when none is linked.",
    )
    credential_version: Mapped[int] = mapped_column(
        Integer,
        server_default=text("0"),
        default=0,
        comment="Credential version carried by access tokens; only ever increases.",
    )
    is_seeder: Mapped[bool] = mapped_column(
        Boolean,
        server_default=false(),
        default=False,
        comment="Whether this is the Seeder admin; at most one row is true.",
    )


class AccountSession(Base):
    """One login session of an account (``account_session``).

    ``revoked_at`` records the end for any reason; ``logged_out_at`` only an
    explicit, verifiable logout and is never later than ``revoked_at``.
    """

    __tablename__ = "account_session"
    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_account_session_user_id_id"),
        CheckConstraint(
            "logged_out_at IS NULL OR (revoked_at IS NOT NULL AND logged_out_at <= revoked_at)",
            name="logged_out_within_revocation",
        ),
        {"comment": "Login sessions; one row per sign-in, written only by the system."},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, comment="Login session identifier."
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        comment="Account this session belongs to.",
    )
    started_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        comment="When the session started (UTC); the absolute limit counts from here.",
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        comment="When the session was last used (UTC); the idle limit counts from here.",
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, comment="When the session ended for any reason (UTC); NULL while active."
    )
    logged_out_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, comment="When the user explicitly logged out (UTC); NULL otherwise."
    )
    source_info: Mapped[str | None] = mapped_column(
        Text, comment="Source address and device of the sign-in; personal data, purged later."
    )


class AccountRefreshToken(Base):
    """One refresh token of a login session (``account_refresh_token``).

    The owning session is the token family. Only the SHA-256 hash of the token is
    stored, never the raw value.
    """

    __tablename__ = "account_refresh_token"
    __table_args__ = (
        CheckConstraint("reissue_count BETWEEN 0 AND 1", name="reissue_count_range"),
        {"comment": "Refresh tokens of login sessions; readable by no user."},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, comment="Refresh token identifier."
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("account_session.id", ondelete="CASCADE"),
        index=True,
        comment="Login session (token family) this token belongs to.",
    )
    token_hash: Mapped[str] = mapped_column(
        CHAR(64), unique=True, comment="Hex SHA-256 of the token; the raw token is never stored."
    )
    issued_at: Mapped[datetime] = mapped_column(
        UtcDateTime, comment="When the token was issued (UTC)."
    )
    expires_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        comment="When the token expires (UTC); never past the session's absolute limit.",
    )
    consumed_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, comment="When the token was first used to refresh (UTC); NULL if unused."
    )
    reissue_count: Mapped[int] = mapped_column(
        SmallInteger,
        server_default=text("0"),
        default=0,
        comment="Extra tokens reissued within the grace period; 0 or 1.",
    )
