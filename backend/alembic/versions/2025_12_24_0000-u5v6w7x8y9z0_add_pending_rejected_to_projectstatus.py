"""Add PENDING and REJECTED status to projectstatus enum

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2025-12-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'u5v6w7x8y9z0'
down_revision: Union[str, None] = 't4u5v6w7x8y9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE to add values to existing enums
    # ADD VALUE IF NOT EXISTS requires PostgreSQL 9.3+ and must be run outside transaction

    # Commit any pending transaction
    op.execute("COMMIT")

    # Add new enum values for project approval workflow
    # PENDING: 과제 승인 대기 상태
    # REJECTED: 과제 반려됨 (수정 후 재상신 가능)
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'PENDING'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'REJECTED'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # This would require recreating the type, which is complex
    # For now, we'll leave the values in place
    pass
