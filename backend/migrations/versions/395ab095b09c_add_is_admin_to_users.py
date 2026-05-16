"""add is_admin to users

Revision ID: 395ab095b09c
Revises: 4f8d9f0a6c21
Create Date: 2026-05-15 20:14:08.723942

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '395ab095b09c'
down_revision = '4f8d9f0a6c21'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("users")}
    if "is_admin" in columns:
        return

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("users")}
    if "is_admin" not in columns:
        return

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_admin')
