"""Remove redundant file columns from input_templates

Revision ID: rmfile0205b1c2
Revises: inptpl0205a1b2
Create Date: 2026-02-05 01:00:00.000000

파일 첨부 설정을 fields_schema의 file 필드로 단순화
- allow_file_upload: fields_schema에 file 타입 필드 유무로 자동 판단
- file_required: file 필드의 required 속성으로 대체
- allowed_file_types: 실행파일만 차단 (백엔드 로직으로 처리)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'rmfile0205b1c2'
down_revision: Union[str, None] = 'inptpl0205a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove redundant file-related columns
    op.drop_column('input_templates', 'allow_file_upload')
    op.drop_column('input_templates', 'file_required')
    op.drop_column('input_templates', 'allowed_file_types')


def downgrade() -> None:
    # Re-add file-related columns
    op.add_column(
        'input_templates',
        sa.Column('allow_file_upload', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        'input_templates',
        sa.Column('file_required', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        'input_templates',
        sa.Column('allowed_file_types', sa.Text(), nullable=True)
    )
