"""Add READY status to projectstatus enum

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2025-12-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm7n8o9p0q1r2'
down_revision: Union[str, None] = 'l6m7n8o9p0q1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE to add values to existing enums
    # ADD VALUE IF NOT EXISTS requires PostgreSQL 9.3+ and must be run outside transaction
    # or with autocommit mode

    # Get connection and execute outside transaction using execution_options
    op.execute("COMMIT")  # Commit any pending transaction

    # Add new enum values - IF NOT EXISTS handles duplicates
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'ready'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'in_progress'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'evaluating'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'closed'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # This would require recreating the type, which is complex
    # For now, we'll leave the values in place
    pass
