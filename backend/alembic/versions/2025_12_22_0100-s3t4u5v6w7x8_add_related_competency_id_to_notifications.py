"""add related_competency_id to notifications

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2025-12-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's3t4u5v6w7x8'
down_revision: Union[str, None] = 'r2s3t4u5v6w7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add related_competency_id column to notifications table
    op.add_column(
        'notifications',
        sa.Column('related_competency_id', sa.BigInteger(), nullable=True)
    )
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_notifications_competency_id',
        'notifications',
        'coach_competencies',
        ['related_competency_id'],
        ['competency_id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_notifications_competency_id', 'notifications', type_='foreignkey')
    # Remove column
    op.drop_column('notifications', 'related_competency_id')
