"""drop user feedback

Revision ID: b3d6f1428a20
Revises: 7a9c2d81e5b4
Create Date: 2026-05-18 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b3d6f1428a20"
down_revision = "7a9c2d81e5b4"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "user_feedback" in tables:
        op.drop_table("user_feedback")


def downgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "user_feedback" in tables:
        return
    op.create_table(
        "user_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("type", sa.String(length=20), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("contact_email", sa.String(length=100), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
