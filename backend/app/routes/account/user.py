import json
import os
import re
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, unset_jwt_cookies
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload, load_only

from ...extensions import db
from ...models import Blog, Comment, Notification, User
from ...utils.image_upload import save_public_image_upload
from ...utils.media_url import available_public_media_urls, public_media_url_or_none, public_media_variant_url_or_none
from ...utils.pagination import cursor_datetime, decode_cursor, encode_cursor, parse_pagination
from ...utils.upload_access import resolve_upload_file_path
from ..admin.users import _delete_user_associations, _remove_upload_files, _user_upload_file_paths

bp = Blueprint("user", __name__)

_USERNAME_RE = re.compile(r"^\S+$")
_ALLOWED_GENDERS = {"Male", "Female", "Other"}
_ALLOWED_FITNESS_GOALS = {"Build Muscle", "Lose Fat", "Stay Healthy"}


def _validate_username(username: str) -> Optional[str]:
    text = (username or "").strip()
    if len(text) < 3 or len(text) > 15:
        return "username length must be 3-15"
    if _USERNAME_RE.fullmatch(text) is None:
        return "username cannot contain whitespace"
    return None


def _parse_number(value, *, field: str, min_value: float, max_value: float) -> tuple[Optional[float], Optional[str]]:
    if value is None or value == "":
        return None, None
    try:
        num = float(value)
    except Exception:
        return None, f"invalid {field}"
    if not (min_value <= num <= max_value):
        return None, f"invalid {field}"
    return num, None


def _blog_image_urls(blog: Blog) -> list[str]:
    if not blog.image_urls:
        return []
    try:
        parsed = json.loads(blog.image_urls)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    urls = [str(item) for item in parsed if isinstance(item, str) and item.strip()][:9]
    return available_public_media_urls(urls)


def _blog_list_image_payload(blog: Blog) -> tuple[str | None, list[str]]:
    image_urls = _blog_image_urls(blog)
    display_urls = [public_media_variant_url_or_none(url, "list") or url for url in image_urls]
    cover_url = public_media_variant_url_or_none(blog.cover_image_url, "list") or (display_urls[0] if display_urls else None)
    return cover_url, display_urls


def _coerce_blog_cursor_value(sort_by: str, value):
    if sort_by in {"created_at", "updated_at"}:
        return cursor_datetime(value)
    return str(value) if value is not None else None


def _apply_my_blog_cursor(query, column, *, sort_by: str, sort_dir: str, cursor: dict | None):
    if not cursor:
        return query
    value = _coerce_blog_cursor_value(sort_by, cursor.get("value"))
    try:
        cursor_id = int(cursor.get("id"))
    except (TypeError, ValueError):
        cursor_id = None
    if value is None or cursor_id is None:
        return query
    if sort_dir == "asc":
        return query.filter(or_(column > value, and_(column == value, Blog.id < cursor_id)))
    return query.filter(or_(column < value, and_(column == value, Blog.id < cursor_id)))


def _my_blog_excerpt(content: str | None) -> str:
    lines = [
        " ".join(line.split())
        for line in (content or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    lines = [line for line in lines if line]
    if not lines:
        return ""
    return "\n".join(line[:120] for line in lines[:2])


def _user_public(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "avatar_url": public_media_url_or_none(u.avatar_url),
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
    if "username" in data:
        next_username = (data.get("username") or "").strip()
        if not next_username:
            return jsonify({"error": "username required"}), 400
        username_err = _validate_username(next_username)
        if username_err:
            return jsonify({"error": username_err}), 400
        existing = User.query.filter(User.username == next_username, User.id != user.id).first()
        if existing is not None:
            return jsonify({"error": "username already exists"}), 409
        user.username = next_username

    if "avatar_url" in data:
        user.avatar_url = (data.get("avatar_url") or None)

    if "gender" in data:
        gender = (data.get("gender") or "").strip()
        user.gender = None if not gender else (gender if gender in _ALLOWED_GENDERS else None)
        if gender and user.gender is None:
            return jsonify({"error": "invalid gender"}), 400

    if "fitness_goal" in data:
        goal = (data.get("fitness_goal") or "").strip()
        user.fitness_goal = None if not goal else (goal if goal in _ALLOWED_FITNESS_GOALS else None)
        if goal and user.fitness_goal is None:
            return jsonify({"error": "invalid fitness_goal"}), 400

    if "height" in data:
        num, err = _parse_number(data.get("height"), field="height", min_value=100, max_value=250)
        if err:
            return jsonify({"error": err}), 400
        user.height = num

    if "weight" in data:
        num, err = _parse_number(data.get("weight"), field="weight", min_value=30, max_value=250)
        if err:
            return jsonify({"error": err}), 400
        user.weight = num

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
    cursor = decode_cursor(request.args.get("cursor"))
    query_text = (request.args.get("q") or "").strip()
    status = (request.args.get("status") or "all").strip().lower()
    sort_by = (request.args.get("sort_by") or "updated_at").strip()
    sort_dir = (request.args.get("sort_dir") or "desc").strip().lower()

    q = Blog.query.filter_by(user_id=user_id)
    if query_text:
        q = q.filter(Blog.title.ilike(f"%{query_text}%"))
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
    q = _apply_my_blog_cursor(q, sort_column, sort_by=sort_by, sort_dir=sort_dir, cursor=cursor).order_by(order_expr, Blog.id.desc())
    total = None if cursor else q.count()
    items = q.limit(page_size + 1).all() if cursor else q.offset((page - 1) * page_size).limit(page_size).all()
    has_more = len(items) > page_size
    items = items[:page_size]
    last_item = items[-1] if has_more and items else None
    last_value = getattr(last_item, sort_by, None) if last_item is not None else None
    if hasattr(last_value, "isoformat"):
        last_value = last_value.isoformat()
    next_cursor = encode_cursor({"sort_by": sort_by, "value": last_value, "id": last_item.id}) if last_item is not None else None

    return jsonify(
        {
            "items": [
                {
                    "id": b.id,
                    "title": b.title,
                    "cover_image_url": cover_image_url,
                    "image_urls": image_urls,
                    "excerpt": _my_blog_excerpt(b.content),
                    "is_published": b.is_published,
                    "status": _blog_status(b),
                    "visibility": b.visibility,
                    "restore_requested": bool(b.moderation_restore_requested),
                    "created_at": b.created_at.isoformat(),
                    "updated_at": b.updated_at.isoformat(),
                }
                for b in items
                for cover_image_url, image_urls in [_blog_list_image_payload(b)]
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
            "next_cursor": next_cursor,
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
    cursor = decode_cursor(request.args.get("cursor"))
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

    reverse = sort_dir != "asc"
    if sort_by == "title":
        order_expr = Blog.title.desc() if reverse else Blog.title.asc()
    elif sort_by == "comment_count":
        order_expr = func.count(Comment.id).desc() if reverse else func.count(Comment.id).asc()
    else:
        order_expr = func.max(Comment.created_at).desc() if reverse else func.max(Comment.created_at).asc()
    if cursor:
        try:
            cursor_id = int(cursor.get("id"))
        except (TypeError, ValueError):
            cursor_id = None
        value = cursor.get("value")
        if cursor_id is not None:
            if sort_by == "title" and isinstance(value, str):
                q = q.filter(or_(Blog.title > value, and_(Blog.title == value, Blog.id < cursor_id)) if not reverse else or_(Blog.title < value, and_(Blog.title == value, Blog.id < cursor_id)))
            elif sort_by == "comment_count":
                try:
                    count_value = int(value)
                except (TypeError, ValueError):
                    count_value = None
                if count_value is not None:
                    count_expr = func.count(Comment.id)
                    q = q.having(or_(count_expr > count_value, and_(count_expr == count_value, Blog.id < cursor_id)) if not reverse else or_(count_expr < count_value, and_(count_expr == count_value, Blog.id < cursor_id)))
            else:
                dt_value = cursor_datetime(value)
                if dt_value is not None:
                    latest_expr = func.max(Comment.created_at)
                    q = q.having(or_(latest_expr > dt_value, and_(latest_expr == dt_value, Blog.id < cursor_id)) if not reverse else or_(latest_expr < dt_value, and_(latest_expr == dt_value, Blog.id < cursor_id)))

    total = None if cursor else (db.session.query(func.count()).select_from(q.subquery()).scalar() or 0)
    rows = q.order_by(order_expr, Blog.id.desc()).limit(page_size + 1).all() if cursor else q.order_by(order_expr, Blog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    has_more = len(rows) > page_size
    rows = rows[:page_size]
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
                    "cover_image_url": public_media_variant_url_or_none(row.cover_image_url, "list"),
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

    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        if sort_by == "title":
            cursor_value = last.blog_title
        elif sort_by == "comment_count":
            cursor_value = int(last.comment_count)
        else:
            cursor_value = last.latest_comment_at.isoformat()
        next_cursor = encode_cursor({"sort_by": sort_by, "value": cursor_value, "id": last.blog_id})

    return jsonify({"items": items, "page": page, "page_size": page_size, "total": total, "next_cursor": next_cursor})


def _comment_page_for_root(root: Comment, page_size: int = 10) -> int:
    preceding = Comment.query.filter(
        Comment.blog_id == root.blog_id,
        Comment.parent_id.is_(None),
        or_(Comment.created_at < root.created_at, and_(Comment.created_at == root.created_at, Comment.id <= root.id)),
    ).count()
    return max(1, (max(1, preceding) - 1) // page_size + 1)


def _comment_pages_for_roots(roots: list[Comment], page_size: int = 10) -> dict[int, int]:
    root_ids = [root.id for root in roots if root is not None]
    blog_ids = sorted({root.blog_id for root in roots if root is not None})
    if not root_ids or not blog_ids:
        return {}

    ranked = (
        db.session.query(
            Comment.id.label("id"),
            func.row_number()
            .over(partition_by=Comment.blog_id, order_by=(Comment.created_at.asc(), Comment.id.asc()))
            .label("position"),
        )
        .filter(Comment.blog_id.in_(blog_ids), Comment.parent_id.is_(None))
        .subquery()
    )
    rows = db.session.query(ranked.c.id, ranked.c.position).filter(ranked.c.id.in_(root_ids)).all()
    return {
        int(comment_id): max(1, (max(1, int(position)) - 1) // page_size + 1)
        for comment_id, position in rows
    }


def _notification_public(notification: Notification, comment_pages: dict[int, int] | None = None):
    actor = notification.actor
    blog = notification.blog
    root = notification.root_comment
    comment_page = comment_pages.get(root.id, 1) if comment_pages is not None and root is not None else None
    return {
        "id": notification.id,
        "type": notification.type,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
        "actor": {
            "id": actor.id,
            "username": actor.username,
            "avatar_url": public_media_url_or_none(actor.avatar_url),
        },
        "blog": {
            "id": blog.id,
            "title": blog.title,
        },
        "comment_id": notification.comment_id,
        "root_comment_id": notification.root_comment_id,
        "comment_page": comment_page if comment_page is not None else (_comment_page_for_root(root) if root is not None else 1),
    }


@bp.get("/notifications")
@jwt_required()
def my_notifications():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)
    cursor = decode_cursor(request.args.get("cursor"))
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
    )
    if cursor:
        cursor_created_at = cursor_datetime(cursor.get("created_at"))
        try:
            cursor_id = int(cursor.get("id"))
        except (TypeError, ValueError):
            cursor_id = None
        if cursor_created_at is not None and cursor_id is not None:
            q = q.filter(or_(Notification.created_at < cursor_created_at, and_(Notification.created_at == cursor_created_at, Notification.id < cursor_id)))
    q = q.order_by(Notification.created_at.desc(), Notification.id.desc())
    total = None if cursor else q.count()
    unread_count = Notification.query.filter_by(recipient_user_id=user_id, is_read=False).count()
    items = q.limit(page_size + 1).all() if cursor else q.offset((page - 1) * page_size).limit(page_size).all()
    has_more = len(items) > page_size
    items = items[:page_size]
    comment_pages = _comment_pages_for_roots([item.root_comment for item in items if item.root_comment is not None])
    next_cursor = (
        encode_cursor({"created_at": items[-1].created_at.isoformat(), "id": items[-1].id})
        if has_more and items
        else None
    )
    return jsonify(
        {
            "items": [_notification_public(item, comment_pages) for item in items],
            "page": page,
            "page_size": page_size,
            "total": total,
            "unread_count": unread_count,
            "next_cursor": next_cursor,
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
