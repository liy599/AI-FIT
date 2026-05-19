"""add blog restore requested

Revision ID: f61c9d7e4a2b
Revises: e4a7b2c91f10
Create Date: 2026-05-18 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f61c9d7e4a2b"
down_revision = "e4a7b2c91f10"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}
    if "moderation_restore_requested" in columns:
        return

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("moderation_restore_requested", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}
    if "moderation_restore_requested" not in columns:
        return

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        batch_op.drop_column("moderation_restore_requested")
