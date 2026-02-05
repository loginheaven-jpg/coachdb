"""Add input_templates table and input_template_id to competency_items

Revision ID: inptpl0205a1b2
Revises: scrtpl0204a1b2
Create Date: 2026-02-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'inptpl0205a1b2'
down_revision: Union[str, None] = 'scrtpl0204a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create input_templates table
    op.create_table(
        'input_templates',
        sa.Column('template_id', sa.String(50), primary_key=True, index=True),
        sa.Column('template_name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        # 필드 스키마 (JSON)
        sa.Column('fields_schema', sa.Text(), nullable=False, server_default='[]'),

        # 레이아웃 설정
        sa.Column('layout_type', sa.String(50), nullable=False, server_default='vertical'),

        # 입력 특성
        sa.Column('is_repeatable', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('max_entries', sa.String(10), nullable=True),

        # 파일 첨부 설정
        sa.Column('allow_file_upload', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('file_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('allowed_file_types', sa.Text(), nullable=True),

        # 검증 규칙 (JSON)
        sa.Column('validation_rules', sa.Text(), nullable=True),

        # 도움말/안내
        sa.Column('help_text', sa.Text(), nullable=True),
        sa.Column('placeholder', sa.String(200), nullable=True),

        # 키워드 (JSON)
        sa.Column('keywords', sa.Text(), nullable=True),

        # 상태
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # 타임스탬프
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Add input_template_id column to competency_items
    op.add_column(
        'competency_items',
        sa.Column('input_template_id', sa.String(50), nullable=True)
    )

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_competency_items_input_template',
        'competency_items',
        'input_templates',
        ['input_template_id'],
        ['template_id']
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_competency_items_input_template', 'competency_items', type_='foreignkey')

    # Drop input_template_id column from competency_items
    op.drop_column('competency_items', 'input_template_id')

    # Drop input_templates table
    op.drop_table('input_templates')
