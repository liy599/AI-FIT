"""add is_disabled to users

Revision ID: 7a9c2d81e5b4
Revises: 395ab095b09c
Create Date: 2026-05-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "7a9c2d81e5b4"
down_revision = "395ab095b09c"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("users")}
    if "is_disabled" in columns:
        return

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_disabled", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("users")}
    if "is_disabled" not in columns:
        return

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("is_disabled")
