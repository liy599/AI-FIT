"""drop course module tables

Revision ID: d2f6a4b8c9e0
Revises: c8e2f4a19d7b
Create Date: 2026-05-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d2f6a4b8c9e0"
down_revision = "c8e2f4a19d7b"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "course_comment_likes" in tables:
        op.drop_table("course_comment_likes")
    if "course_comments" in tables:
        op.drop_table("course_comments")
    if "user_courses" in tables:
        op.drop_table("user_courses")
    if "courses" in tables:
        op.drop_table("courses")


def downgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if {"courses", "user_courses", "course_comments", "course_comment_likes"} & tables:
        return

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.Text(), nullable=True),
        sa.Column("intro_video_url", sa.Text(), nullable=True),
        sa.Column("instructor_name", sa.String(length=100), nullable=False),
        sa.Column("instructor_bio", sa.Text(), nullable=True),
        sa.Column("instructor_avatar_url", sa.Text(), nullable=True),
        sa.Column("is_free", sa.Boolean(), nullable=False),
        sa.Column("price", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "user_courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("enrolled_at", sa.DateTime(), nullable=False),
        sa.Column("payment_status", sa.String(length=20), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "course_id", name="uq_user_course"),
    )
    op.create_index(op.f("ix_user_courses_user_id"), "user_courses", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_courses_course_id"), "user_courses", ["course_id"], unique=False)

    op.create_table(
        "course_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("like_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_course_rating"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_course_comments_course_id"), "course_comments", ["course_id"], unique=False)
    op.create_index(op.f("ix_course_comments_user_id"), "course_comments", ["user_id"], unique=False)

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
    op.create_index(
        op.f("ix_course_comment_likes_course_comment_id"),
        "course_comment_likes",
        ["course_comment_id"],
        unique=False,
    )
    op.create_index(op.f("ix_course_comment_likes_user_id"), "course_comment_likes", ["user_id"], unique=False)
