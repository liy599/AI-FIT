"""add core data constraints

Revision ID: e6b1c7d9a4f2
Revises: d2f6a4b8c9e0
Create Date: 2026-05-21 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "e6b1c7d9a4f2"
down_revision = "d2f6a4b8c9e0"
branch_labels = None
depends_on = None


def _constraint_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {item.get("name") for item in inspector.get_check_constraints(table_name)}


def _create_check(table_name: str, name: str, condition: str) -> None:
    if name in _constraint_names(table_name):
        return
    op.create_check_constraint(name, table_name, condition)


def _drop_check(table_name: str, name: str) -> None:
    if name not in _constraint_names(table_name):
        return
    op.drop_constraint(name, table_name, type_="check")


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _table_exists(conn, table: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": table})
    return result.fetchone() is not None


def upgrade():
    conn = op.get_bind()

    if _column_exists(conn, "users", "gender"):
        conn.execute(sa.text("UPDATE users SET gender = NULL WHERE gender IS NOT NULL AND gender NOT IN ('Male', 'Female', 'Other')"))
    if _column_exists(conn, "users", "fitness_goal"):
        conn.execute(sa.text(
            "UPDATE users SET fitness_goal = NULL "
            "WHERE fitness_goal IS NOT NULL AND fitness_goal NOT IN ('Build Muscle', 'Lose Fat', 'Stay Healthy')"
        ))
    if _column_exists(conn, "users", "height"):
        conn.execute(sa.text("UPDATE users SET height = NULL WHERE height IS NOT NULL AND (height < 100 OR height > 250)"))
    if _column_exists(conn, "users", "weight"):
        conn.execute(sa.text("UPDATE users SET weight = NULL WHERE weight IS NOT NULL AND (weight < 30 OR weight > 250)"))

    if _table_exists(conn, "workout_records"):
        conn.execute(sa.text("UPDATE workout_records SET duration = NULL WHERE duration IS NOT NULL AND duration < 0"))
        conn.execute(sa.text("UPDATE workout_records SET calories_burned = NULL WHERE calories_burned IS NOT NULL AND calories_burned < 0"))
        conn.execute(sa.text("UPDATE workout_records SET form_score = NULL WHERE form_score IS NOT NULL AND (form_score < 0 OR form_score > 1)"))

    if _table_exists(conn, "blogs"):
        conn.execute(sa.text("UPDATE blogs SET visibility = 'public' WHERE visibility NOT IN ('public', 'private')"))
        conn.execute(sa.text("UPDATE blogs SET moderation_status = 'active' WHERE moderation_status NOT IN ('active', 'unpublished')"))
        conn.execute(sa.text("UPDATE blogs SET view_count = 0 WHERE view_count < 0"))
        conn.execute(sa.text("UPDATE blogs SET like_count = 0 WHERE like_count < 0"))
    if _table_exists(conn, "comments"):
        conn.execute(sa.text("UPDATE comments SET like_count = 0 WHERE like_count < 0"))

    if _table_exists(conn, "training_sessions") and _column_exists(conn, "training_sessions", "ended_at"):
        conn.execute(sa.text("UPDATE training_sessions SET ended_at = NULL WHERE ended_at IS NOT NULL AND ended_at < started_at"))
    if _table_exists(conn, "training_sets"):
        if _column_exists(conn, "training_sets", "set_order"):
            conn.execute(sa.text("UPDATE training_sets SET set_order = 1 WHERE set_order < 1"))
        if _column_exists(conn, "training_sets", "reps"):
            conn.execute(sa.text("UPDATE training_sets SET reps = 0 WHERE reps < 0"))
        if _column_exists(conn, "training_sets", "weight"):
            conn.execute(sa.text("UPDATE training_sets SET weight = NULL WHERE weight IS NOT NULL AND weight < 0"))

    if _column_exists(conn, "users", "gender"):
        _create_check("users", "ck_users_gender_allowed", "gender IS NULL OR gender IN ('Male', 'Female', 'Other')")
    if _column_exists(conn, "users", "fitness_goal"):
        _create_check(
            "users",
            "ck_users_fitness_goal_allowed",
            "fitness_goal IS NULL OR fitness_goal IN ('Build Muscle', 'Lose Fat', 'Stay Healthy')",
        )
    if _column_exists(conn, "users", "height"):
        _create_check("users", "ck_users_height_range", "height IS NULL OR (height >= 100 AND height <= 250)")
    if _column_exists(conn, "users", "weight"):
        _create_check("users", "ck_users_weight_range", "weight IS NULL OR (weight >= 30 AND weight <= 250)")

    if _table_exists(conn, "workout_records"):
        if _column_exists(conn, "workout_records", "duration"):
            _create_check("workout_records", "ck_workout_records_duration_nonnegative", "duration IS NULL OR duration >= 0")
        if _column_exists(conn, "workout_records", "calories_burned"):
            _create_check(
                "workout_records",
                "ck_workout_records_calories_nonnegative",
                "calories_burned IS NULL OR calories_burned >= 0",
            )
        if _column_exists(conn, "workout_records", "form_score"):
            _create_check(
                "workout_records",
                "ck_workout_records_form_score_range",
                "form_score IS NULL OR (form_score >= 0 AND form_score <= 1)",
            )

    if _table_exists(conn, "blogs"):
        _create_check("blogs", "ck_blogs_visibility_allowed", "visibility IN ('public', 'private')")
        _create_check(
            "blogs",
            "ck_blogs_moderation_status_allowed",
            "moderation_status IN ('active', 'unpublished')",
        )
        _create_check("blogs", "ck_blogs_view_count_nonnegative", "view_count >= 0")
        _create_check("blogs", "ck_blogs_like_count_nonnegative", "like_count >= 0")
    if _table_exists(conn, "comments"):
        _create_check("comments", "ck_comments_like_count_nonnegative", "like_count >= 0")
    if _table_exists(conn, "training_sessions") and _column_exists(conn, "training_sessions", "ended_at"):
        _create_check(
            "training_sessions",
            "ck_training_sessions_time_order",
            "ended_at IS NULL OR ended_at >= started_at",
        )
    if _table_exists(conn, "training_sets"):
        if _column_exists(conn, "training_sets", "set_order"):
            _create_check("training_sets", "ck_training_sets_set_order_positive", "set_order >= 1")
        if _column_exists(conn, "training_sets", "reps"):
            _create_check("training_sets", "ck_training_sets_reps_nonnegative", "reps >= 0")
        if _column_exists(conn, "training_sets", "weight"):
            _create_check("training_sets", "ck_training_sets_weight_nonnegative", "weight IS NULL OR weight >= 0")


def downgrade():
    _drop_check("training_sets", "ck_training_sets_weight_nonnegative")
    _drop_check("training_sets", "ck_training_sets_reps_nonnegative")
    _drop_check("training_sets", "ck_training_sets_set_order_positive")
    _drop_check("training_sessions", "ck_training_sessions_time_order")
    _drop_check("comments", "ck_comments_like_count_nonnegative")
    _drop_check("blogs", "ck_blogs_like_count_nonnegative")
    _drop_check("blogs", "ck_blogs_view_count_nonnegative")
    _drop_check("blogs", "ck_blogs_moderation_status_allowed")
    _drop_check("blogs", "ck_blogs_visibility_allowed")
    _drop_check("workout_records", "ck_workout_records_form_score_range")
    _drop_check("workout_records", "ck_workout_records_calories_nonnegative")
    _drop_check("workout_records", "ck_workout_records_duration_nonnegative")
    _drop_check("users", "ck_users_weight_range")
    _drop_check("users", "ck_users_height_range")
    _drop_check("users", "ck_users_fitness_goal_allowed")
    _drop_check("users", "ck_users_gender_allowed")
