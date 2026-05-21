"""add performance indexes and report summaries

Revision ID: a9d4e7f1c2b3
Revises: f8a1c2d3e4b5
Create Date: 2026-05-21 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "a9d4e7f1c2b3"
down_revision = "f8a1c2d3e4b5"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_columns(table_name)}


def _indexes(table_name: str) -> set[str]:
    return {item.get("name") for item in sa.inspect(op.get_bind()).get_indexes(table_name)}


def _create_index(name: str, table_name: str, columns: list[str]) -> None:
    if name not in _indexes(table_name):
        op.create_index(name, table_name, columns)


def _drop_index(name: str, table_name: str) -> None:
    if name in _indexes(table_name):
        op.drop_index(name, table_name=table_name)


def _clean_report_preview(value):
    if not isinstance(value, dict):
        return None

    preview: dict[str, object] = {}
    summary = value.get("summary")
    if isinstance(summary, str) and summary.strip():
        preview["summary"] = summary.strip()

    key_metrics = value.get("keyMetrics")
    if isinstance(key_metrics, dict):
        preview["keyMetrics"] = key_metrics

    for key in ("formAccuracyPct", "accuracyPct"):
        if isinstance(value.get(key), (int, float)):
            preview[key] = value[key]

    issues = value.get("issues")
    if isinstance(issues, list):
        safe_issues = []
        for issue in issues[:3]:
            if isinstance(issue, str):
                if issue.strip():
                    safe_issues.append(issue.strip())
                continue
            if not isinstance(issue, dict):
                continue
            safe_issue = {
                k: issue[k]
                for k in ("severity", "type", "message", "repNo", "frameTimeMs")
                if k in issue and isinstance(issue[k], (str, int, float))
            }
            if safe_issue:
                safe_issues.append(safe_issue)
        if safe_issues:
            preview["issues"] = safe_issues

    suggestions = value.get("suggestions")
    if isinstance(suggestions, list):
        safe_suggestions = [item.strip() for item in suggestions[:3] if isinstance(item, str) and item.strip()]
        if safe_suggestions:
            preview["suggestions"] = safe_suggestions

    return preview or None


def _backfill_report_summaries() -> None:
    from app.utils.privacy import protect_json_payload, reveal_json_payload

    conn = op.get_bind()
    training_sessions = sa.table(
        "training_sessions",
        sa.column("id", sa.Integer),
        sa.column("report_summary_json", sa.JSON),
    )
    rows = conn.execute(sa.text("SELECT id, report_json FROM training_sessions WHERE report_json IS NOT NULL")).mappings()
    for row in rows:
        report = reveal_json_payload(row["report_json"])
        preview = _clean_report_preview(report)
        if preview is None:
            continue
        conn.execute(
            training_sessions.update()
            .where(training_sessions.c.id == row["id"])
            .values(report_summary_json=protect_json_payload(preview))
        )


def upgrade():
    if "report_summary_json" not in _columns("training_sessions"):
        op.add_column("training_sessions", sa.Column("report_summary_json", sa.JSON(), nullable=True))
        _backfill_report_summaries()

    _create_index("ix_training_sessions_user_started_id", "training_sessions", ["user_id", "started_at", "id"])
    _create_index("ix_training_sets_training_order_id", "training_sets", ["training_id", "set_order", "id"])
    _create_index("ix_training_sets_exercise_training", "training_sets", ["exercise_type_hash", "training_id"])
    _create_index("ix_workout_records_user_date_id", "workout_records", ["user_id", "workout_date", "id"])
    _create_index("ix_comments_blog_parent_created_id", "comments", ["blog_id", "parent_id", "created_at", "id"])


def downgrade():
    _drop_index("ix_comments_blog_parent_created_id", "comments")
    _drop_index("ix_workout_records_user_date_id", "workout_records")
    _drop_index("ix_training_sets_exercise_training", "training_sets")
    _drop_index("ix_training_sets_training_order_id", "training_sets")
    _drop_index("ix_training_sessions_user_started_id", "training_sessions")
    if "report_summary_json" in _columns("training_sessions"):
        op.drop_column("training_sessions", "report_summary_json")
