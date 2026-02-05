"""Add extract_pattern to scoring_templates

Revision ID: extpat0205d1e2
Revises: dsrc0205c1d2
Create Date: 2026-02-05 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'extpat0205d1e2'
down_revision: Union[str, None] = 'dsrc0205c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'scoring_templates',
        sa.Column('extract_pattern', sa.String(200), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('scoring_templates', 'extract_pattern')
