"""add unified_templates table

Revision ID: unftpl0205a1b2
Revises: inptpl0205d1e2
Create Date: 2026-02-05 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'unftpl0205a1b2'
down_revision: Union[str, None] = 'extpat0205d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create unified_templates table
    op.create_table(
        'unified_templates',
        sa.Column('template_id', sa.String(100), primary_key=True, index=True),
        sa.Column('template_name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        # 입력 설정 (from InputTemplate)
        sa.Column('data_source', sa.String(50), nullable=False, server_default='form_input'),
        sa.Column('source_field', sa.String(100), nullable=True),
        sa.Column('display_only', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fields_schema', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('layout_type', sa.String(50), nullable=False, server_default='vertical'),
        sa.Column('is_repeatable', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('max_entries', sa.String(10), nullable=True),
        sa.Column('validation_rules', sa.Text(), nullable=True),
        sa.Column('help_text', sa.Text(), nullable=True),
        sa.Column('placeholder', sa.String(200), nullable=True),

        # 평가 설정 (from ScoringTemplate)
        sa.Column('evaluation_method', sa.String(50), nullable=False, server_default='standard'),
        sa.Column('grade_type', sa.String(50), nullable=True),
        sa.Column('matching_type', sa.String(50), nullable=True),
        sa.Column('scoring_value_source', sa.String(50), nullable=True, server_default='submitted'),
        sa.Column('scoring_source_field', sa.String(100), nullable=True),
        sa.Column('extract_pattern', sa.String(200), nullable=True),
        sa.Column('aggregation_mode', sa.String(50), nullable=True, server_default='first'),
        sa.Column('default_mappings', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('fixed_grades', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allow_add_grades', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('proof_required', sa.String(20), nullable=False, server_default='optional'),
        sa.Column('verification_note', sa.Text(), nullable=True),
        sa.Column('is_required_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allow_multiple', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('auto_confirm_across_projects', sa.Boolean(), nullable=False, server_default='false'),

        # 공통
        sa.Column('keywords', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Add unified_template_id FK to competency_items
    op.add_column(
        'competency_items',
        sa.Column('unified_template_id', sa.String(100), nullable=True)
    )
    op.add_column(
        'competency_items',
        sa.Column('evaluation_method_override', sa.String(50), nullable=True)
    )

    # Create FK constraint
    op.create_foreign_key(
        'fk_competency_items_unified_template',
        'competency_items',
        'unified_templates',
        ['unified_template_id'],
        ['template_id']
    )


def downgrade() -> None:
    # Drop FK constraint
    op.drop_constraint('fk_competency_items_unified_template', 'competency_items', type_='foreignkey')

    # Drop columns from competency_items
    op.drop_column('competency_items', 'evaluation_method_override')
    op.drop_column('competency_items', 'unified_template_id')

    # Drop unified_templates table
    op.drop_table('unified_templates')
