"""drop food module tables

Revision ID: 9f4c6a1b2d3e
Revises: c7d9e2a41f6b
Create Date: 2026-05-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f4c6a1b2d3e"
down_revision = "c7d9e2a41f6b"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "meal_items" in tables:
        op.drop_table("meal_items")
    if "meal_records" in tables:
        op.drop_table("meal_records")
    if "foods" in tables:
        op.drop_table("foods")


def downgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "foods" in tables or "meal_records" in tables or "meal_items" in tables:
        return

    op.create_table(
        "foods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("calories", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("protein", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("fat", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("carbs", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("aliases", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_foods_category"), "foods", ["category"], unique=False)

    op.create_table(
        "meal_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("meal_type", sa.String(length=20), nullable=False),
        sa.Column("recorded_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "meal_type", "recorded_on", name="uq_food_meal_record"),
    )
    op.create_index(op.f("ix_meal_records_meal_type"), "meal_records", ["meal_type"], unique=False)
    op.create_index(op.f("ix_meal_records_recorded_on"), "meal_records", ["recorded_on"], unique=False)
    op.create_index(op.f("ix_meal_records_user_id"), "meal_records", ["user_id"], unique=False)

    op.create_table(
        "meal_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meal_id", sa.Integer(), nullable=False),
        sa.Column("food_id", sa.Integer(), nullable=False),
        sa.Column("grams", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["food_id"], ["foods.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["meal_id"], ["meal_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_meal_items_food_id"), "meal_items", ["food_id"], unique=False)
    op.create_index(op.f("ix_meal_items_meal_id"), "meal_items", ["meal_id"], unique=False)
