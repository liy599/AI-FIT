from __future__ import annotations

from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import AnalysisTask, FoodMealRecord, TrainingSession, User, UserFeedback, VideoAsset, WorkoutRecord
from ..utils.upload_access import resolve_upload_file_path

bp = Blueprint("admin", __name__)

DEFAULT_RETENTION_DAYS = {
    "feedback": 365,
    "workouts": 365,
    "meals": 365,
    "trainings": 365,
    "pose_tasks": 180,
    "pose_videos": 90,
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
    user = User.query.get(user_id)
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
    count_and_maybe_delete(
        "pose_tasks",
        AnalysisTask.query.filter(AnalysisTask.created_at < _cutoff(retention_days["pose_tasks"])),
    )

    video_q = VideoAsset.query.filter(VideoAsset.created_at < _cutoff(retention_days["pose_videos"]))
    old_videos = video_q.all()
    deleted_files = 0
    for item in old_videos:
        path = resolve_upload_file_path(item.storage_path)
        if path:
            try:
                import os

                if os.path.isfile(path):
                    os.remove(path)
                    deleted_files += 1
            except OSError:
                pass

    if not dry_run and old_videos:
        deleted_rows = VideoAsset.query.filter(VideoAsset.id.in_([item.id for item in old_videos])).delete(
            synchronize_session=False
        )
    else:
        deleted_rows = 0
    summary["pose_videos"] = {
        "matched": len(old_videos),
        "deleted": deleted_rows if not dry_run else 0,
        "deleted_files": deleted_files if not dry_run else 0,
    }

    if not dry_run:
        db.session.commit()

    return jsonify({"ok": True, "dry_run": dry_run, "retention_days": retention_days, "summary": summary})

