"""Add coach profile fields for sync

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2025-12-17 01:00:00.000000

This migration adds fields to coach_profiles table:
- coaching_years: Total coaching experience in years
- specialty: Specialty area
- certifications: JSON array of certifications
- mentoring_experiences: JSON array of mentoring experiences
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p0q1r2s3t4u5'
down_revision: Union[str, None] = 'o9p0q1r2s3t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(table_name, column_name):
    """Check if a column exists in the table"""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '{table_name}' AND column_name = '{column_name}'
    """))
    return result.fetchone() is not None


def upgrade() -> None:
    # Add coaching_years column
    if not column_exists('coach_profiles', 'coaching_years'):
        op.add_column('coach_profiles', sa.Column('coaching_years', sa.Integer(), nullable=True))

    # Add specialty column
    if not column_exists('coach_profiles', 'specialty'):
        op.add_column('coach_profiles', sa.Column('specialty', sa.String(500), nullable=True))

    # Add certifications column
    if not column_exists('coach_profiles', 'certifications'):
        op.add_column('coach_profiles', sa.Column('certifications', sa.Text(), nullable=True))

    # Add mentoring_experiences column
    if not column_exists('coach_profiles', 'mentoring_experiences'):
        op.add_column('coach_profiles', sa.Column('mentoring_experiences', sa.Text(), nullable=True))


def downgrade() -> None:
    if column_exists('coach_profiles', 'mentoring_experiences'):
        op.drop_column('coach_profiles', 'mentoring_experiences')
    if column_exists('coach_profiles', 'certifications'):
        op.drop_column('coach_profiles', 'certifications')
    if column_exists('coach_profiles', 'specialty'):
        op.drop_column('coach_profiles', 'specialty')
    if column_exists('coach_profiles', 'coaching_years'):
        op.drop_column('coach_profiles', 'coaching_years')
