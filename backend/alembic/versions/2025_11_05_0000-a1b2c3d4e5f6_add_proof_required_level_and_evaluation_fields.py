"""Add proof_required_level and evaluation fields

Revision ID: a1b2c3d4e5f6
Revises: e4704cb6675a
Create Date: 2025-11-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e4704cb6675a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ProofRequiredLevel enum type
    proof_required_level_enum = postgresql.ENUM('not_required', 'optional', 'required',
                                                  name='proofrequiredlevel',
                                                  create_type=True)
    proof_required_level_enum.create(op.get_bind(), checkfirst=True)

    # Modify project_items table
    # Add new column with default
    op.add_column('project_items',
                  sa.Column('proof_required_level',
                           sa.Enum('not_required', 'optional', 'required', name='proofrequiredlevel'),
                           nullable=False,
                           server_default=sa.text("'not_required'::proofrequiredlevel")))

    # Drop the old boolean column
    op.drop_column('project_items', 'proof_required')

    # Modify custom_questions table
    # Add evaluation fields
    op.add_column('custom_questions',
                  sa.Column('is_evaluation_item', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('custom_questions',
                  sa.Column('proof_required_level',
                           sa.Enum('not_required', 'optional', 'required', name='proofrequiredlevel'),
                           nullable=False,
                           server_default=sa.text("'not_required'::proofrequiredlevel")))
    op.add_column('custom_questions',
                  sa.Column('scoring_rules', sa.Text(), nullable=True))


def downgrade() -> None:
    # Reverse custom_questions changes
    op.drop_column('custom_questions', 'scoring_rules')
    op.drop_column('custom_questions', 'proof_required_level')
    op.drop_column('custom_questions', 'is_evaluation_item')

    # Reverse project_items changes
    op.add_column('project_items',
                  sa.Column('proof_required', sa.Boolean(), nullable=False, server_default='false'))
    op.drop_column('project_items', 'proof_required_level')

    # Drop enum type
    proof_required_level_enum = postgresql.ENUM('not_required', 'optional', 'required',
                                                  name='proofrequiredlevel')
    proof_required_level_enum.drop(op.get_bind(), checkfirst=True)
