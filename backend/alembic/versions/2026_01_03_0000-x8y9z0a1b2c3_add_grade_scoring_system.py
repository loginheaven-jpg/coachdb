"""Add grade scoring system

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-01-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'x8y9z0a1b2c3'
down_revision: Union[str, None] = 'w7x8y9z0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add GRADE to matching_type enum (IF NOT EXISTS handles idempotency)
    op.execute("COMMIT")
    op.execute("""
        ALTER TYPE matchingtype ADD VALUE IF NOT EXISTS 'grade';
    """)

    # 2. Create value_source_type enum (idempotent with exception handling)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE valuesourcetype AS ENUM ('submitted', 'user_field', 'json_field');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 3. Add new columns to scoring_criteria table (idempotent)
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scoring_criteria' AND column_name = 'value_source'
    """))
    if not result.fetchone():
        op.add_column('scoring_criteria', sa.Column('value_source', sa.Enum('submitted', 'user_field', 'json_field', name='valuesourcetype'), nullable=False, server_default='submitted'))

    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scoring_criteria' AND column_name = 'source_field'
    """))
    if not result.fetchone():
        op.add_column('scoring_criteria', sa.Column('source_field', sa.String(100), nullable=True))

    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scoring_criteria' AND column_name = 'extract_pattern'
    """))
    if not result.fetchone():
        op.add_column('scoring_criteria', sa.Column('extract_pattern', sa.String(100), nullable=True))


def downgrade() -> None:
    # Drop columns
    op.drop_column('scoring_criteria', 'extract_pattern')
    op.drop_column('scoring_criteria', 'source_field')
    op.drop_column('scoring_criteria', 'value_source')

    # Drop value_source_type enum
    op.execute("DROP TYPE IF EXISTS valuesourcetype")

    # Note: Cannot remove value from PostgreSQL enum easily
    # GRADE will remain in matching_type enum after downgrade
