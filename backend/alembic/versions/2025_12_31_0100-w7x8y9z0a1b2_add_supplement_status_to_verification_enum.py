"""Add supplement_requested and supplemented to verification_status_enum

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2025-12-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'w7x8y9z0a1b2'
down_revision: Union[str, None] = 'v6w7x8y9z0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum values to verification_status_enum
    # PostgreSQL requires ALTER TYPE to add values
    op.execute("ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'supplement_requested'")
    op.execute("ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'supplemented'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    # Would need to recreate the enum type
    pass
