"""Add organization column to users table

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'y9z0a1b2c3d4'
down_revision: Union[str, None] = 'x8y9z0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add organization column to users table (nullable, optional field)
    op.add_column('users', sa.Column('organization', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'organization')
