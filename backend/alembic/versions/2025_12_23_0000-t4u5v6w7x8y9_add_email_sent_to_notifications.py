"""add email_sent to notifications

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2025-12-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 't4u5v6w7x8y9'
down_revision = 's3t4u5v6w7x8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns already exist
    conn = op.get_bind()

    # Check email_sent column
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='notifications' AND column_name='email_sent'
    """))
    if result.fetchone() is None:
        op.add_column('notifications', sa.Column('email_sent', sa.Boolean(), nullable=False, server_default='false'))

    # Check email_sent_at column
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='notifications' AND column_name='email_sent_at'
    """))
    if result.fetchone() is None:
        op.add_column('notifications', sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove email_sent and email_sent_at columns
    op.drop_column('notifications', 'email_sent_at')
    op.drop_column('notifications', 'email_sent')
