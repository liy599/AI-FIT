import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ...extensions import db
from ...models import Blog, Comment, FoodMealRecord, TrainingSession, User, UserFeedback, WorkoutRecord
from ...utils.pagination import parse_pagination
from ...utils.upload_access import resolve_upload_file_path

bp = Blueprint("user", __name__)
ALLOWED_DELETE_TARGETS = {"workouts", "meals", "trainings", "feedback", "blogs", "comments", "account", "all"}


def _user_public(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "avatar_url": u.avatar_url,
        "gender": u.gender,
        "height": float(u.height) if u.height is not None else None,
        "weight": float(u.weight) if u.weight is not None else None,
        "fitness_goal": u.fitness_goal,
        "created_at": u.created_at.isoformat(),
        "updated_at": u.updated_at.isoformat(),
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


def _to_targets(raw) -> set[str]:
    if isinstance(raw, str):
        raw_items = [raw]
    elif isinstance(raw, list):
        raw_items = raw
    else:
        raw_items = []
    targets = {str(item).strip().lower() for item in raw_items if str(item).strip()}
    targets = {t for t in targets if t in ALLOWED_DELETE_TARGETS}
    if "all" in targets:
        targets.discard("all")
        targets.update({"workouts", "meals", "trainings", "feedback", "blogs", "comments"})
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


def _remove_avatar_file(user: User) -> None:
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


@bp.get("/profile")
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(_user_public(user))


@bp.put("/profile")
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    for field in ["username", "avatar_url", "gender", "fitness_goal"]:
        if field in data:
            setattr(user, field, (data.get(field) or None))

    for field in ["height", "weight"]:
        if field in data:
            v = data.get(field)
            setattr(user, field, v if v is not None and v != "" else None)

    if "username" in data:
        existing = User.query.filter(User.username == user.username, User.id != user.id).first()
        if existing is not None:
            return jsonify({"error": "username already exists"}), 409

    db.session.commit()
    return jsonify(_user_public(user))


@bp.route("/avatar", methods=["OPTIONS"])
def avatar_options():
    return "", 204


@bp.post("/avatar")
@jwt_required()
def upload_avatar():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    f = request.files.get("file")
    if f is None or not f.filename:
        return jsonify({"error": "file required"}), 400

    def sniff_image_ext() -> Optional[str]:
        try:
            head = f.stream.read(16)
            f.stream.seek(0)
        except Exception:
            return None

        if head.startswith(b"\x89PNG\r\n\x1a\n"):
            return "png"
        if head[:3] == b"\xff\xd8\xff":
            return "jpg"
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            return "webp"
        return None

    filename = secure_filename(f.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mimetype = (getattr(f, "mimetype", "") or "").lower()
    allowed = {"png", "jpg", "jpeg", "webp"}

    if ext not in allowed:
        if mimetype in {"image/jpeg", "image/jpg"}:
            ext = "jpg"
        elif mimetype == "image/png":
            ext = "png"
        elif mimetype == "image/webp":
            ext = "webp"
        else:
            sniffed = sniff_image_ext()
            ext = sniffed or ""

    if ext == "jpeg":
        ext = "jpg"

    if ext not in {"png", "jpg", "webp"}:
        return jsonify({"error": "unsupported file type"}), 400

    upload_root = current_app.config["UPLOAD_FOLDER"]
    subdir = "avatars"
    folder = os.path.join(upload_root, subdir)
    os.makedirs(folder, exist_ok=True)

    new_name = f"{user_id}_{uuid.uuid4().hex}.{ext}"
    path = os.path.join(folder, new_name)
    f.save(path)

    old: Optional[str] = user.avatar_url
    if old and old.startswith("/uploads/avatars/"):
        old_name = old.split("/uploads/avatars/", 1)[1]
        old_path = os.path.join(folder, old_name)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    user.avatar_url = f"/uploads/{subdir}/{new_name}"
    db.session.commit()
    return jsonify({"avatar_url": user.avatar_url})


@bp.get("/blogs")
@jwt_required()
def my_blogs():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)

    q = Blog.query.filter_by(user_id=user_id).order_by(Blog.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": b.id,
                    "title": b.title,
                    "cover_image_url": b.cover_image_url,
                    "is_published": b.is_published,
                    "created_at": b.created_at.isoformat(),
                    "updated_at": b.updated_at.isoformat(),
                }
                for b in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.get("/comments")
@jwt_required()
def my_comments():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)

    q = Comment.query.filter_by(user_id=user_id).order_by(Comment.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": c.id,
                    "blog_id": c.blog_id,
                    "content": c.content,
                    "created_at": c.created_at.isoformat(),
                    "updated_at": c.updated_at.isoformat(),
                }
                for c in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.post("/data-lifecycle/delete")
@jwt_required()
def delete_my_data():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    targets = _to_targets(data.get("targets"))
    if not targets:
        return jsonify({"error": "targets required"}), 400

    dry_run = _to_bool(data.get("dry_run", False))
    before_dt = _parse_before_dt(data)
    if "account" in targets and (data.get("confirm") or "") != "DELETE_MY_ACCOUNT":
        return jsonify({"error": "confirmation phrase required"}), 400

    counts: dict[str, int] = {}

    def apply_time_filter(query, model):
        if before_dt is None:
            return query
        if hasattr(model, "created_at"):
            return query.filter(model.created_at < before_dt)
        return query

    if "workouts" in targets:
        q = apply_time_filter(WorkoutRecord.query.filter_by(user_id=user_id), WorkoutRecord)
        counts["workouts"] = q.count()
        if not dry_run and counts["workouts"]:
            q.delete(synchronize_session=False)

    if "meals" in targets:
        q = apply_time_filter(FoodMealRecord.query.filter_by(user_id=user_id), FoodMealRecord)
        counts["meals"] = q.count()
        if not dry_run and counts["meals"]:
            q.delete(synchronize_session=False)

    if "trainings" in targets:
        q = apply_time_filter(TrainingSession.query.filter_by(user_id=user_id), TrainingSession)
        counts["trainings"] = q.count()
        if not dry_run and counts["trainings"]:
            q.delete(synchronize_session=False)

    if "feedback" in targets:
        q = apply_time_filter(UserFeedback.query.filter_by(user_id=user_id), UserFeedback)
        counts["feedback"] = q.count()
        if not dry_run and counts["feedback"]:
            q.delete(synchronize_session=False)

    if "comments" in targets:
        q = apply_time_filter(Comment.query.filter_by(user_id=user_id), Comment)
        counts["comments"] = q.count()
        if not dry_run and counts["comments"]:
            q.delete(synchronize_session=False)

    if "blogs" in targets:
        q = apply_time_filter(Blog.query.filter_by(user_id=user_id), Blog)
        counts["blogs"] = q.count()
        if not dry_run and counts["blogs"]:
            q.delete(synchronize_session=False)

    if "account" in targets:
        user = db.session.get(User, user_id)
        counts["account"] = 1 if user is not None else 0
        if not dry_run and user is not None:
            _remove_avatar_file(user)
            db.session.delete(user)

    if not dry_run:
        db.session.commit()

    return jsonify(
        {
            "ok": True,
            "dry_run": dry_run,
            "before": before_dt.isoformat() if before_dt else None,
            "targets": sorted(targets),
            "counts": counts,
        }
    )

