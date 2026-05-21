from __future__ import annotations

import json
import os

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from ...extensions import db
from ...models import Blog, BlogLike, BlogView, Comment, CommentLike, Notification, User
from ...utils.audit import record_audit
from ...utils.pagination import parse_pagination
from ...utils.privacy import privacy_hash
from ...utils.upload_access import resolve_upload_file_path
from .lifecycle import _admin_guard

bp = Blueprint("admin_users", __name__)


@bp.get("/users")
@jwt_required()
def list_users():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    page, page_size = parse_pagination(request.args, default_page_size=20, max_page_size=50)

    q = User.query
    query_text = (request.args.get("q") or "").strip()
    if query_text:
        filters = [User.username.ilike(f"%{query_text}%")]
        if "@" in query_text:
            filters.append(User.email_hash == privacy_hash(query_text))
        q = q.filter(or_(*filters))
    admin_filter = _parse_bool_query("is_admin")
    if admin_filter is not None:
        q = q.filter(User.is_admin.is_(admin_filter))
    disabled_filter = _parse_bool_query("is_disabled")
    if disabled_filter is not None:
        q = q.filter(User.is_disabled.is_(disabled_filter))
    total = q.count()
    rows = q.order_by(_sort_expression()).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": row.id,
                    "username": row.username,
                    "email_masked": _mask_email(row.email),
                    "created_at": row.created_at.isoformat(),
                    "is_admin": bool(row.is_admin),
                    "is_disabled": bool(row.is_disabled),
                }
                for row in rows
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.patch("/users/<int:user_id>")
@jwt_required()
def update_user(user_id: int):
    allowed, current_user = _admin_guard()
    if not allowed or current_user is None:
        return jsonify({"error": "forbidden"}), 403

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    if "is_admin" in data:
        next_is_admin = bool(data.get("is_admin"))
        if user.id == current_user.id and not next_is_admin:
            return jsonify({"error": "cannot remove your own admin access"}), 400
        user.is_admin = next_is_admin
        record_audit(
            actor_user_id=current_user.id,
            action="admin.user.set_admin",
            target_type="user",
            target_id=user.id,
            metadata={"is_admin": next_is_admin},
        )

    if "is_disabled" in data:
        next_is_disabled = bool(data.get("is_disabled"))
        if user.id == current_user.id and next_is_disabled:
            return jsonify({"error": "cannot disable your own account"}), 400
        user.is_disabled = next_is_disabled
        record_audit(
            actor_user_id=current_user.id,
            action="admin.user.set_disabled",
            target_type="user",
            target_id=user.id,
            metadata={"is_disabled": next_is_disabled},
        )

    db.session.commit()
    return jsonify(_admin_user_payload(user))


@bp.delete("/users/<int:user_id>")
@jwt_required()
def delete_user(user_id: int):
    allowed, current_user = _admin_guard()
    if not allowed or current_user is None:
        return jsonify({"error": "forbidden"}), 403

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    if user.id == current_user.id:
        return jsonify({"error": "cannot delete your own account"}), 400

    data = request.get_json(silent=True) or {}
    if (data.get("confirm_username") or "") != user.username:
        return jsonify({"error": "confirm_username must match target username"}), 400

    if user.is_admin:
        remaining_admins = User.query.filter(User.is_admin.is_(True), User.id != user.id).count()
        if remaining_admins <= 0:
            return jsonify({"error": "cannot delete the last admin account"}), 400

    upload_paths = _user_upload_file_paths(user)
    _delete_user_associations(user)
    record_audit(
        actor_user_id=current_user.id,
        action="admin.user.delete",
        target_type="user",
        target_id=user.id,
        metadata={"username": user.username},
    )
    db.session.delete(user)
    db.session.commit()
    _remove_upload_files(upload_paths)
    return jsonify({"ok": True})


@bp.get("/users/<int:user_id>/contact")
@jwt_required()
def get_user_contact(user_id: int):
    allowed, current_user = _admin_guard()
    if not allowed or current_user is None:
        return jsonify({"error": "forbidden"}), 403

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    record_audit(
        actor_user_id=current_user.id,
        action="admin.user.reveal_contact",
        target_type="user",
        target_id=user.id,
    )
    db.session.commit()
    return jsonify({"id": user.id, "email": user.email})


def _admin_user_payload(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email_masked": _mask_email(u.email),
        "created_at": u.created_at.isoformat(),
        "is_admin": bool(u.is_admin),
        "is_disabled": bool(u.is_disabled),
    }


def _parse_bool_query(name: str) -> bool | None:
    value = request.args.get(name)
    if value is None or value == "":
        return None
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _sort_expression():
    sort_by = (request.args.get("sort_by") or "id").strip().lower()
    sort_dir = (request.args.get("sort_dir") or "asc").strip().lower()
    sort_fields = {
        "id": User.id,
        "username": User.username,
        "created_at": User.created_at,
        "is_admin": User.is_admin,
        "is_disabled": User.is_disabled,
    }
    column = sort_fields.get(sort_by, User.id)
    return column.desc() if sort_dir == "desc" else column.asc()


def _delete_user_associations(user: User) -> None:
    blog_ids = [row.id for row in db.session.query(Blog.id).filter(Blog.user_id == user.id).all()]
    comment_ids = [row.id for row in db.session.query(Comment.id).filter(Comment.user_id == user.id).all()]

    notification_filters = [
        Notification.recipient_user_id == user.id,
        Notification.actor_user_id == user.id,
    ]
    if blog_ids:
        notification_filters.append(Notification.blog_id.in_(blog_ids))
    if comment_ids:
        notification_filters.append(Notification.comment_id.in_(comment_ids))
        notification_filters.append(Notification.root_comment_id.in_(comment_ids))

    db.session.query(Notification).filter(or_(*notification_filters)).delete(synchronize_session=False)
    db.session.query(BlogLike).filter(BlogLike.user_id == user.id).delete(synchronize_session=False)
    db.session.query(CommentLike).filter(CommentLike.user_id == user.id).delete(synchronize_session=False)
    db.session.query(BlogView).filter(BlogView.viewer_key == f"user:{user.id}").delete(synchronize_session=False)


def _user_upload_file_paths(user: User) -> set[str]:
    urls: set[str] = set()
    if user.avatar_url:
        urls.add(user.avatar_url)

    blogs = Blog.query.filter_by(user_id=user.id).all()
    for blog in blogs:
        if blog.cover_image_url:
            urls.add(blog.cover_image_url)
        for image_url in _blog_image_urls(blog):
            urls.add(image_url)

    paths: set[str] = set()
    for url in urls:
        path = _upload_url_to_file_path(url)
        if path:
            paths.add(path)
    return paths


def _blog_image_urls(blog: Blog) -> list[str]:
    if not blog.image_urls:
        return []
    try:
        parsed = json.loads(blog.image_urls)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if isinstance(item, str) and item.strip()]


def _upload_url_to_file_path(url: str) -> str | None:
    normalized = (url or "").strip()
    if not normalized.startswith("/uploads/"):
        return None
    rel = normalized.removeprefix("/uploads/")
    return resolve_upload_file_path(rel)


def _remove_upload_files(paths: set[str]) -> None:
    for path in paths:
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass


def _mask_email(email: str) -> str:
    local, sep, domain = email.partition("@")
    if not sep:
        return "***"
    if len(local) <= 1:
        masked_local = "*"
    elif len(local) == 2:
        masked_local = f"{local[0]}*"
    else:
        masked_local = f"{local[0]}***{local[-1]}"
    return f"{masked_local}@{domain}"

