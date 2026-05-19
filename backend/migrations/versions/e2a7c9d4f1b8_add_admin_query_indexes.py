"""add admin query indexes

Revision ID: e2a7c9d4f1b8
Revises: d1e4f6a8b2c9
Create Date: 2026-05-18 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "e2a7c9d4f1b8"
down_revision = "d1e4f6a8b2c9"
branch_labels = None
depends_on = None


def _index_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {idx.get("name") for idx in inspector.get_indexes(table_name)}


def upgrade():
    user_indexes = _index_names("users")
    if "ix_users_admin_disabled_id" not in user_indexes:
        op.create_index("ix_users_admin_disabled_id", "users", ["is_admin", "is_disabled", "id"])
    if "ix_users_created_id" not in user_indexes:
        op.create_index("ix_users_created_id", "users", ["created_at", "id"])

    blog_indexes = _index_names("blogs")
    if "ix_blogs_admin_status_id" not in blog_indexes:
        op.create_index(
            "ix_blogs_admin_status_id",
            "blogs",
            ["visibility", "moderation_status", "is_published", "moderation_restore_requested", "id"],
        )
    if "ix_blogs_admin_updated_id" not in blog_indexes:
        op.create_index("ix_blogs_admin_updated_id", "blogs", ["visibility", "updated_at", "id"])


def downgrade():
    blog_indexes = _index_names("blogs")
    if "ix_blogs_admin_updated_id" in blog_indexes:
        op.drop_index("ix_blogs_admin_updated_id", table_name="blogs")
    if "ix_blogs_admin_status_id" in blog_indexes:
        op.drop_index("ix_blogs_admin_status_id", table_name="blogs")

    user_indexes = _index_names("users")
    if "ix_users_created_id" in user_indexes:
        op.drop_index("ix_users_created_id", table_name="users")
    if "ix_users_admin_disabled_id" in user_indexes:
        op.drop_index("ix_users_admin_disabled_id", table_name="users")
