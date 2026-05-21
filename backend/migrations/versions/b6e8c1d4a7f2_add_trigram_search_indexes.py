"""add trigram search indexes

Revision ID: b6e8c1d4a7f2
Revises: a9d4e7f1c2b3
Create Date: 2026-05-21 17:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b6e8c1d4a7f2"
down_revision = "a9d4e7f1c2b3"
branch_labels = None
depends_on = None


def _indexes(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_indexes(table_name)}


def _create_trgm_index(name: str, table_name: str, column: str) -> None:
    if name in _indexes(table_name):
        return
    op.create_index(
        name,
        table_name,
        [column],
        postgresql_using="gin",
        postgresql_ops={column: "gin_trgm_ops"},
    )


def _drop_index(name: str, table_name: str) -> None:
    if name in _indexes(table_name):
        op.drop_index(name, table_name=table_name)


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        _create_trgm_index("ix_blogs_title_trgm", "blogs", "title")
        _create_trgm_index("ix_users_username_trgm", "users", "username")
        _create_trgm_index("ix_comments_content_trgm", "comments", "content")


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        _drop_index("ix_comments_content_trgm", "comments")
        _drop_index("ix_users_username_trgm", "users")
        _drop_index("ix_blogs_title_trgm", "blogs")
