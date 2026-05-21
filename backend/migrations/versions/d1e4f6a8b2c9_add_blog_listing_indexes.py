"""add blog listing indexes

Revision ID: d1e4f6a8b2c9
Revises: 9f4c6a1b2d3e
Create Date: 2026-05-18 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d1e4f6a8b2c9"
down_revision = "9f4c6a1b2d3e"
branch_labels = None
depends_on = None


def _index_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {idx.get("name") for idx in inspector.get_indexes(table_name)}


def upgrade():
    indexes = _index_names("blogs")
    if "ix_blogs_public_created" not in indexes:
        op.create_index(
            "ix_blogs_public_created",
            "blogs",
            ["is_published", "moderation_status", "visibility", "created_at", "id"],
        )
    if "ix_blogs_public_views" not in indexes:
        op.create_index(
            "ix_blogs_public_views",
            "blogs",
            ["is_published", "moderation_status", "visibility", "view_count", "id"],
        )
    if "ix_blogs_public_likes" not in indexes:
        op.create_index(
            "ix_blogs_public_likes",
            "blogs",
            ["is_published", "moderation_status", "visibility", "like_count", "id"],
        )


def downgrade():
    indexes = _index_names("blogs")
    if "ix_blogs_public_likes" in indexes:
        op.drop_index("ix_blogs_public_likes", table_name="blogs")
    if "ix_blogs_public_views" in indexes:
        op.drop_index("ix_blogs_public_views", table_name="blogs")
    if "ix_blogs_public_created" in indexes:
        op.drop_index("ix_blogs_public_created", table_name="blogs")
