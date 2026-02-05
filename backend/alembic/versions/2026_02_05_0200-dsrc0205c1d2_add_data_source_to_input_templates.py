"""Add data_source fields to input_templates

Revision ID: dsrc0205c1d2
Revises: rmfile0205b1c2
Create Date: 2026-02-05 02:00:00.000000

입력 템플릿에 데이터 소스 설정 추가
- data_source: form_input (폼 입력), user_profile (User 테이블 참조), coach_competency (중앙 DB)
- source_field: user_profile일 때 참조할 User 테이블 필드명
- display_only: 읽기 전용 표시 여부
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dsrc0205c1d2'
down_revision: Union[str, None] = 'rmfile0205b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add data_source column with default value 'form_input'
    op.add_column(
        'input_templates',
        sa.Column('data_source', sa.String(50), nullable=False, server_default='form_input')
    )

    # Add source_field column (nullable - only used when data_source is user_profile)
    op.add_column(
        'input_templates',
        sa.Column('source_field', sa.String(100), nullable=True)
    )

    # Add display_only column
    op.add_column(
        'input_templates',
        sa.Column('display_only', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('input_templates', 'display_only')
    op.drop_column('input_templates', 'source_field')
    op.drop_column('input_templates', 'data_source')
