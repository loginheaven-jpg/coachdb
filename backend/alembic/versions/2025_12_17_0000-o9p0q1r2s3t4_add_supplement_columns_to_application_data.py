"""Add supplement columns to application_data

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2025-12-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o9p0q1r2s3t4'
down_revision: Union[str, None] = 'n8o9p0q1r2s3'
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
    # Add supplement_deadline column to application_data (only if it doesn't exist)
    if not column_exists('application_data', 'supplement_deadline'):
        op.add_column('application_data', sa.Column('supplement_deadline',
            sa.DateTime(timezone=True), nullable=True))

    # Add supplement_requested_at column to application_data (only if it doesn't exist)
    if not column_exists('application_data', 'supplement_requested_at'):
        op.add_column('application_data', sa.Column('supplement_requested_at',
            sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    if column_exists('application_data', 'supplement_requested_at'):
        op.drop_column('application_data', 'supplement_requested_at')
    if column_exists('application_data', 'supplement_deadline'):
        op.drop_column('application_data', 'supplement_deadline')
