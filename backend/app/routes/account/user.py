import json
import os
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, unset_jwt_cookies
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload, load_only

from ...extensions import db
from ...models import Blog, Comment, Notification, User
from ...utils.upload_access import resolve_upload_file_path
from ...utils.image_upload import save_public_image_upload
from ...utils.pagination import parse_pagination
from ..admin.users import _delete_user_associations, _remove_upload_files, _user_upload_file_paths

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


@bp.delete("/account")
@jwt_required()
def delete_account():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    if (data.get("confirm_username") or "") != user.username:
        return jsonify({"error": "confirm_username must match your username"}), 400

    if user.is_admin:
        remaining_admins = User.query.filter(User.is_admin.is_(True), User.id != user.id).count()
        if remaining_admins <= 0:
            return jsonify({"error": "cannot delete the last admin account"}), 400

    upload_paths = _user_upload_file_paths(user)
    _delete_user_associations(user)
    db.session.delete(user)
    db.session.commit()
    _remove_upload_files(upload_paths)

    response = jsonify({"ok": True})
    unset_jwt_cookies(response)
    return response


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

    q = (
        db.session.query(
            Blog.id.label("blog_id"),
            Blog.title.label("blog_title"),
            Blog.cover_image_url.label("cover_image_url"),
            Blog.is_published.label("is_published"),
            Blog.moderation_status.label("moderation_status"),
            Blog.updated_at.label("blog_updated_at"),
            func.count(Comment.id).label("comment_count"),
            func.max(Comment.created_at).label("latest_comment_at"),
        )
        .join(Comment, Comment.blog_id == Blog.id)
        .filter(Comment.user_id == user_id)
        .group_by(Blog.id, Blog.title, Blog.cover_image_url, Blog.is_published, Blog.moderation_status, Blog.updated_at)
    )
    if query_text:
        q = q.filter(or_(Comment.content.ilike(f"%{query_text}%"), Blog.title.ilike(f"%{query_text}%")))

    total = db.session.query(func.count()).select_from(q.subquery()).scalar() or 0
    reverse = sort_dir != "asc"
    if sort_by == "title":
        order_expr = Blog.title.desc() if reverse else Blog.title.asc()
    elif sort_by == "comment_count":
        order_expr = func.count(Comment.id).desc() if reverse else func.count(Comment.id).asc()
    else:
        order_expr = func.max(Comment.created_at).desc() if reverse else func.max(Comment.created_at).asc()
    rows = q.order_by(order_expr, Blog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    blog_ids = [row.blog_id for row in rows]

    comments_by_blog: dict[int, list[Comment]] = {blog_id: [] for blog_id in blog_ids}
    if blog_ids:
        comments = (
            Comment.query.options(
                load_only(Comment.id, Comment.blog_id, Comment.content, Comment.created_at, Comment.updated_at)
            )
            .filter(Comment.user_id == user_id, Comment.blog_id.in_(blog_ids))
            .order_by(Comment.blog_id.asc(), Comment.created_at.desc(), Comment.id.desc())
            .all()
        )
        for comment in comments:
            comments_by_blog.setdefault(comment.blog_id, []).append(comment)

    items = []
    for row in rows:
        item_comments = comments_by_blog.get(row.blog_id, [])
        status = "published" if bool(row.is_published) and row.moderation_status == "active" else "unpublished"
        if not bool(row.is_published) and row.moderation_status != "unpublished":
            status = "draft"
        items.append(
            {
                "blog": {
                    "id": row.blog_id,
                    "title": row.blog_title,
                    "cover_image_url": row.cover_image_url,
                    "is_published": bool(row.is_published),
                    "status": status,
                    "updated_at": row.blog_updated_at.isoformat(),
                },
                "comments": [
                    {
                        "id": c.id,
                        "blog_id": c.blog_id,
                        "content": c.content,
                        "created_at": c.created_at.isoformat(),
                        "updated_at": c.updated_at.isoformat(),
                    }
                    for c in item_comments
                ],
                "comment_count": int(row.comment_count),
                "latest_comment_at": row.latest_comment_at.isoformat(),
            }
        )

    return jsonify({"items": items, "page": page, "page_size": page_size, "total": total})


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
            load_only(
                Notification.id,
                Notification.type,
                Notification.is_read,
                Notification.created_at,
                Notification.comment_id,
                Notification.root_comment_id,
            ),
            joinedload(Notification.actor).load_only(User.id, User.username, User.avatar_url),
            joinedload(Notification.blog).load_only(Blog.id, Blog.title),
            joinedload(Notification.root_comment).load_only(Comment.id, Comment.blog_id, Comment.created_at),
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


@bp.delete("/notifications/<int:notification_id>")
@jwt_required()
def delete_notification(notification_id: int):
    user_id = int(get_jwt_identity())
    notification = Notification.query.filter_by(id=notification_id, recipient_user_id=user_id).first()
    if notification is None:
        return jsonify({"error": "not found"}), 404
    db.session.delete(notification)
    db.session.commit()
    return jsonify({"ok": True})
