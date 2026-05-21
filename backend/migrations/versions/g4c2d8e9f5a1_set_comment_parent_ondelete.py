"""set comment parent on delete

Revision ID: g4c2d8e9f5a1
Revises: f3b8a6d2c4e1
Create Date: 2026-05-18 23:59:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "g4c2d8e9f5a1"
down_revision = "f3b8a6d2c4e1"
branch_labels = None
depends_on = None


def _comment_parent_fk(inspector):
    for fk in inspector.get_foreign_keys("comments"):
        if fk.get("constrained_columns") == ["parent_id"] and fk.get("referred_table") == "comments":
            return fk
    return None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "comments" not in inspector.get_table_names():
        return

    fk = _comment_parent_fk(inspector)
    if fk is not None and fk.get("name"):
        op.drop_constraint(fk["name"], "comments", type_="foreignkey")
    op.create_foreign_key(
        "fk_comments_parent_id_comments",
        "comments",
        "comments",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "comments" not in inspector.get_table_names():
        return

    fk = _comment_parent_fk(inspector)
    if fk is not None and fk.get("name"):
        op.drop_constraint(fk["name"], "comments", type_="foreignkey")
    op.create_foreign_key(
        "fk_comments_parent_id_comments",
        "comments",
        "comments",
        ["parent_id"],
        ["id"],
    )
