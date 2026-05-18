from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from ...extensions import db
from ...models import Blog, Comment, TrainingSession, User, WorkoutRecord
from ...utils.upload_access import resolve_upload_file_path


ALLOWED_DELETE_TARGETS = {"workouts", "trainings", "blogs", "comments", "account", "all"}


def delete_user_data(user_id: int, data: dict) -> tuple[dict, int]:
    targets = _to_targets(data.get("targets"))
    if not targets:
        return {"error": "targets required"}, 400

    dry_run = _to_bool(data.get("dry_run", False))
    before_dt = _parse_before_dt(data)
    if "account" in targets and (data.get("confirm") or "") != "DELETE_MY_ACCOUNT":
        return {"error": "confirmation phrase required"}, 400

    counts: dict[str, int] = {}

    if "workouts" in targets:
        _count_and_delete(counts, "workouts", WorkoutRecord.query.filter_by(user_id=user_id), WorkoutRecord, before_dt, dry_run)

    if "trainings" in targets:
        _count_and_delete(
            counts, "trainings", TrainingSession.query.filter_by(user_id=user_id), TrainingSession, before_dt, dry_run
        )

    if "comments" in targets:
        _count_and_delete_comments(counts, Comment.query.filter_by(user_id=user_id), before_dt, dry_run)

    if "blogs" in targets:
        _count_and_delete(counts, "blogs", Blog.query.filter_by(user_id=user_id), Blog, before_dt, dry_run)

    if "account" in targets:
        user = db.session.get(User, user_id)
        counts["account"] = 1 if user is not None else 0
        if not dry_run and user is not None:
            remove_user_avatar_file(user)
            db.session.delete(user)

    if not dry_run:
        db.session.commit()

    return {
        "ok": True,
        "dry_run": dry_run,
        "before": before_dt.isoformat() if before_dt else None,
        "targets": sorted(targets),
        "counts": counts,
    }, 200


def remove_user_avatar_file(user: User) -> None:
    avatar = (user.avatar_url or "").strip()
    if not avatar.startswith("/uploads/avatars/"):
        return
    rel = avatar.removeprefix("/uploads/")
    abs_path = resolve_upload_file_path(rel)
    if abs_path and os.path.isfile(abs_path):
        try:
            os.remove(abs_path)
        except OSError:
            pass


def _count_and_delete(counts: dict[str, int], name: str, query, model, before_dt: Optional[datetime], dry_run: bool) -> None:
    query = _apply_time_filter(query, model, before_dt)
    counts[name] = query.count()
    if not dry_run and counts[name]:
        query.delete(synchronize_session=False)


def _count_and_delete_comments(counts: dict[str, int], query, before_dt: Optional[datetime], dry_run: bool) -> None:
    query = _apply_time_filter(query, Comment, before_dt)
    counts["comments"] = query.count()
    if dry_run or not counts["comments"]:
        return

    comment_ids = [row[0] for row in query.with_entities(Comment.id).order_by(Comment.created_at.asc(), Comment.id.asc()).all()]
    for comment_id in comment_ids:
        comment = db.session.get(Comment, comment_id)
        if comment is None:
            continue
        Comment.query.filter_by(parent_id=comment.id).update(
            {Comment.parent_id: comment.parent_id},
            synchronize_session=False,
        )
        db.session.delete(comment)


def _apply_time_filter(query, model, before_dt: Optional[datetime]):
    if before_dt is None:
        return query
    if hasattr(model, "created_at"):
        return query.filter(model.created_at < before_dt)
    return query


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


def _to_targets(raw) -> set[str]:
    if isinstance(raw, str):
        raw_items = [raw]
    elif isinstance(raw, list):
        raw_items = raw
    else:
        raw_items = []
    targets = {str(item).strip().lower() for item in raw_items if str(item).strip()}
    targets = {target for target in targets if target in ALLOWED_DELETE_TARGETS}
    if "all" in targets:
        targets.discard("all")
        targets.update({"workouts", "trainings", "blogs", "comments"})
    return targets


def _parse_before_dt(data: dict) -> Optional[datetime]:
    raw_days = data.get("before_days")
    if raw_days is None or raw_days == "":
        return None
    try:
        days = int(raw_days)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    return datetime.utcnow() - timedelta(days=days)
