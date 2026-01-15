"""Add introduction column to users table

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-01-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'z0a1b2c3d4e5'
down_revision: Union[str, None] = 'y9z0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add introduction column to users table (nullable, optional field)
    op.add_column('users', sa.Column('introduction', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'introduction')
