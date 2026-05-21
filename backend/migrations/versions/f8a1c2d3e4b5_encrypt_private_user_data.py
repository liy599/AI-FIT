"""encrypt private user data

Revision ID: f8a1c2d3e4b5
Revises: e6b1c7d9a4f2
Create Date: 2026-05-21 02:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f8a1c2d3e4b5"
down_revision = "e6b1c7d9a4f2"
branch_labels = None
depends_on = None


def _privacy():
    from app.utils.privacy import encrypt_text, privacy_hash

    return encrypt_text, privacy_hash


def _columns(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_columns(table_name)}


def _indexes(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_indexes(table_name)}


def _uniques(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_unique_constraints(table_name)}


def _checks(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_check_constraints(table_name)}


def _drop_unique(table_name: str, name: str) -> None:
    if name in _uniques(table_name):
        op.drop_constraint(name, table_name, type_="unique")


def _drop_index(table_name: str, name: str) -> None:
    if name in _indexes(table_name):
        op.drop_index(name, table_name=table_name)


def _drop_check(table_name: str, name: str) -> None:
    if name in _checks(table_name):
        op.drop_constraint(name, table_name, type_="check")


def _add_column(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def _drop_column(table_name: str, column_name: str) -> None:
    if column_name in _columns(table_name):
        op.drop_column(table_name, column_name)


def _backfill_users(conn):
    encrypt_text, privacy_hash = _privacy()
    rows = conn.execute(sa.text("SELECT id, email, gender, height, weight, fitness_goal FROM users")).mappings()
    for row in rows:
        email = (row["email"] or "").strip().lower()
        conn.execute(
            sa.text(
                """
                UPDATE users
                SET email_hash=:email_hash,
                    email_encrypted=:email_encrypted,
                    gender_encrypted=:gender_encrypted,
                    height_encrypted=:height_encrypted,
                    weight_encrypted=:weight_encrypted,
                    fitness_goal_encrypted=:fitness_goal_encrypted
                WHERE id=:id
                """
            ),
            {
                "id": row["id"],
                "email_hash": privacy_hash(email),
                "email_encrypted": encrypt_text(email),
                "gender_encrypted": encrypt_text(str(row["gender"])) if row["gender"] is not None else None,
                "height_encrypted": encrypt_text(str(row["height"])) if row["height"] is not None else None,
                "weight_encrypted": encrypt_text(str(row["weight"])) if row["weight"] is not None else None,
                "fitness_goal_encrypted": encrypt_text(str(row["fitness_goal"])) if row["fitness_goal"] is not None else None,
            },
        )


def _backfill_email_table(conn, table_name: str):
    encrypt_text, privacy_hash = _privacy()
    rows = conn.execute(sa.text(f"SELECT id, email FROM {table_name}")).mappings()
    for row in rows:
        email = (row["email"] or "").strip().lower()
        conn.execute(
            sa.text(f"UPDATE {table_name} SET email_hash=:email_hash, email_encrypted=:email_encrypted WHERE id=:id"),
            {"id": row["id"], "email_hash": privacy_hash(email), "email_encrypted": encrypt_text(email)},
        )


def _backfill_workouts(conn):
    encrypt_text, privacy_hash = _privacy()
    rows = conn.execute(sa.text("SELECT id, exercise_type, notes FROM workout_records")).mappings()
    for row in rows:
        exercise_type = (row["exercise_type"] or "").strip()
        conn.execute(
            sa.text(
                """
                UPDATE workout_records
                SET exercise_type_hash=:exercise_type_hash,
                    exercise_type_encrypted=:exercise_type_encrypted,
                    notes_encrypted=:notes_encrypted
                WHERE id=:id
                """
            ),
            {
                "id": row["id"],
                "exercise_type_hash": privacy_hash(exercise_type),
                "exercise_type_encrypted": encrypt_text(exercise_type),
                "notes_encrypted": encrypt_text(str(row["notes"])) if row["notes"] is not None else None,
            },
        )


def _backfill_training(conn):
    encrypt_text, privacy_hash = _privacy()
    rows = conn.execute(sa.text("SELECT id, note FROM training_sessions")).mappings()
    for row in rows:
        conn.execute(
            sa.text("UPDATE training_sessions SET note_encrypted=:note_encrypted WHERE id=:id"),
            {"id": row["id"], "note_encrypted": encrypt_text(str(row["note"])) if row["note"] is not None else None},
        )

    rows = conn.execute(sa.text("SELECT id, exercise_type, reps, weight, note FROM training_sets")).mappings()
    for row in rows:
        exercise_type = (row["exercise_type"] or "").strip()
        conn.execute(
            sa.text(
                """
                UPDATE training_sets
                SET exercise_type_hash=:exercise_type_hash,
                    exercise_type_encrypted=:exercise_type_encrypted,
                    reps_encrypted=:reps_encrypted,
                    weight_encrypted=:weight_encrypted,
                    note_encrypted=:note_encrypted
                WHERE id=:id
                """
            ),
            {
                "id": row["id"],
                "exercise_type_hash": privacy_hash(exercise_type),
                "exercise_type_encrypted": encrypt_text(exercise_type),
                "reps_encrypted": encrypt_text(str(row["reps"] if row["reps"] is not None else 0)),
                "weight_encrypted": encrypt_text(str(row["weight"])) if row["weight"] is not None else None,
                "note_encrypted": encrypt_text(str(row["note"])) if row["note"] is not None else None,
            },
        )


def upgrade():
    conn = op.get_bind()

    _add_column("users", sa.Column("email_hash", sa.String(length=64), nullable=True))
    _add_column("users", sa.Column("email_encrypted", sa.Text(), nullable=True))
    _add_column("users", sa.Column("gender_encrypted", sa.Text(), nullable=True))
    _add_column("users", sa.Column("height_encrypted", sa.Text(), nullable=True))
    _add_column("users", sa.Column("weight_encrypted", sa.Text(), nullable=True))
    _add_column("users", sa.Column("fitness_goal_encrypted", sa.Text(), nullable=True))
    _backfill_users(conn)
    op.alter_column("users", "email_hash", nullable=False)
    op.alter_column("users", "email_encrypted", nullable=False)
    op.create_index(op.f("ix_users_email_hash"), "users", ["email_hash"], unique=True)
    _drop_unique("users", "users_email_key")
    for name in ("ck_users_gender_allowed", "ck_users_fitness_goal_allowed", "ck_users_height_range", "ck_users_weight_range"):
        _drop_check("users", name)
    for name in ("email", "gender", "height", "weight", "fitness_goal"):
        _drop_column("users", name)

    _add_column("email_verifications", sa.Column("email_hash", sa.String(length=64), nullable=True))
    _add_column("email_verifications", sa.Column("email_encrypted", sa.Text(), nullable=True))
    _backfill_email_table(conn, "email_verifications")
    op.alter_column("email_verifications", "email_hash", nullable=False)
    op.alter_column("email_verifications", "email_encrypted", nullable=False)
    _drop_unique("email_verifications", "uq_email_verification_email")
    _drop_index("email_verifications", "ix_email_verifications_email")
    op.create_index(op.f("ix_email_verifications_email_hash"), "email_verifications", ["email_hash"], unique=False)
    op.create_unique_constraint("uq_email_verification_email_hash", "email_verifications", ["email_hash"])
    _drop_column("email_verifications", "email")

    _add_column("password_reset_codes", sa.Column("email_hash", sa.String(length=64), nullable=True))
    _add_column("password_reset_codes", sa.Column("email_encrypted", sa.Text(), nullable=True))
    _backfill_email_table(conn, "password_reset_codes")
    op.alter_column("password_reset_codes", "email_hash", nullable=False)
    op.alter_column("password_reset_codes", "email_encrypted", nullable=False)
    _drop_unique("password_reset_codes", "uq_password_reset_codes_email")
    _drop_index("password_reset_codes", "ix_password_reset_codes_email")
    op.create_index(op.f("ix_password_reset_codes_email_hash"), "password_reset_codes", ["email_hash"], unique=False)
    op.create_unique_constraint("uq_password_reset_codes_email_hash", "password_reset_codes", ["email_hash"])
    _drop_column("password_reset_codes", "email")

    _add_column("workout_records", sa.Column("exercise_type_hash", sa.String(length=64), nullable=True))
    _add_column("workout_records", sa.Column("exercise_type_encrypted", sa.Text(), nullable=True))
    _add_column("workout_records", sa.Column("notes_encrypted", sa.Text(), nullable=True))
    _backfill_workouts(conn)
    op.alter_column("workout_records", "exercise_type_hash", nullable=False)
    op.alter_column("workout_records", "exercise_type_encrypted", nullable=False)
    op.create_index(op.f("ix_workout_records_exercise_type_hash"), "workout_records", ["exercise_type_hash"], unique=False)
    _drop_column("workout_records", "exercise_type")
    _drop_column("workout_records", "notes")

    _add_column("training_sessions", sa.Column("note_encrypted", sa.Text(), nullable=True))
    _add_column("training_sets", sa.Column("exercise_type_hash", sa.String(length=64), nullable=True))
    _add_column("training_sets", sa.Column("exercise_type_encrypted", sa.Text(), nullable=True))
    _add_column("training_sets", sa.Column("reps_encrypted", sa.Text(), nullable=True))
    _add_column("training_sets", sa.Column("weight_encrypted", sa.Text(), nullable=True))
    _add_column("training_sets", sa.Column("note_encrypted", sa.Text(), nullable=True))
    _backfill_training(conn)
    op.alter_column("training_sets", "exercise_type_hash", nullable=False)
    op.alter_column("training_sets", "exercise_type_encrypted", nullable=False)
    op.alter_column("training_sets", "reps_encrypted", nullable=False)
    op.create_index(op.f("ix_training_sets_exercise_type_hash"), "training_sets", ["exercise_type_hash"], unique=False)
    _drop_column("training_sessions", "note")
    _drop_check("training_sets", "ck_training_sets_reps_nonnegative")
    _drop_check("training_sets", "ck_training_sets_weight_nonnegative")
    for name in ("exercise_type", "reps", "weight", "note"):
        _drop_column("training_sets", name)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_created_id", "audit_logs", ["actor_user_id", "created_at", "id"])
    op.create_index("ix_audit_logs_action_created_id", "audit_logs", ["action", "created_at", "id"])
    op.create_index("ix_audit_logs_target_created_id", "audit_logs", ["target_type", "target_id", "created_at", "id"])


def downgrade():
    op.drop_index("ix_audit_logs_target_created_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action_created_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_created_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    raise RuntimeError("downgrade would require decrypting private data; restore from backup if needed")
