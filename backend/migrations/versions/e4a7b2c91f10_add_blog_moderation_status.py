"""add blog moderation status

Revision ID: e4a7b2c91f10
Revises: d8f4a91b2c73
Create Date: 2026-05-18 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "e4a7b2c91f10"
down_revision = "d8f4a91b2c73"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}
    if "moderation_status" in columns:
        return

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="active"))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}
    if "moderation_status" not in columns:
        return

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        batch_op.drop_column("moderation_status")
