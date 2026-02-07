"""add visible_in_profile column and CERT_*_EXISTS items

Revision ID: visprf0207a1b2
Revises: dispord0207a1b2
Create Date: 2026-02-07 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'visprf0207a1b2'
down_revision: Union[str, None] = 'dispord0207a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns
    op.add_column('competency_items',
        sa.Column('visible_in_profile', sa.Boolean(), nullable=False, server_default='true')
    )
    op.add_column('competency_items',
        sa.Column('data_source_item_code', sa.String(100), nullable=True)
    )

    # 2. Create CERT_COUNSELING_EXISTS item (상담심리치료자격-유무)
    op.execute("""
        INSERT INTO competency_items (
            item_name, item_code, category, input_type, is_active,
            template, is_repeatable, display_order,
            grade_edit_mode, evaluation_method, data_source,
            scoring_value_source, is_custom,
            grade_mappings, proof_required, field_label_overrides,
            visible_in_profile, data_source_item_code,
            grade_type, matching_type
        ) VALUES (
            '상담심리치료자격-유무', 'CERT_COUNSELING_EXISTS', 'CERTIFICATION', 'text', true,
            'text_file', false, 2,
            'fixed', 'by_existence', 'form_input',
            'submitted', false,
            '[{"value":"true","score":20,"label":"있음"},{"value":"false","score":0,"label":"없음"}]',
            'optional', '{}',
            false, 'CERT_COUNSELING',
            'file_exists', 'grade'
        )
        ON CONFLICT (item_code) DO NOTHING
    """)

    # 3. Create CERT_OTHER_EXISTS item (기타자격-유무)
    op.execute("""
        INSERT INTO competency_items (
            item_name, item_code, category, input_type, is_active,
            template, is_repeatable, display_order,
            grade_edit_mode, evaluation_method, data_source,
            scoring_value_source, is_custom,
            grade_mappings, proof_required, field_label_overrides,
            visible_in_profile, data_source_item_code,
            grade_type, matching_type
        ) VALUES (
            '기타자격-유무', 'CERT_OTHER_EXISTS', 'CERTIFICATION', 'text', true,
            'text_file', false, 4,
            'fixed', 'by_existence', 'form_input',
            'submitted', false,
            '[{"value":"true","score":20,"label":"있음"},{"value":"false","score":0,"label":"없음"}]',
            'optional', '{}',
            false, 'CERT_OTHER',
            'file_exists', 'grade'
        )
        ON CONFLICT (item_code) DO NOTHING
    """)

    # 4. Update display_order: CERT_COUNSELING 2→3, CERT_OTHER 4→5
    op.execute("UPDATE competency_items SET display_order = 3 WHERE item_code = 'CERT_COUNSELING'")
    op.execute("UPDATE competency_items SET display_order = 5 WHERE item_code = 'CERT_OTHER'")

    # 5. Deactivate old custom cert type items (replaced by formal items)
    op.execute("""
        UPDATE competency_items SET is_active = false
        WHERE item_code LIKE 'CUSTOM_%'
        AND category = 'CERTIFICATION'
        AND (item_name LIKE '%상담%심리%종류%' OR item_name LIKE '%기타%자격%종류%')
    """)


def downgrade() -> None:
    # Restore original display_order
    op.execute("UPDATE competency_items SET display_order = 2 WHERE item_code = 'CERT_COUNSELING'")
    op.execute("UPDATE competency_items SET display_order = 4 WHERE item_code = 'CERT_OTHER'")

    # Re-activate custom items
    op.execute("""
        UPDATE competency_items SET is_active = true
        WHERE item_code LIKE 'CUSTOM_%'
        AND category = 'CERTIFICATION'
        AND (item_name LIKE '%상담%심리%종류%' OR item_name LIKE '%기타%자격%종류%')
    """)

    # Delete new items
    op.execute("DELETE FROM competency_items WHERE item_code = 'CERT_COUNSELING_EXISTS'")
    op.execute("DELETE FROM competency_items WHERE item_code = 'CERT_OTHER_EXISTS'")

    # Drop columns
    op.drop_column('competency_items', 'data_source_item_code')
    op.drop_column('competency_items', 'visible_in_profile')
