"""Add project_type column to projects table

Revision ID: ptype0117a1b2
Revises: aggr0116f6g7
Create Date: 2026-01-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ptype0117a1b2'
down_revision: Union[str, None] = 'aggr0116f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type first (if not exists)
    conn = op.get_bind()

    # Check if enum exists
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'projecttype'"))
    if not result.fetchone():
        project_type_enum = sa.Enum('public_coaching', 'business_coaching', 'other', name='projecttype')
        project_type_enum.create(conn, checkfirst=True)

    # Check if column exists
    result = conn.execute(sa.text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'project_type'
    """))
    if not result.fetchone():
        # Add the column without default (to avoid PostgreSQL enum cast issues)
        op.add_column('projects', sa.Column('project_type', sa.Enum('public_coaching', 'business_coaching', 'other', name='projecttype'), nullable=True))
        # Update existing rows to have 'other' as value
        op.execute("UPDATE projects SET project_type = 'other' WHERE project_type IS NULL")


def downgrade() -> None:
    op.drop_column('projects', 'project_type')

    # Drop the enum type
    sa.Enum(name='projecttype').drop(op.get_bind(), checkfirst=True)
