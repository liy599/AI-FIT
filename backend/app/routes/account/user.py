import json
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload

from ...extensions import db
from ...models import Blog, Comment, Notification, User
from ...services.account.data_lifecycle import delete_user_data, remove_user_avatar_file
from ...utils.image_upload import save_public_image_upload
from ...utils.pagination import parse_pagination

bp = Blueprint("user", __name__)


def _blog_image_urls(blog: Blog) -> list[str]:
    if not blog.image_urls:
        return []
    try:
        parsed = json.loads(blog.image_urls)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if isinstance(item, str) and item.strip()][:9]


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

    try:
        avatar_url = save_public_image_upload(f, "avatars", filename_prefix=str(user_id))
    except ValueError:
        return jsonify({"error": "unsupported file type"}), 400

    old: Optional[str] = user.avatar_url
    if old and old.startswith("/uploads/avatars/"):
        remove_user_avatar_file(user)

    user.avatar_url = avatar_url
    db.session.commit()
    return jsonify({"avatar_url": user.avatar_url})


@bp.get("/blogs")
@jwt_required()
def my_blogs():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)
    query_text = (request.args.get("q") or "").strip()
    status = (request.args.get("status") or "all").strip().lower()
    sort_by = (request.args.get("sort_by") or "updated_at").strip()
    sort_dir = (request.args.get("sort_dir") or "desc").strip().lower()

    q = Blog.query.filter_by(user_id=user_id)
    if query_text:
        q = q.filter(or_(Blog.title.ilike(f"%{query_text}%"), Blog.content.ilike(f"%{query_text}%")))
    if status == "published":
        q = q.filter(Blog.is_published.is_(True), Blog.moderation_status == "active")
    elif status == "draft":
        q = q.filter(Blog.is_published.is_(False), Blog.moderation_status != "unpublished")
    elif status == "unpublished":
        q = q.filter(Blog.moderation_status == "unpublished")

    sort_columns = {
        "created_at": Blog.created_at,
        "updated_at": Blog.updated_at,
        "title": Blog.title,
    }
    sort_column = sort_columns.get(sort_by, Blog.updated_at)
    order_expr = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    q = q.order_by(order_expr, Blog.id.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": b.id,
                    "title": b.title,
                    "cover_image_url": b.cover_image_url or (_blog_image_urls(b)[0] if _blog_image_urls(b) else None),
                    "image_urls": _blog_image_urls(b),
                    "excerpt": (b.content or "")[:160],
                    "is_published": b.is_published,
                    "status": _blog_status(b),
                    "visibility": b.visibility,
                    "restore_requested": bool(b.moderation_restore_requested),
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


def _blog_status(blog: Blog) -> str:
    if bool(blog.is_published) and blog.moderation_status == "active":
        return "published"
    if blog.moderation_status == "unpublished":
        return "unpublished"
    return "draft"


@bp.get("/comments")
@jwt_required()
def my_comments():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)
    query_text = (request.args.get("q") or "").strip()
    sort_by = (request.args.get("sort_by") or "latest_comment").strip()
    sort_dir = (request.args.get("sort_dir") or "desc").strip().lower()

    q = Comment.query.options(joinedload(Comment.blog)).filter_by(user_id=user_id)
    if query_text:
        q = q.join(Blog).filter(or_(Comment.content.ilike(f"%{query_text}%"), Blog.title.ilike(f"%{query_text}%")))
    comments = q.order_by(Comment.created_at.desc(), Comment.id.desc()).all()

    grouped = {}
    for c in comments:
        blog = c.blog
        if blog is None:
            continue
        entry = grouped.setdefault(
            blog.id,
            {
                "blog": {
                    "id": blog.id,
                    "title": blog.title,
                    "cover_image_url": blog.cover_image_url,
                    "is_published": blog.is_published,
                    "updated_at": blog.updated_at.isoformat(),
                },
                "comments": [],
                "comment_count": 0,
                "latest_comment_at": c.created_at,
            },
        )
        entry["comments"].append(
            {
                "id": c.id,
                "blog_id": c.blog_id,
                "content": c.content,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
        )
        entry["comment_count"] += 1
        if c.created_at > entry["latest_comment_at"]:
            entry["latest_comment_at"] = c.created_at

    groups = list(grouped.values())
    reverse = sort_dir != "asc"
    if sort_by == "title":
        groups.sort(key=lambda item: item["blog"]["title"].lower(), reverse=reverse)
    elif sort_by == "comment_count":
        groups.sort(key=lambda item: item["comment_count"], reverse=reverse)
    else:
        groups.sort(key=lambda item: item["latest_comment_at"], reverse=reverse)

    total = len(groups)
    items = groups[(page - 1) * page_size : page * page_size]

    return jsonify(
        {
            "items": [
                {
                    **item,
                    "latest_comment_at": item["latest_comment_at"].isoformat(),
                }
                for item in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


def _comment_page_for_root(root: Comment, page_size: int = 10) -> int:
    preceding = Comment.query.filter(
        Comment.blog_id == root.blog_id,
        Comment.parent_id.is_(None),
        or_(Comment.created_at < root.created_at, and_(Comment.created_at == root.created_at, Comment.id <= root.id)),
    ).count()
    return max(1, (max(1, preceding) - 1) // page_size + 1)


def _notification_public(notification: Notification):
    actor = notification.actor
    blog = notification.blog
    root = notification.root_comment
    return {
        "id": notification.id,
        "type": notification.type,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
        "actor": {
            "id": actor.id,
            "username": actor.username,
            "avatar_url": actor.avatar_url,
        },
        "blog": {
            "id": blog.id,
            "title": blog.title,
        },
        "comment_id": notification.comment_id,
        "root_comment_id": notification.root_comment_id,
        "comment_page": _comment_page_for_root(root) if root is not None else 1,
    }


@bp.get("/notifications")
@jwt_required()
def my_notifications():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)
    q = (
        Notification.query.options(
            joinedload(Notification.actor),
            joinedload(Notification.blog),
            joinedload(Notification.root_comment),
        )
        .filter_by(recipient_user_id=user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    )
    total = q.count()
    unread_count = Notification.query.filter_by(recipient_user_id=user_id, is_read=False).count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        {
            "items": [_notification_public(item) for item in items],
            "page": page,
            "page_size": page_size,
            "total": total,
            "unread_count": unread_count,
        }
    )


@bp.post("/notifications/<int:notification_id>/read")
@jwt_required()
def mark_notification_read(notification_id: int):
    user_id = int(get_jwt_identity())
    notification = Notification.query.filter_by(id=notification_id, recipient_user_id=user_id).first()
    if notification is None:
        return jsonify({"error": "not found"}), 404
    notification.is_read = True
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/data-lifecycle/delete")
@jwt_required()
def delete_my_data():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    payload, status = delete_user_data(user_id, data)
    return jsonify(payload), status

