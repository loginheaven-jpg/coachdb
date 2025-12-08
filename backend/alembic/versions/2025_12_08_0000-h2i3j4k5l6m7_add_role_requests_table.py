"""Add role_requests table for role approval workflow

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2025-12-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'h2i3j4k5l6m7'
down_revision = 'g1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create role_requests table using String for status (simpler and avoids enum issues)
    op.create_table(
        'role_requests',
        sa.Column('request_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('requested_role', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_by', sa.BigInteger(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ),
        sa.ForeignKeyConstraint(['processed_by'], ['users.user_id'], ),
        sa.PrimaryKeyConstraint('request_id')
    )
    op.create_index(op.f('ix_role_requests_request_id'), 'role_requests', ['request_id'], unique=False)
    op.create_index(op.f('ix_role_requests_user_id'), 'role_requests', ['user_id'], unique=False)
    op.create_index(op.f('ix_role_requests_status'), 'role_requests', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_role_requests_status'), table_name='role_requests')
    op.drop_index(op.f('ix_role_requests_user_id'), table_name='role_requests')
    op.drop_index(op.f('ix_role_requests_request_id'), table_name='role_requests')
    op.drop_table('role_requests')
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS rolerequeststatus')
