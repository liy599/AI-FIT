"""backfill blog topic and post type tags

Revision ID: b7c4e91a2d6f
Revises: 1bd9d6116af1
Create Date: 2026-05-20 22:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b7c4e91a2d6f"
down_revision = "1bd9d6116af1"
branch_labels = None
depends_on = None


SYSTEM_TAGS = ("Diet", "Training", "Log", "Experience")
TOPIC_TAGS = {"Diet", "Training"}
POST_TYPE_TAGS = {"Log", "Experience"}
DIET_HINTS = ("diet", "nutrition", "meal", "breakfast", "lunch", "dinner", "food", "calorie", "protein", "hydration")
EXPERIENCE_HINTS = ("experience", "tips", "guide", "advice", "review", "lesson", "心得", "经验")


def _ensure_tags(conn) -> dict[str, int]:
    tags = sa.table("tags", sa.column("id", sa.Integer), sa.column("name", sa.String), sa.column("created_at", sa.DateTime))
    now = sa.func.now()
    for name in SYSTEM_TAGS:
        exists = conn.execute(sa.select(tags.c.id).where(tags.c.name == name)).scalar()
        if exists is None:
            conn.execute(tags.insert().values(name=name, created_at=now))
    rows = conn.execute(sa.select(tags.c.id, tags.c.name).where(tags.c.name.in_(SYSTEM_TAGS + ("Other",)))).all()
    return {row.name: row.id for row in rows}


def _infer_topic(tag_names: set[str], text: str) -> str:
    if "Diet" in tag_names:
        return "Diet"
    if "Training" in tag_names:
        return "Training"
    normalized = text.lower()
    return "Diet" if any(hint in normalized for hint in DIET_HINTS) else "Training"


def _infer_post_type(tag_names: set[str], text: str) -> str:
    if "Experience" in tag_names:
        return "Experience"
    if "Log" in tag_names:
        return "Log"
    normalized = text.lower()
    return "Experience" if any(hint in normalized for hint in EXPERIENCE_HINTS) else "Log"


def _insert_blog_tag(conn, blog_id: int, tag_id: int) -> None:
    blog_tags = sa.table("blog_tags", sa.column("blog_id", sa.Integer), sa.column("tag_id", sa.Integer))
    exists = conn.execute(
        sa.select(blog_tags.c.blog_id).where(blog_tags.c.blog_id == blog_id, blog_tags.c.tag_id == tag_id)
    ).first()
    if exists is None:
        conn.execute(blog_tags.insert().values(blog_id=blog_id, tag_id=tag_id))


def upgrade():
    conn = op.get_bind()
    tag_ids = _ensure_tags(conn)
    blogs = sa.table("blogs", sa.column("id", sa.Integer), sa.column("title", sa.String), sa.column("content", sa.Text))
    blog_tags = sa.table("blog_tags", sa.column("blog_id", sa.Integer), sa.column("tag_id", sa.Integer))
    tags = sa.table("tags", sa.column("id", sa.Integer), sa.column("name", sa.String))

    rows = conn.execute(sa.select(blogs.c.id, blogs.c.title, blogs.c.content)).all()
    for blog in rows:
        current = conn.execute(
            sa.select(tags.c.name)
            .select_from(blog_tags.join(tags, blog_tags.c.tag_id == tags.c.id))
            .where(blog_tags.c.blog_id == blog.id)
        ).scalars().all()
        tag_names = set(current)
        text = f"{blog.title or ''}\n{blog.content or ''}"

        if not (tag_names & TOPIC_TAGS):
            _insert_blog_tag(conn, blog.id, tag_ids[_infer_topic(tag_names, text)])
        if not (tag_names & POST_TYPE_TAGS):
            _insert_blog_tag(conn, blog.id, tag_ids[_infer_post_type(tag_names, text)])

    other_id = tag_ids.get("Other")
    if other_id is not None:
        conn.execute(blog_tags.delete().where(blog_tags.c.tag_id == other_id))


def downgrade():
    conn = op.get_bind()
    tags = sa.table("tags", sa.column("id", sa.Integer), sa.column("name", sa.String))
    blog_tags = sa.table("blog_tags", sa.column("tag_id", sa.Integer))
    rows = conn.execute(sa.select(tags.c.id).where(tags.c.name.in_(("Log", "Experience")))).all()
    ids = [row.id for row in rows]
    if ids:
        conn.execute(blog_tags.delete().where(blog_tags.c.tag_id.in_(ids)))
