from __future__ import annotations

from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...extensions import db
from ...models import FoodMealRecord, TrainingSession, User, UserFeedback, WorkoutRecord

bp = Blueprint("admin", __name__)

DEFAULT_RETENTION_DAYS = {
    "feedback": 365,
    "workouts": 365,
    "meals": 365,
    "trainings": 365,
}


def _to_bool(value) -> bool:
    if value is True:
        return True
    if value is False or value is None:
        return False
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _admin_guard() -> tuple[bool, User | None]:
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return False, None
    admin_email = (current_app.config.get("ADMIN_EMAIL") or "").strip().lower()
    if not admin_email or user.email.strip().lower() != admin_email:
        return False, user
    return True, user


def _get_retention_days(payload: dict | None) -> dict[str, int]:
    payload = payload or {}
    custom = payload.get("retention_days") if isinstance(payload.get("retention_days"), dict) else {}
    result: dict[str, int] = {}
    for key, default_value in DEFAULT_RETENTION_DAYS.items():
        raw = custom.get(key, default_value)
        try:
            value = int(raw)
        except (TypeError, ValueError):
            value = default_value
        result[key] = max(1, value)
    return result


def _cutoff(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


@bp.get("/data-lifecycle/policy")
@jwt_required()
def get_policy():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403
    return jsonify({"retention_days": DEFAULT_RETENTION_DAYS})


@bp.post("/data-lifecycle/cleanup")
@jwt_required()
def run_cleanup():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    dry_run = _to_bool(data.get("dry_run", True))
    retention_days = _get_retention_days(data)
    summary: dict[str, dict] = {}

    def count_and_maybe_delete(name: str, query, *, delete_mode: bool = True):
        matched = query.count()
        deleted = 0
        if delete_mode and not dry_run and matched:
            deleted = query.delete(synchronize_session=False)
        summary[name] = {"matched": matched, "deleted": deleted if not dry_run else 0}

    count_and_maybe_delete(
        "feedback",
        UserFeedback.query.filter(UserFeedback.created_at < _cutoff(retention_days["feedback"])),
    )
    count_and_maybe_delete(
        "workouts",
        WorkoutRecord.query.filter(WorkoutRecord.created_at < _cutoff(retention_days["workouts"])),
    )
    count_and_maybe_delete(
        "meals",
        FoodMealRecord.query.filter(FoodMealRecord.created_at < _cutoff(retention_days["meals"])),
    )
    count_and_maybe_delete(
        "trainings",
        TrainingSession.query.filter(TrainingSession.created_at < _cutoff(retention_days["trainings"])),
    )
    if not dry_run:
        db.session.commit()

    return jsonify({"ok": True, "dry_run": dry_run, "retention_days": retention_days, "summary": summary})
