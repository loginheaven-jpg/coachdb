"""Add in_person_coaching_area column to users table

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2025-12-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i3j4k5l6m7n8'
down_revision = 'h2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade():
    # Add in_person_coaching_area column to users table
    op.add_column('users', sa.Column('in_person_coaching_area', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('users', 'in_person_coaching_area')
