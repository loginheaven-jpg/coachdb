"""add display_order and reorganize competency items

Revision ID: dispord0207a1b2
Revises: unftpl0205a1b2
Create Date: 2026-02-07 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dispord0207a1b2'
down_revision: Union[str, None] = 'unftpl0205a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. display_order 컬럼 추가 (IF NOT EXISTS for idempotency)
    op.execute("""
        ALTER TABLE competency_items
        ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 999
    """)

    # 2. 기존 항목에 display_order 설정
    # display_order 체계: 카테고리 그룹(백단위) + 항목순서
    # 자격증=0xx, 코칭경력=1xx, 학력=2xx, 관리자=8xx, 기타=9xx

    # === 자격증 그룹 (0xx) ===
    op.execute("UPDATE competency_items SET display_order = 1 WHERE item_code = 'CERT_KCA'")
    op.execute("UPDATE competency_items SET display_order = 2 WHERE item_code = 'CERT_COUNSELING'")
    op.execute("UPDATE competency_items SET display_order = 3 WHERE item_code = 'CERT_COUNSELING_COPY'")
    op.execute("UPDATE competency_items SET display_order = 4 WHERE item_code = 'CERT_OTHER'")
    op.execute("UPDATE competency_items SET display_order = 5 WHERE item_code = 'Kind_of_CERT_OTHER'")

    # === 코칭경력 그룹 (1xx) ===
    op.execute("UPDATE competency_items SET display_order = 101 WHERE item_code = 'EXP_COACHING_HOURS'")
    # EDUCATION_TRAINING (신규 항목)은 아래에서 102로 생성
    op.execute("UPDATE competency_items SET display_order = 103 WHERE item_code = 'COACHING_BUSINESS'")
    op.execute("UPDATE competency_items SET display_order = 104 WHERE item_code = 'COACHING_YOUTH'")

    # === 학력 그룹 (2xx) ===
    op.execute("UPDATE competency_items SET display_order = 201 WHERE item_code = 'EDU_COACHING_FINAL'")
    op.execute("UPDATE competency_items SET display_order = 202 WHERE item_code = 'EDU_OTHER_FINAL'")

    # === 관리자전용 (8xx) ===
    op.execute("UPDATE competency_items SET display_order = 801 WHERE item_code = 'EVAL_PREVIOUS_PROJECT'")
    op.execute("UPDATE competency_items SET display_order = 802 WHERE item_code = 'EVAL_COMMITTEE'")

    # === 카테고리별 fallback (미지정 항목을 각 카테고리 끝에 배치) ===
    op.execute("UPDATE competency_items SET display_order = 90 WHERE category = 'CERTIFICATION' AND display_order NOT BETWEEN 0 AND 89")
    op.execute("UPDATE competency_items SET display_order = 190 WHERE category = 'EXPERIENCE' AND display_order NOT BETWEEN 100 AND 189")
    op.execute("UPDATE competency_items SET display_order = 290 WHERE category = 'EDUCATION' AND display_order NOT BETWEEN 200 AND 289")
    op.execute("UPDATE competency_items SET display_order = 890 WHERE category = 'DETAIL' AND display_order NOT BETWEEN 800 AND 889")
    op.execute("UPDATE competency_items SET display_order = 990 WHERE category = 'OTHER' AND display_order NOT BETWEEN 900 AND 989")

    # 3. 비활성화 대상 항목 처리
    op.execute("""
        UPDATE competency_items SET is_active = false
        WHERE item_code IN (
            'EXP_MENTORING',
            'EXP_COACHING_YEARS',
            'COACHING_CAREER',
            'COACHING_YOUNG_ADULT',
            'COACHING_FAMILY',
            'COACHING_LIFE',
            'SPECIALTY'
        )
    """)

    # 4. 신규 항목 생성: 코칭관련 연수/교육
    op.execute("""
        INSERT INTO competency_items (
            item_name, item_code, category, input_type, is_active,
            template, is_repeatable, display_order,
            grade_edit_mode, evaluation_method, data_source,
            scoring_value_source, is_custom,
            grade_mappings, proof_required, field_label_overrides
        ) VALUES (
            '코칭관련 연수/교육', 'EDUCATION_TRAINING', 'EXPERIENCE', 'text', true,
            'text_file', true, 102,
            'flexible', 'standard', 'form_input',
            'submitted', false,
            '[]', 'optional', '{}'
        )
        ON CONFLICT (item_code) DO NOTHING
    """)

    # 5. 신규 항목의 필드 생성
    op.execute("""
        INSERT INTO competency_item_fields (item_id, field_name, field_label, field_type, is_required, display_order, placeholder)
        SELECT item_id, 'training_name', '연수/교육명', 'text', true, 1, '연수/교육명을 입력하세요'
        FROM competency_items WHERE item_code = 'EDUCATION_TRAINING'
        AND NOT EXISTS (
            SELECT 1 FROM competency_item_fields f
            WHERE f.item_id = competency_items.item_id AND f.field_name = 'training_name'
        )
    """)
    op.execute("""
        INSERT INTO competency_item_fields (item_id, field_name, field_label, field_type, is_required, display_order)
        SELECT item_id, 'proof', '증빙 업로드', 'file', false, 2
        FROM competency_items WHERE item_code = 'EDUCATION_TRAINING'
        AND NOT EXISTS (
            SELECT 1 FROM competency_item_fields f
            WHERE f.item_id = competency_items.item_id AND f.field_name = 'proof'
        )
    """)


def downgrade() -> None:
    # 신규 항목의 필드 삭제
    op.execute("""
        DELETE FROM competency_item_fields
        WHERE item_id IN (SELECT item_id FROM competency_items WHERE item_code = 'EDUCATION_TRAINING')
    """)
    # 신규 항목 삭제
    op.execute("DELETE FROM competency_items WHERE item_code = 'EDUCATION_TRAINING'")

    # 비활성화 복구
    op.execute("""
        UPDATE competency_items SET is_active = true
        WHERE item_code IN (
            'EXP_MENTORING', 'EXP_COACHING_YEARS', 'COACHING_CAREER',
            'COACHING_YOUNG_ADULT', 'COACHING_FAMILY', 'COACHING_LIFE', 'SPECIALTY'
        )
    """)

    # display_order 컬럼 제거
    op.drop_column('competency_items', 'display_order')
