"""Add is_frozen and frozen_at columns to applications table

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2025-12-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r2s3t4u5v6w7'
down_revision: Union[str, None] = 'q1r2s3t4u5v6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns already exist before adding (idempotent migration)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [col['name'] for col in inspector.get_columns('applications')]

    # Add is_frozen column with default False
    if 'is_frozen' not in existing_columns:
        op.add_column('applications',
            sa.Column('is_frozen', sa.Boolean(), nullable=False, server_default='false')
        )

    # Add frozen_at column
    if 'frozen_at' not in existing_columns:
        op.add_column('applications',
            sa.Column('frozen_at', sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    op.drop_column('applications', 'frozen_at')
    op.drop_column('applications', 'is_frozen')
