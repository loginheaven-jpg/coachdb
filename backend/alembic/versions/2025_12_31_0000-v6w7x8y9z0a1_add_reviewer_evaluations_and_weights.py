"""Add reviewer_evaluations table and project weights

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2025-12-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'v6w7x8y9z0a1'
down_revision: Union[str, None] = 'u5v6w7x8y9z0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Helper to check if column exists
    conn = op.get_bind()

    # 1. Add evaluation weights to projects table (idempotent)
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'quantitative_weight'
    """))
    if not result.fetchone():
        op.add_column('projects', sa.Column('quantitative_weight', sa.Numeric(5, 2), nullable=False, server_default='70'))

    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'qualitative_weight'
    """))
    if not result.fetchone():
        op.add_column('projects', sa.Column('qualitative_weight', sa.Numeric(5, 2), nullable=False, server_default='30'))

    # 2. Create recommendation enum type (already idempotent)
    op.execute("COMMIT")
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE recommendation AS ENUM ('strongly_recommend', 'recommend', 'neutral', 'not_recommend');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 3. Create reviewer_evaluations table (check if exists)
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'reviewer_evaluations'
    """))
    if not result.fetchone():
        op.create_table(
            'reviewer_evaluations',
            sa.Column('evaluation_id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('application_id', sa.BigInteger(), nullable=False),
            sa.Column('reviewer_id', sa.BigInteger(), nullable=False),
            sa.Column('motivation_score', sa.Integer(), nullable=False),
            sa.Column('expertise_score', sa.Integer(), nullable=False),
            sa.Column('role_fit_score', sa.Integer(), nullable=False),
            sa.Column('total_score', sa.Numeric(5, 2), nullable=False),
            sa.Column('comment', sa.Text(), nullable=True),
            sa.Column('recommendation', sa.Enum('strongly_recommend', 'recommend', 'neutral', 'not_recommend', name='recommendation'), nullable=True),
            sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=True),
            sa.PrimaryKeyConstraint('evaluation_id'),
            sa.ForeignKeyConstraint(['application_id'], ['applications.application_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['reviewer_id'], ['users.user_id'], ondelete='CASCADE'),
            sa.UniqueConstraint('application_id', 'reviewer_id', name='uq_application_reviewer'),
            sa.CheckConstraint('motivation_score >= 0 AND motivation_score <= 10', name='check_motivation_score'),
            sa.CheckConstraint('expertise_score >= 0 AND expertise_score <= 10', name='check_expertise_score'),
            sa.CheckConstraint('role_fit_score >= 0 AND role_fit_score <= 10', name='check_role_fit_score'),
        )

        # 4. Create indexes (only if table was just created)
        op.create_index('ix_reviewer_evaluations_evaluation_id', 'reviewer_evaluations', ['evaluation_id'])
        op.create_index('ix_reviewer_evaluations_application_id', 'reviewer_evaluations', ['application_id'])
        op.create_index('ix_reviewer_evaluations_reviewer_id', 'reviewer_evaluations', ['reviewer_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_reviewer_evaluations_reviewer_id', 'reviewer_evaluations')
    op.drop_index('ix_reviewer_evaluations_application_id', 'reviewer_evaluations')
    op.drop_index('ix_reviewer_evaluations_evaluation_id', 'reviewer_evaluations')

    # Drop table
    op.drop_table('reviewer_evaluations')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS recommendation")

    # Remove columns from projects
    op.drop_column('projects', 'qualitative_weight')
    op.drop_column('projects', 'quantitative_weight')
