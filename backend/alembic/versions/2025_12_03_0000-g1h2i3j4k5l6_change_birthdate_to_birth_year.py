"""Change birthdate to birth_year

Revision ID: g1h2i3j4k5l6
Revises: f6g7h8i9j0k1
Create Date: 2025-12-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'f6g7h8i9j0k1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add birth_year column (Integer)
    op.add_column('users', sa.Column('birth_year', sa.Integer(), nullable=True))

    # 2. Migrate existing birthdate data to birth_year
    # Extract year from YYYY-MM-DD format
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE users
        SET birth_year = CAST(SUBSTRING(birthdate FROM 1 FOR 4) AS INTEGER)
        WHERE birthdate IS NOT NULL
        AND birthdate != ''
        AND LENGTH(birthdate) >= 4
    """))

    # 3. Drop old birthdate column
    op.drop_column('users', 'birthdate')


def downgrade() -> None:
    # 1. Add back birthdate column
    op.add_column('users', sa.Column('birthdate', sa.String(10), nullable=True))

    # 2. Migrate birth_year back to birthdate (as YYYY-01-01)
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE users
        SET birthdate = CAST(birth_year AS VARCHAR) || '-01-01'
        WHERE birth_year IS NOT NULL
    """))

    # 3. Drop birth_year column
    op.drop_column('users', 'birth_year')
