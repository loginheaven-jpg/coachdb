"""Update CompetencyCategory enum and migrate item categories

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2025-12-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r2s3t4u5v6w7'
down_revision: Union[str, None] = 'q1r2s3t4u5v6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum values to competencycategory enum type
    # PostgreSQL requires ALTER TYPE to add new values
    conn = op.get_bind()

    # Check if new values already exist to make migration idempotent
    result = conn.execute(sa.text(
        "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'competencycategory'::regtype"
    ))
    existing_values = [row[0] for row in result]

    # Add new enum values if not exists
    new_values = ['CERTIFICATION', 'EXPERIENCE', 'DETAIL', 'OTHER']
    for val in new_values:
        if val not in existing_values:
            conn.execute(sa.text(f"ALTER TYPE competencycategory ADD VALUE IF NOT EXISTS '{val}'"))

    # Commit to make new enum values available
    conn.execute(sa.text("COMMIT"))

    # Update existing items to new categories based on item_code patterns
    # CERT_* or ADDON_CERT_* → CERTIFICATION (자격증)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'CERTIFICATION'
        WHERE item_code LIKE 'CERT_%' OR item_code LIKE 'ADDON_CERT_%'
    """))

    # EDU_* or DEGREE_* → EDUCATION (학력)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EDUCATION'
        WHERE item_code LIKE 'EDU_%' OR item_code LIKE 'DEGREE_%'
    """))

    # EXP_* → EXPERIENCE (역량이력)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code LIKE 'EXP_%'
    """))

    # COACHING_* or ADDON_COACHING_* → EXPERIENCE (역량이력)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code LIKE 'COACHING_%' OR item_code LIKE 'ADDON_COACHING_%'
    """))

    # Legacy experience items → EXPERIENCE
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code IN ('ADDON_EXP_HOURS', 'ADDON_CAREER', 'ADDON_TRAINING')
    """))

    # SPECIALTY, other ADDON_* → OTHER (기타)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'OTHER'
        WHERE item_code = 'SPECIALTY'
           OR item_code = 'ADDON_INTRO'
           OR item_code = 'ADDON_SPECIALTY'
    """))

    # EVAL_* stays as DETAIL (admin-only evaluation items)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'DETAIL'
        WHERE item_code LIKE 'EVAL_%'
    """))


def downgrade() -> None:
    # Revert categories back to EVALUATION (cannot remove enum values easily in PostgreSQL)
    conn = op.get_bind()

    # Reset all to EVALUATION (deprecated)
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EVALUATION'
        WHERE category IN ('CERTIFICATION', 'EXPERIENCE')
    """))
