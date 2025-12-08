"""Add template system and competency item fields

Revision ID: f6g7h8i9j0k1
Revises: a1b2c3d4e5f6
Create Date: 2025-11-05 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f6g7h8i9j0k1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ItemTemplate enum type
    item_template_enum = postgresql.ENUM(
        'text', 'number', 'select', 'multiselect', 'file',
        'text_file', 'degree', 'coaching_history',
        name='itemtemplate',
        create_type=True
    )
    item_template_enum.create(op.get_bind(), checkfirst=True)

    # Add template system columns to competency_items
    op.add_column('competency_items',
                  sa.Column('template',
                           sa.Enum('text', 'number', 'select', 'multiselect', 'file',
                                  'text_file', 'degree', 'coaching_history',
                                  name='itemtemplate'),
                           nullable=True))
    op.add_column('competency_items',
                  sa.Column('template_config', sa.Text(), nullable=True))
    op.add_column('competency_items',
                  sa.Column('is_repeatable', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('competency_items',
                  sa.Column('max_entries', sa.Integer(), nullable=True))

    # Create competency_item_fields table
    op.create_table(
        'competency_item_fields',
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_label', sa.String(length=200), nullable=False),
        sa.Column('field_type', sa.String(length=50), nullable=False),
        sa.Column('field_options', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('placeholder', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['competency_items.item_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('field_id')
    )
    op.create_index(op.f('ix_competency_item_fields_field_id'), 'competency_item_fields', ['field_id'], unique=False)


def downgrade() -> None:
    # Drop competency_item_fields table
    op.drop_index(op.f('ix_competency_item_fields_field_id'), table_name='competency_item_fields')
    op.drop_table('competency_item_fields')

    # Drop template system columns from competency_items
    op.drop_column('competency_items', 'max_entries')
    op.drop_column('competency_items', 'is_repeatable')
    op.drop_column('competency_items', 'template_config')
    op.drop_column('competency_items', 'template')

    # Drop ItemTemplate enum type
    item_template_enum = postgresql.ENUM(
        'text', 'number', 'select', 'multiselect', 'file',
        'text_file', 'degree', 'coaching_history',
        name='itemtemplate'
    )
    item_template_enum.drop(op.get_bind(), checkfirst=True)
