"""restore food and course modules after domain migration

Revision ID: h7e3f1a9c2d4
Revises: b6e8c1d4a7f2
"""
from alembic import op
import sqlalchemy as sa

revision = "h7e3f1a9c2d4"
down_revision = "b6e8c1d4a7f2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "foods" not in tables:
        op.create_table(
            "foods",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("display_name", sa.String(100), nullable=False),
            sa.Column("calories", sa.Numeric(10, 2), nullable=False),
            sa.Column("protein", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("fat", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("carbs", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("aliases", sa.Text(), nullable=True),
        )
        op.create_index("ix_foods_category", "foods", ["category"])
    if "meal_records" not in tables:
        op.create_table(
            "meal_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("meal_type", sa.String(20), nullable=False),
            sa.Column("recorded_on", sa.Date(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", "meal_type", "recorded_on", name="uq_food_meal_record"),
        )
        op.create_index("ix_meal_records_user_id", "meal_records", ["user_id"])
        op.create_index("ix_meal_records_meal_type", "meal_records", ["meal_type"])
        op.create_index("ix_meal_records_recorded_on", "meal_records", ["recorded_on"])
    if "meal_items" not in tables:
        op.create_table(
            "meal_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("meal_id", sa.Integer(), nullable=False),
            sa.Column("food_id", sa.Integer(), nullable=False),
            sa.Column("grams", sa.Numeric(10, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["meal_id"], ["meal_records.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["food_id"], ["foods.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_meal_items_meal_id", "meal_items", ["meal_id"])
        op.create_index("ix_meal_items_food_id", "meal_items", ["food_id"])
    if "courses" not in tables:
        op.create_table(
            "courses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("cover_image_url", sa.Text()),
            sa.Column("intro_video_url", sa.Text()),
            sa.Column("instructor_name", sa.String(100), nullable=False),
            sa.Column("instructor_bio", sa.Text()),
            sa.Column("instructor_avatar_url", sa.Text()),
            sa.Column("is_free", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("price", sa.Numeric(8, 2)),
            sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if "user_courses" not in tables:
        op.create_table(
            "user_courses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("enrolled_at", sa.DateTime(), nullable=False),
            sa.Column("payment_status", sa.String(20)),
            sa.Column("expires_at", sa.DateTime()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", "course_id", name="uq_user_course"),
        )
        op.create_index("ix_user_courses_user_id", "user_courses", ["user_id"])
        op.create_index("ix_user_courses_course_id", "user_courses", ["course_id"])
    if "course_comments" not in tables:
        op.create_table(
            "course_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_course_rating"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_course_comments_course_id", "course_comments", ["course_id"])
        op.create_index("ix_course_comments_user_id", "course_comments", ["user_id"])
    if "course_comment_likes" not in tables:
        op.create_table(
            "course_comment_likes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("course_comment_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["course_comment_id"], ["course_comments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("course_comment_id", "user_id", name="uq_course_comment_like"),
        )
        op.create_index("ix_course_comment_likes_course_comment_id", "course_comment_likes", ["course_comment_id"])
        op.create_index("ix_course_comment_likes_user_id", "course_comment_likes", ["user_id"])


def downgrade():
    for table in ("course_comment_likes", "course_comments", "user_courses", "courses",
                  "meal_items", "meal_records", "foods"):
        op.drop_table(table)
