"""Add support_program_name and other project columns

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2025-12-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j4k5l6m7n8o9'
down_revision: Union[str, None] = 'i3j4k5l6m7n8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add support_program_name column
    op.add_column('projects', sa.Column('support_program_name', sa.String(200), nullable=True))

    # Add project_achievements column
    op.add_column('projects', sa.Column('project_achievements', sa.Text(), nullable=True))

    # Add project_special_notes column
    op.add_column('projects', sa.Column('project_special_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'project_special_notes')
    op.drop_column('projects', 'project_achievements')
    op.drop_column('projects', 'support_program_name')
