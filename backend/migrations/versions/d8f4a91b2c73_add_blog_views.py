"""add blog views

Revision ID: d8f4a91b2c73
Revises: b3d6f1428a20
Create Date: 2026-05-18 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d8f4a91b2c73"
down_revision = "b3d6f1428a20"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "blog_views" in tables:
        return

    op.create_table(
        "blog_views",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("viewer_key", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("blog_id", "viewer_key", name="uq_blog_viewer"),
    )
    op.create_index("ix_blog_views_blog_id", "blog_views", ["blog_id"])
    op.create_index("ix_blog_views_viewer_key", "blog_views", ["viewer_key"])


def downgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "blog_views" not in tables:
        return

    op.drop_index("ix_blog_views_viewer_key", table_name="blog_views")
    op.drop_index("ix_blog_views_blog_id", table_name="blog_views")
    op.drop_table("blog_views")
