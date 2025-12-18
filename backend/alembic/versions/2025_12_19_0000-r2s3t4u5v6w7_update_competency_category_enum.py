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

    # Add CERTIFICATION if not exists
    if 'CERTIFICATION' not in existing_values:
        conn.execute(sa.text("ALTER TYPE competencycategory ADD VALUE IF NOT EXISTS 'CERTIFICATION'"))

    # Add EXPERIENCE if not exists
    if 'EXPERIENCE' not in existing_values:
        conn.execute(sa.text("ALTER TYPE competencycategory ADD VALUE IF NOT EXISTS 'EXPERIENCE'"))

    # Commit to make new enum values available
    conn.execute(sa.text("COMMIT"))

    # Update existing items to new categories based on item_code patterns
    # CERT_* → CERTIFICATION
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'CERTIFICATION'
        WHERE item_code LIKE 'CERT_%'
    """))

    # EDU_* → EDUCATION
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EDUCATION'
        WHERE item_code LIKE 'EDU_%'
    """))

    # EXP_* → EXPERIENCE
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code LIKE 'EXP_%'
    """))

    # COACHING_* → EXPERIENCE
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'EXPERIENCE'
        WHERE item_code LIKE 'COACHING_%'
    """))

    # SPECIALTY, ADDON_* → OTHER
    conn.execute(sa.text("""
        UPDATE competency_items
        SET category = 'OTHER'
        WHERE item_code = 'SPECIALTY' OR item_code LIKE 'ADDON_%'
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
