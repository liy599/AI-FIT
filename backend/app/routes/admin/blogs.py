from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload

from ...extensions import db
from ...models import Blog, BlogTag, User
from ...utils.pagination import parse_pagination
from .lifecycle import _admin_guard

bp = Blueprint("admin_blogs", __name__)


@bp.get("/blogs")
@jwt_required()
def list_blogs():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    page, page_size = parse_pagination(request.args, default_page_size=20, max_page_size=50)
    query_text = (request.args.get("q") or "").strip()
    status_filter = (request.args.get("status") or "").strip().lower()

    q = Blog.query.join(User, Blog.user_id == User.id).filter(Blog.visibility == "public")
    if query_text:
        q = q.filter(or_(Blog.title.ilike(f"%{query_text}%"), User.username.ilike(f"%{query_text}%")))
    if status_filter == "published":
        q = q.filter(Blog.is_published.is_(True), Blog.moderation_status == "active")
    elif status_filter == "unpublished":
        q = q.filter(Blog.moderation_status == "unpublished")
    elif status_filter == "restore_requested":
        q = q.filter(Blog.moderation_status == "unpublished", Blog.moderation_restore_requested.is_(True))
    elif status_filter == "draft":
        q = q.filter(Blog.is_published.is_(False), Blog.moderation_status != "unpublished")

    total = q.count()
    sort_expression = _sort_expression()
    id_rows = (
        q.with_entities(Blog.id)
        .order_by(sort_expression)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    ids = [row[0] for row in id_rows]
    if not ids:
        return jsonify({"items": [], "page": page, "page_size": page_size, "total": total})

    blogs = (
        Blog.query.options(joinedload(Blog.author), selectinload(Blog.tags).joinedload(BlogTag.tag))
        .filter(Blog.id.in_(ids))
        .order_by(sort_expression)
        .all()
    )

    return jsonify({"items": [_admin_blog_payload(blog) for blog in blogs], "page": page, "page_size": page_size, "total": total})


@bp.patch("/blogs/<int:blog_id>")
@jwt_required()
def update_blog(blog_id: int):
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    blog = db.session.get(Blog, blog_id)
    if blog is None or blog.visibility == "private":
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    action = (data.get("action") or "").strip().lower()
    if not action and "is_published" in data:
        action = "restore" if bool(data.get("is_published")) else "unpublish"

    if action == "unpublish":
        if not blog.is_published or blog.moderation_status != "active":
            return jsonify({"error": "only published posts can be unpublished"}), 400
        blog.is_published = False
        blog.moderation_status = "unpublished"
        blog.moderation_restore_requested = False
    elif action == "restore":
        if blog.moderation_status != "unpublished":
            return jsonify({"error": "only admin-unpublished posts can be restored"}), 400
        blog.is_published = True
        blog.moderation_status = "active"
        blog.moderation_restore_requested = False
    else:
        return jsonify({"error": "action required"}), 400
    db.session.commit()

    blog = (
        Blog.query.options(joinedload(Blog.author), selectinload(Blog.tags).joinedload(BlogTag.tag))
        .filter_by(id=blog_id)
        .first()
    )
    return jsonify(_admin_blog_payload(blog))


@bp.delete("/blogs/<int:blog_id>")
@jwt_required()
def delete_blog(blog_id: int):
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    blog = db.session.get(Blog, blog_id)
    if blog is None or blog.visibility == "private":
        return jsonify({"error": "not found"}), 404
    db.session.delete(blog)
    db.session.commit()
    return jsonify({"ok": True})


def _admin_blog_payload(blog: Blog):
    status = _admin_blog_status(blog)
    return {
        "id": blog.id,
        "title": blog.title,
        "excerpt": (blog.content or "")[:160],
        "cover_image_url": blog.cover_image_url,
        "author": {"id": blog.author.id, "username": blog.author.username},
        "view_count": blog.view_count,
        "like_count": blog.like_count,
        "is_published": bool(blog.is_published),
        "status": status,
        "visibility": blog.visibility,
        "restore_requested": bool(blog.moderation_restore_requested),
        "created_at": blog.created_at.isoformat(),
        "updated_at": blog.updated_at.isoformat(),
        "tags": [{"id": bt.tag.id, "name": bt.tag.name} for bt in blog.tags],
    }


def _admin_blog_status(blog: Blog) -> str:
    if bool(blog.is_published) and blog.moderation_status == "active":
        return "published"
    if blog.moderation_status == "unpublished":
        return "unpublished"
    return "draft"


def _sort_expression():
    sort_by = (request.args.get("sort_by") or "id").strip().lower()
    sort_dir = (request.args.get("sort_dir") or "asc").strip().lower()
    sort_fields = {
        "id": Blog.id,
        "title": Blog.title,
        "author": User.username,
        "created_at": Blog.created_at,
        "updated_at": Blog.updated_at,
        "view_count": Blog.view_count,
        "like_count": Blog.like_count,
        "is_published": Blog.is_published,
    }
    column = sort_fields.get(sort_by, Blog.id)
    return column.desc() if sort_dir == "desc" else column.asc()
