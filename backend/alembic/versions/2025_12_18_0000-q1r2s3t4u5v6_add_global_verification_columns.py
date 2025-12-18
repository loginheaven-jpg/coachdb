"""Add global verification columns to coach_competencies

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2025-12-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'q1r2s3t4u5v6'
down_revision: Union[str, None] = 'p0q1r2s3t4u5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns already exist before adding (idempotent migration)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [col['name'] for col in inspector.get_columns('coach_competencies')]

    # Add is_globally_verified column with default False
    if 'is_globally_verified' not in existing_columns:
        op.add_column('coach_competencies',
            sa.Column('is_globally_verified', sa.Boolean(), nullable=False, server_default='false')
        )

    # Add globally_verified_at column
    if 'globally_verified_at' not in existing_columns:
        op.add_column('coach_competencies',
            sa.Column('globally_verified_at', sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    op.drop_column('coach_competencies', 'globally_verified_at')
    op.drop_column('coach_competencies', 'is_globally_verified')
