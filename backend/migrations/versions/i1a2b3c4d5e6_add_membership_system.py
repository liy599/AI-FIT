"""add membership and order tables

Revision ID: i1a2b3c4d5e6
Revises: h7e3f1a9c2d4
"""
from alembic import op
import sqlalchemy as sa

revision = "i1a2b3c4d5e6"
down_revision = "h7e3f1a9c2d4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "membership_plans",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_monthly", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("price_yearly", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("features", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_membership_plans_slug", "membership_plans", ["slug"])

    op.create_table(
        "user_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("membership_plans.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="monthly"),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("billing_cycle IN ('monthly','yearly')", name="ck_membership_billing_cycle"),
        sa.CheckConstraint("status IN ('active','cancelled','expired','pending')", name="ck_membership_status"),
    )
    op.create_index("ix_user_memberships_user_status", "user_memberships", ["user_id", "status"])

    op.create_table(
        "membership_orders",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("membership_id", sa.Integer(), sa.ForeignKey("user_memberships.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("membership_plans.id"), nullable=False),
        sa.Column("amount", sa.Numeric(8, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="monthly"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_provider", sa.String(50), nullable=True),
        sa.Column("payment_ref", sa.String(200), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("status IN ('pending','paid','failed','refunded')", name="ck_order_status"),
    )
    op.create_index("ix_membership_orders_user_created", "membership_orders", ["user_id", "created_at"])

    # Seed default plans
    op.execute("""
        INSERT INTO membership_plans (slug, name, description, price_monthly, price_yearly, features, is_active, sort_order)
        VALUES
          ('free',    'Free',    'Access to all free courses and basic features.',
           0, 0,
           '["AI Pose training","Basic nutrition tracker","Free courses","Community blog"]',
           true, 1),
          ('premium', 'Premium', 'Full access including all premium courses and advanced analytics.',
           9.99, 89.99,
           '["Everything in Free","All premium courses","Advanced nutrition analytics","Priority support","Download training reports"]',
           true, 2),
          ('annual',  'Annual',  'Best value — premium features billed once per year.',
           7.50, 89.99,
           '["Everything in Premium","2 months free vs monthly","Early access to new courses"]',
           true, 3)
    """)


def downgrade():
    op.drop_table("membership_orders")
    op.drop_table("user_memberships")
    op.drop_table("membership_plans")
