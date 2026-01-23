"""Add application_data_id to verification_records

Revision ID: appdt0123b2c3
Revises: docst0123a1b2
Create Date: 2026-01-23 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'appdt0123b2c3'
down_revision = 'docst0123a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. competency_id를 nullable로 변경 (기존에 NOT NULL이었던 경우)
    # PostgreSQL에서는 ALTER COLUMN ... DROP NOT NULL 사용
    op.execute("""
        ALTER TABLE verification_records
        ALTER COLUMN competency_id DROP NOT NULL
    """)

    # 2. application_data_id 컬럼 추가
    op.add_column(
        'verification_records',
        sa.Column('application_data_id', sa.BigInteger(), nullable=True)
    )

    # 3. application_data_id에 대한 인덱스 추가
    op.create_index(
        'ix_verification_records_application_data_id',
        'verification_records',
        ['application_data_id'],
        unique=False
    )

    # 4. Foreign key 추가
    op.create_foreign_key(
        'fk_verification_records_application_data',
        'verification_records', 'application_data',
        ['application_data_id'], ['data_id'],
        ondelete='CASCADE'
    )

    # 5. application_data_id + verifier_id 유니크 제약조건 추가
    op.create_unique_constraint(
        'uq_appdata_verifier',
        'verification_records',
        ['application_data_id', 'verifier_id']
    )

    # 6. Check constraint 추가 (둘 중 하나만 설정되어야 함)
    op.execute("""
        ALTER TABLE verification_records
        ADD CONSTRAINT chk_one_target CHECK (
            (competency_id IS NOT NULL AND application_data_id IS NULL) OR
            (competency_id IS NULL AND application_data_id IS NOT NULL)
        )
    """)


def downgrade() -> None:
    # Check constraint 제거
    op.execute("""
        ALTER TABLE verification_records
        DROP CONSTRAINT IF EXISTS chk_one_target
    """)

    # 유니크 제약조건 제거
    op.drop_constraint('uq_appdata_verifier', 'verification_records', type_='unique')

    # Foreign key 제거
    op.drop_constraint('fk_verification_records_application_data', 'verification_records', type_='foreignkey')

    # 인덱스 제거
    op.drop_index('ix_verification_records_application_data_id', table_name='verification_records')

    # 컬럼 제거
    op.drop_column('verification_records', 'application_data_id')

    # competency_id를 다시 NOT NULL로 변경
    op.execute("""
        ALTER TABLE verification_records
        ALTER COLUMN competency_id SET NOT NULL
    """)
