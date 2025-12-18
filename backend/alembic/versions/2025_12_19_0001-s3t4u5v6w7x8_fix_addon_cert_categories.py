"""Fix ADDON_CERT_* items to CERTIFICATION category

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2025-12-19 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's3t4u5v6w7x8'
down_revision: Union[str, None] = 'r2s3t4u5v6w7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix category assignments for legacy ADDON_* items"""
    conn = op.get_bind()

    # ADDON_CERT_* → CERTIFICATION (자격증)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'CERTIFICATION'
        WHERE item_code LIKE 'ADDON_CERT_%'
    """))

    # DEGREE_* → EDUCATION (학력)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EDUCATION'
        WHERE item_code LIKE 'DEGREE_%'
    """))

    # Legacy experience items → EXPERIENCE (역량이력)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code IN (
            'ADDON_EXP_HOURS',
            'ADDON_CAREER',
            'ADDON_TRAINING',
            'ADDON_COACHING_HISTORY'
        )
    """))

    # ADDON_INTRO, ADDON_SPECIALTY → OTHER (기타)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'OTHER'
        WHERE item_code IN ('ADDON_INTRO', 'ADDON_SPECIALTY')
    """))


def downgrade() -> None:
    """Revert to ADDON category"""
    conn = op.get_bind()

    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'ADDON'
        WHERE item_code LIKE 'ADDON_%'
    """))
