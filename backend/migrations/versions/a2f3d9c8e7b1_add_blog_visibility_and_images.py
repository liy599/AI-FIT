"""add blog visibility and images

Revision ID: a2f3d9c8e7b1
Revises: f61c9d7e4a2b
Create Date: 2026-05-18 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "a2f3d9c8e7b1"
down_revision = "f61c9d7e4a2b"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        if "visibility" not in columns:
            batch_op.add_column(sa.Column("visibility", sa.String(length=20), nullable=False, server_default="public"))
        if "image_urls" not in columns:
            batch_op.add_column(sa.Column("image_urls", sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c.get("name") for c in inspector.get_columns("blogs")}

    with op.batch_alter_table("blogs", schema=None) as batch_op:
        if "image_urls" in columns:
            batch_op.drop_column("image_urls")
        if "visibility" in columns:
            batch_op.drop_column("visibility")
