"""rename log blog tag to record

Revision ID: c8e2f4a19d7b
Revises: b7c4e91a2d6f
Create Date: 2026-05-20 23:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c8e2f4a19d7b"
down_revision = "b7c4e91a2d6f"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    tags = sa.table("tags", sa.column("id", sa.Integer), sa.column("name", sa.String))
    blog_tags = sa.table("blog_tags", sa.column("blog_id", sa.Integer), sa.column("tag_id", sa.Integer))

    log_id = conn.execute(sa.select(tags.c.id).where(tags.c.name == "Log")).scalar()
    record_id = conn.execute(sa.select(tags.c.id).where(tags.c.name == "Record")).scalar()

    if log_id is None and record_id is None:
        conn.execute(tags.insert().values(name="Record", created_at=sa.func.now()))
        return

    if log_id is not None and record_id is None:
        conn.execute(tags.update().where(tags.c.id == log_id).values(name="Record"))
        return

    if log_id is None or record_id is None:
        return

    log_links = conn.execute(sa.select(blog_tags.c.blog_id).where(blog_tags.c.tag_id == log_id)).all()
    for row in log_links:
        exists = conn.execute(
            sa.select(blog_tags.c.blog_id).where(blog_tags.c.blog_id == row.blog_id, blog_tags.c.tag_id == record_id)
        ).first()
        if exists is None:
            conn.execute(blog_tags.insert().values(blog_id=row.blog_id, tag_id=record_id))

    conn.execute(blog_tags.delete().where(blog_tags.c.tag_id == log_id))
    conn.execute(tags.delete().where(tags.c.id == log_id))


def downgrade():
    conn = op.get_bind()
    tags = sa.table("tags", sa.column("id", sa.Integer), sa.column("name", sa.String))
    record_id = conn.execute(sa.select(tags.c.id).where(tags.c.name == "Record")).scalar()
    log_id = conn.execute(sa.select(tags.c.id).where(tags.c.name == "Log")).scalar()
    if record_id is not None and log_id is None:
        conn.execute(tags.update().where(tags.c.id == record_id).values(name="Log"))
