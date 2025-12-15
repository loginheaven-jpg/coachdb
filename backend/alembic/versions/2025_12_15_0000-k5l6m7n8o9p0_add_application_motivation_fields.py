"""Add motivation and applied_role to applications

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2025-12-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k5l6m7n8o9p0'
down_revision: Union[str, None] = 'j4k5l6m7n8o9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create coach_role enum type if it doesn't exist
    coach_role_enum = sa.Enum('leader', 'participant', 'supervisor', name='coachrole')

    # Check and create enum type (PostgreSQL specific)
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'coachrole'"))
    if not result.fetchone():
        coach_role_enum.create(conn, checkfirst=True)

    # Add motivation column
    op.add_column('applications', sa.Column('motivation', sa.Text(), nullable=True))

    # Add applied_role column
    op.add_column('applications', sa.Column('applied_role', coach_role_enum, nullable=True))


def downgrade() -> None:
    op.drop_column('applications', 'applied_role')
    op.drop_column('applications', 'motivation')

    # Optionally drop the enum type
    # op.execute("DROP TYPE IF EXISTS coachrole")
