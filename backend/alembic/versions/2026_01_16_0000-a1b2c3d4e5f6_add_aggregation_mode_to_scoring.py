"""Add aggregation_mode to scoring_criteria

Revision ID: a1b2c3d4e5f6
Revises: z0a1b2c3d4e5
Create Date: 2026-01-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'z0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create aggregationmode enum (idempotent)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE aggregationmode AS ENUM ('first', 'sum', 'max', 'count', 'any_match', 'best_match');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Add aggregation_mode column to scoring_criteria (idempotent)
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scoring_criteria' AND column_name = 'aggregation_mode'
    """))
    if not result.fetchone():
        op.add_column('scoring_criteria', sa.Column(
            'aggregation_mode',
            sa.Enum('first', 'sum', 'max', 'count', 'any_match', 'best_match', name='aggregationmode'),
            nullable=True,
            server_default='first'
        ))


def downgrade() -> None:
    # Drop aggregation_mode column
    op.drop_column('scoring_criteria', 'aggregation_mode')

    # Drop aggregationmode enum
    op.execute("DROP TYPE IF EXISTS aggregationmode")
