"""Add scoring_templates table and FK to competency_items

Revision ID: scrtpl0204a1b2
Revises: appdt0123b2c3
Create Date: 2026-02-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'scrtpl0204a1b2'
down_revision = 'appdt0123b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create scoring_templates table
    op.create_table(
        'scoring_templates',
        sa.Column('template_id', sa.String(100), primary_key=True, index=True),
        sa.Column('template_name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        # 평가 설정
        sa.Column('grade_type', sa.String(50), nullable=False),
        sa.Column('matching_type', sa.String(50), nullable=False),
        sa.Column('value_source', sa.String(50), nullable=False, server_default='SUBMITTED'),
        sa.Column('source_field', sa.String(100), nullable=True),
        sa.Column('aggregation_mode', sa.String(50), nullable=False, server_default='FIRST'),

        # 등급 매핑 (JSON)
        sa.Column('default_mappings', sa.Text(), nullable=False),

        # 템플릿 특성
        sa.Column('fixed_grades', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allow_add_grades', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('proof_required', sa.String(20), nullable=False, server_default='OPTIONAL'),
        sa.Column('verification_note', sa.Text(), nullable=True),

        # 항목 설정 기본값
        sa.Column('is_required_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allow_multiple', sa.Boolean(), nullable=False, server_default='false'),

        # 자동 컨펌 정책
        sa.Column('auto_confirm_across_projects', sa.Boolean(), nullable=False, server_default='false'),

        # 키워드 (JSON 배열)
        sa.Column('keywords', sa.Text(), nullable=True),

        # 상태
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Add columns to competency_items
    op.add_column(
        'competency_items',
        sa.Column('scoring_template_id', sa.String(100), nullable=True)
    )
    op.add_column(
        'competency_items',
        sa.Column('scoring_config_override', sa.Text(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_competency_items_scoring_template',
        'competency_items',
        'scoring_templates',
        ['scoring_template_id'],
        ['template_id']
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint(
        'fk_competency_items_scoring_template',
        'competency_items',
        type_='foreignkey'
    )

    # Drop columns from competency_items
    op.drop_column('competency_items', 'scoring_config_override')
    op.drop_column('competency_items', 'scoring_template_id')

    # Drop scoring_templates table
    op.drop_table('scoring_templates')
