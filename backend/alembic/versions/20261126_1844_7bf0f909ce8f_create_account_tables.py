"""create account tables

Creates ``users``, ``account_session`` and ``account_refresh_token`` in that order
(data-table-dictionary §二, login-auth-guard design D9); ``downgrade`` drops them in
reverse. No account row is written: the first account comes from the Seeder
initialisation command.

Timestamp columns use ``sa.DateTime(timezone=True)``, the DDL that the models'
``UtcDateTime`` renders, so this file does not depend on application code. Boolean
defaults use ``sa.false()`` so the default is ``false`` on PostgreSQL and ``0`` on
SQLite.

Revision ID: 7bf0f909ce8f
Revises: 0dfb129ee036
Create Date: 2026-11-26 18:44:46.763941
"""

from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7bf0f909ce8f"
down_revision: str | Sequence[str] | None = "0dfb129ee036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _utc(nullable: bool, comment: str, name: str) -> sa.Column[datetime]:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable, comment=comment)


def upgrade() -> None:
    """Apply this revision."""
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, comment="Internal account identifier."),
        sa.Column(
            "email",
            sa.String(length=254),
            nullable=False,
            comment="Sign-in and mail address, stored already normalised (NFKC + casefold).",
        ),
        sa.Column(
            "name",
            sa.String(length=100),
            nullable=False,
            comment="Display name, 1 to 100 characters; may repeat across accounts.",
        ),
        sa.Column(
            "contact_info",
            sa.String(length=255),
            server_default="",
            nullable=False,
            comment="Contact details the user entered; empty string when left blank.",
        ),
        sa.Column(
            "avatar_url",
            sa.Text(),
            nullable=True,
            comment="Location of the uploaded avatar; NULL shows the default avatar.",
        ),
        sa.Column(
            "hashed_password",
            sa.String(),
            nullable=True,
            comment="Password hash; NULL means no local password (Google sign-in only).",
        ),
        sa.Column(
            "role",
            sa.String(),
            nullable=False,
            comment="Platform-level role: 'user' or 'super_admin'.",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            comment="Whether the account may sign in; deactivation ends every session.",
        ),
        _utc(False, "When the account was created (UTC); immutable.", "created_at"),
        _utc(False, "When the account was last changed (UTC).", "updated_at"),
        _utc(True, "When the account was anonymised (UTC); NULL if never.", "anonymized_at"),
        sa.Column(
            "google_subject",
            sa.String(length=255),
            nullable=True,
            comment="OIDC 'sub' of the linked Google account; NULL when none is linked.",
        ),
        sa.Column(
            "credential_version",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
            comment="Credential version carried by access tokens; only ever increases.",
        ),
        sa.Column(
            "is_seeder",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
            comment="Whether this is the Seeder admin; at most one row is true.",
        ),
        sa.CheckConstraint("length(name) BETWEEN 1 AND 100", name=op.f("ck_users_name_length")),
        sa.CheckConstraint(
            "length(contact_info) <= 255", name=op.f("ck_users_contact_info_length")
        ),
        sa.CheckConstraint("role IN ('user', 'super_admin')", name=op.f("ck_users_role_allowed")),
        sa.CheckConstraint(
            "credential_version >= 0", name=op.f("ck_users_credential_version_non_negative")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("google_subject", name=op.f("uq_users_google_subject")),
        comment="Platform accounts; never deleted, only deactivated or anonymised.",
    )
    op.create_index(
        op.f("ix_users_is_seeder"),
        "users",
        ["is_seeder"],
        unique=True,
        postgresql_where=sa.text("is_seeder"),
        sqlite_where=sa.text("is_seeder"),
    )

    op.create_table(
        "account_session",
        sa.Column("id", sa.Uuid(), nullable=False, comment="Login session identifier."),
        sa.Column("user_id", sa.Uuid(), nullable=False, comment="Account this session belongs to."),
        _utc(
            False,
            "When the session started (UTC); the absolute limit counts from here.",
            "started_at",
        ),
        _utc(
            False,
            "When the session was last used (UTC); the idle limit counts from here.",
            "last_seen_at",
        ),
        _utc(
            True,
            "When the session ended for any reason (UTC); NULL while active.",
            "revoked_at",
        ),
        _utc(
            True,
            "When the user explicitly logged out (UTC); NULL otherwise.",
            "logged_out_at",
        ),
        sa.Column(
            "source_info",
            sa.Text(),
            nullable=True,
            comment="Source address and device of the sign-in; personal data, purged later.",
        ),
        sa.CheckConstraint(
            "logged_out_at IS NULL OR (revoked_at IS NOT NULL AND logged_out_at <= revoked_at)",
            name=op.f("ck_account_session_logged_out_within_revocation"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_account_session_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_account_session")),
        sa.UniqueConstraint("user_id", "id", name="uq_account_session_user_id_id"),
        comment="Login sessions; one row per sign-in, written only by the system.",
    )
    op.create_index(
        op.f("ix_account_session_user_id"), "account_session", ["user_id"], unique=False
    )

    op.create_table(
        "account_refresh_token",
        sa.Column("id", sa.Uuid(), nullable=False, comment="Refresh token identifier."),
        sa.Column(
            "session_id",
            sa.Uuid(),
            nullable=False,
            comment="Login session (token family) this token belongs to.",
        ),
        sa.Column(
            "token_hash",
            sa.CHAR(length=64),
            nullable=False,
            comment="Hex SHA-256 of the token; the raw token is never stored.",
        ),
        _utc(False, "When the token was issued (UTC).", "issued_at"),
        _utc(
            False,
            "When the token expires (UTC); never past the session's absolute limit.",
            "expires_at",
        ),
        _utc(
            True,
            "When the token was first used to refresh (UTC); NULL if unused.",
            "consumed_at",
        ),
        sa.Column(
            "reissue_count",
            sa.SmallInteger(),
            server_default=sa.text("0"),
            nullable=False,
            comment="Extra tokens reissued within the grace period; 0 or 1.",
        ),
        sa.CheckConstraint(
            "reissue_count BETWEEN 0 AND 1",
            name=op.f("ck_account_refresh_token_reissue_count_range"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["account_session.id"],
            name=op.f("fk_account_refresh_token_session_id_account_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_account_refresh_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_account_refresh_token_token_hash")),
        comment="Refresh tokens of login sessions; readable by no user.",
    )
    op.create_index(
        op.f("ix_account_refresh_token_session_id"),
        "account_refresh_token",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    """Revert everything ``upgrade`` did: drop the three tables in reverse order."""
    op.drop_index(op.f("ix_account_refresh_token_session_id"), table_name="account_refresh_token")
    op.drop_table("account_refresh_token")
    op.drop_index(op.f("ix_account_session_user_id"), table_name="account_session")
    op.drop_table("account_session")
    op.drop_index(op.f("ix_users_is_seeder"), table_name="users")
    op.drop_table("users")
