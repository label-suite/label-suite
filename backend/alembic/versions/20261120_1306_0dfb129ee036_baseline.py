"""baseline

The empty starting point of the schema history: it creates no table, so
downgrading it only removes the ``alembic_version`` row (clarification Q8).

Revision ID: 0dfb129ee036
Revises:
Create Date: 2026-11-20 13:06:00.581582
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0dfb129ee036"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply this revision."""
    pass


def downgrade() -> None:
    """Revert everything ``upgrade`` did."""
    pass
