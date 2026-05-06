"""drop legacy pose server inference tables

Revision ID: 4f8d9f0a6c21
Revises: cb3b82bfb8ed
Create Date: 2026-05-04 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "4f8d9f0a6c21"
down_revision = "cb3b82bfb8ed"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "analysis_results" in tables:
        op.drop_table("analysis_results")
    if "analysis_tasks" in tables:
        op.drop_table("analysis_tasks")
    if "video_assets" in tables:
        op.drop_table("video_assets")


def downgrade():
    op.create_table(
        "video_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Numeric(8, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "analysis_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("video_asset_id", sa.Integer(), sa.ForeignKey("video_assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("exercise_type", sa.String(length=50), nullable=False),
        sa.Column("view_angle", sa.String(length=20), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("analysis_tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("report_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
