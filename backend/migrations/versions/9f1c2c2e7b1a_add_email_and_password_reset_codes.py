"""add email and password reset codes

Revision ID: 9f1c2c2e7b1a
Revises: afac34145495
Create Date: 2026-05-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "9f1c2c2e7b1a"
down_revision = "afac34145495"
branch_labels = None
depends_on = None


def _table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _column_names(table_name: str) -> set[str]:
    return {column.get("name") for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    return {index.get("name") for index in sa.inspect(op.get_bind()).get_indexes(table_name)}


def upgrade():
    tables = _table_names()

    if "email_verifications" in tables and "code_hash" not in _column_names("email_verifications"):
        with op.batch_alter_table("email_verifications", schema=None) as batch_op:
            batch_op.add_column(sa.Column("code_hash", sa.String(length=255), nullable=True))

    if "password_reset_codes" not in tables:
        op.create_table(
            "password_reset_codes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=100), nullable=False),
            sa.Column("code_hash", sa.String(length=255), nullable=True),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("last_sent_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email", name="uq_password_reset_codes_email"),
        )
        with op.batch_alter_table("password_reset_codes", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_password_reset_codes_email"), ["email"], unique=False)
            batch_op.create_index(batch_op.f("ix_password_reset_codes_user_id"), ["user_id"], unique=False)
        return

    indexes = _index_names("password_reset_codes")
    with op.batch_alter_table("password_reset_codes", schema=None) as batch_op:
        if "ix_password_reset_codes_email" not in indexes:
            batch_op.create_index(batch_op.f("ix_password_reset_codes_email"), ["email"], unique=False)
        if "ix_password_reset_codes_user_id" not in indexes:
            batch_op.create_index(batch_op.f("ix_password_reset_codes_user_id"), ["user_id"], unique=False)


def downgrade():
    tables = _table_names()

    if "password_reset_codes" in tables:
        indexes = _index_names("password_reset_codes")
        with op.batch_alter_table("password_reset_codes", schema=None) as batch_op:
            if "ix_password_reset_codes_user_id" in indexes:
                batch_op.drop_index(batch_op.f("ix_password_reset_codes_user_id"))
            if "ix_password_reset_codes_email" in indexes:
                batch_op.drop_index(batch_op.f("ix_password_reset_codes_email"))

        op.drop_table("password_reset_codes")

    if "email_verifications" in tables and "code_hash" in _column_names("email_verifications"):
        with op.batch_alter_table("email_verifications", schema=None) as batch_op:
            batch_op.drop_column("code_hash")

