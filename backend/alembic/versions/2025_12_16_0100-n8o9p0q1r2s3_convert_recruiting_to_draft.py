"""Convert legacy RECRUITING status to DRAFT

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2025-12-16 01:00:00.000000

This migration converts all projects with RECRUITING status to DRAFT status.
RECRUITING was a legacy status that allowed bypassing the 100-point validation.
Now all projects must go through the finalize endpoint (100-point validation)
to become READY status.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n8o9p0q1r2s3'
down_revision: Union[str, None] = 'm7n8o9p0q1r2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert all RECRUITING status projects to DRAFT
    # This ensures they must go through proper validation (finalize) to become READY
    op.execute("""
        UPDATE projects
        SET status = 'DRAFT'
        WHERE status = 'RECRUITING' OR status = 'recruiting'
    """)

    print("[MIGRATION] Converted all RECRUITING projects to DRAFT status")


def downgrade() -> None:
    # Cannot reliably restore original RECRUITING status since we don't know
    # which projects were originally RECRUITING
    # This is intentional - RECRUITING should be deprecated
    pass
