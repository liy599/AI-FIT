"""add comment and notification query indexes

Revision ID: f3b8a6d2c4e1
Revises: e2a7c9d4f1b8
Create Date: 2026-05-18 23:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f3b8a6d2c4e1"
down_revision = "e2a7c9d4f1b8"
branch_labels = None
depends_on = None


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return any(index.get("name") == index_name for index in inspector.get_indexes(table_name))


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "comments" in tables and not _has_index(inspector, "comments", "ix_comments_user_blog_created_id"):
        op.create_index(
            "ix_comments_user_blog_created_id",
            "comments",
            ["user_id", "blog_id", "created_at", "id"],
        )

    if "notifications" in tables:
        if not _has_index(inspector, "notifications", "ix_notifications_recipient_created_id"):
            op.create_index(
                "ix_notifications_recipient_created_id",
                "notifications",
                ["recipient_user_id", "created_at", "id"],
            )
        if not _has_index(inspector, "notifications", "ix_notifications_recipient_read_created_id"):
            op.create_index(
                "ix_notifications_recipient_read_created_id",
                "notifications",
                ["recipient_user_id", "is_read", "created_at", "id"],
            )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "notifications" in tables:
        if _has_index(inspector, "notifications", "ix_notifications_recipient_read_created_id"):
            op.drop_index("ix_notifications_recipient_read_created_id", table_name="notifications")
        if _has_index(inspector, "notifications", "ix_notifications_recipient_created_id"):
            op.drop_index("ix_notifications_recipient_created_id", table_name="notifications")

    if "comments" in tables and _has_index(inspector, "comments", "ix_comments_user_blog_created_id"):
        op.drop_index("ix_comments_user_blog_created_id", table_name="comments")
