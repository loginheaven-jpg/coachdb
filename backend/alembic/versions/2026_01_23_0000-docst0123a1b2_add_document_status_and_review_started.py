"""Add document_status to applications and review_started_at to projects

심사개시 기능 지원:
- applications.document_status: 서류검토 상태 (pending, in_review, supplement_requested, approved, disqualified)
- applications.document_disqualification_reason: 서류탈락 사유
- applications.document_disqualified_at: 서류탈락 시점
- projects.review_started_at: 심사개시 시점

Revision ID: docst0123a1b2
Revises: ptype0117a1b2
Create Date: 2026-01-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'docst0123a1b2'
down_revision: Union[str, None] = 'ptype0117a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create documentstatus enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE documentstatus AS ENUM (
                'pending', 'in_review', 'supplement_requested',
                'approved', 'disqualified'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # 2. Add document_status column to applications
    op.add_column('applications',
        sa.Column('document_status',
            sa.Enum('pending', 'in_review', 'supplement_requested', 'approved', 'disqualified',
                    name='documentstatus', create_type=False),
            nullable=False,
            server_default='pending')
    )

    # 3. Add document_disqualification_reason column to applications
    op.add_column('applications',
        sa.Column('document_disqualification_reason', sa.Text(), nullable=True)
    )

    # 4. Add document_disqualified_at column to applications
    op.add_column('applications',
        sa.Column('document_disqualified_at', sa.DateTime(timezone=True), nullable=True)
    )

    # 5. Add review_started_at column to projects
    op.add_column('projects',
        sa.Column('review_started_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    # Remove columns
    op.drop_column('projects', 'review_started_at')
    op.drop_column('applications', 'document_disqualified_at')
    op.drop_column('applications', 'document_disqualification_reason')
    op.drop_column('applications', 'document_status')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS documentstatus")
