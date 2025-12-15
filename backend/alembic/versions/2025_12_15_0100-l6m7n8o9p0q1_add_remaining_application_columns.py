"""Add remaining application columns

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2025-12-15 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l6m7n8o9p0q1'
down_revision: Union[str, None] = 'k5l6m7n8o9p0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(table_name, column_name):
    """Check if a column exists in the table"""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '{table_name}' AND column_name = '{column_name}'
    """))
    return result.fetchone() is not None


def upgrade() -> None:
    # Add missing columns to applications table (only if they don't exist)
    if not column_exists('applications', 'result_notified_at'):
        op.add_column('applications', sa.Column('result_notified_at',
            sa.DateTime(timezone=True), nullable=True))

    if not column_exists('applications', 'participation_confirmed'):
        op.add_column('applications', sa.Column('participation_confirmed',
            sa.Boolean(), nullable=False, server_default='false'))

    if not column_exists('applications', 'participation_confirmed_at'):
        op.add_column('applications', sa.Column('participation_confirmed_at',
            sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    if column_exists('applications', 'participation_confirmed_at'):
        op.drop_column('applications', 'participation_confirmed_at')
    if column_exists('applications', 'participation_confirmed'):
        op.drop_column('applications', 'participation_confirmed')
    if column_exists('applications', 'result_notified_at'):
        op.drop_column('applications', 'result_notified_at')
