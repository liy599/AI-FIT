import os
import uuid
from typing import Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Blog, BlogLike, BlogTag, Tag, User
from ..utils.pagination import parse_pagination

bp = Blueprint("blogs", __name__)


def _blog_card(b: Blog):
    return {
        "id": b.id,
        "title": b.title,
        "cover_image_url": b.cover_image_url,
        "excerpt": (b.content or "")[:160],
        "author": {"id": b.author.id, "username": b.author.username, "avatar_url": b.author.avatar_url},
        "view_count": b.view_count,
        "like_count": b.like_count,
        "is_published": b.is_published,
        "created_at": b.created_at.isoformat(),
        "updated_at": b.updated_at.isoformat(),
        "tags": [{"id": bt.tag.id, "name": bt.tag.name} for bt in b.tags],
    }


def _is_liked_by_me(blog_id: int, user_id: Optional[int]) -> bool:
    if user_id is None:
        return False
    return BlogLike.query.filter_by(blog_id=blog_id, user_id=user_id).first() is not None


@bp.route("/cover", methods=["OPTIONS"])
def cover_options():
    return "", 204


@bp.post("/cover")
@jwt_required()
def upload_cover():
    user_id = int(get_jwt_identity())
    _ = user_id

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
    subdir = "blog_covers"
    folder = os.path.join(upload_root, subdir)
    os.makedirs(folder, exist_ok=True)

    new_name = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(folder, new_name)
    f.save(path)

    return jsonify({"cover_image_url": f"/uploads/{subdir}/{new_name}"})


@bp.get("")
def list_blogs():
    page, page_size = parse_pagination(request.args, default_page_size=12)
    query_text = (request.args.get("q") or "").strip()
    tag_ids = request.args.getlist("tag")

    q = Blog.query.filter(Blog.is_published.is_(True))
    if query_text:
        q = q.filter(or_(Blog.title.ilike(f"%{query_text}%"), Blog.content.ilike(f"%{query_text}%")))
    if tag_ids:
        q = q.filter(Blog.tags.any(BlogTag.tag_id.in_([int(t) for t in tag_ids])))

    total = q.count()

    id_rows = (
        q.with_entities(Blog.id)
        .order_by(Blog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    ids = [row[0] for row in id_rows]
    if not ids:
        return jsonify({"items": [], "page": page, "page_size": page_size, "total": total})

    blogs = (
        Blog.query.options(
            joinedload(Blog.author),
            selectinload(Blog.tags).joinedload(BlogTag.tag),
        )
        .filter(Blog.id.in_(ids))
        .order_by(Blog.created_at.desc())
        .all()
    )

    return jsonify({"items": [_blog_card(b) for b in blogs], "page": page, "page_size": page_size, "total": total})


@bp.get("/<int:blog_id>")
def get_blog(blog_id: int):
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None

    blog = db.session.get(Blog, blog_id)
    if blog is None or not blog.is_published:
        return jsonify({"error": "not found"}), 404

    blog.view_count += 1
    db.session.commit()

    payload = _blog_card(blog)
    payload["content"] = blog.content
    payload["liked_by_me"] = _is_liked_by_me(blog.id, user_id)
    return jsonify(payload)


@bp.post("")
@jwt_required()
def create_blog():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    content = data.get("content") or ""
    tag_ids = data.get("tag_ids") or []
    is_published = bool(data.get("is_published", False))
    if not title or not content:
        return jsonify({"error": "title/content required"}), 400

    blog = Blog(
        user_id=user_id,
        title=title,
        content=content,
        cover_image_url=data.get("cover_image_url"),
        is_published=is_published,
    )
    db.session.add(blog)
    db.session.flush()

    if tag_ids:
        tags = Tag.query.filter(Tag.id.in_([int(t) for t in tag_ids])).all()
        for t in tags:
            db.session.add(BlogTag(blog_id=blog.id, tag_id=t.id))

    db.session.commit()
    return jsonify({"id": blog.id}), 201


@bp.put("/<int:blog_id>")
@jwt_required()
def update_blog(blog_id: int):
    user_id = int(get_jwt_identity())
    blog = db.session.get(Blog, blog_id)
    if blog is None:
        return jsonify({"error": "not found"}), 404
    if blog.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title required"}), 400
        blog.title = title
    if "content" in data:
        content = data.get("content") or ""
        if not content:
            return jsonify({"error": "content required"}), 400
        blog.content = content
    if "cover_image_url" in data:
        blog.cover_image_url = data.get("cover_image_url") or None
    if "is_published" in data:
        blog.is_published = bool(data.get("is_published"))
    if "tag_ids" in data:
        tag_ids = [int(t) for t in (data.get("tag_ids") or [])]
        BlogTag.query.filter_by(blog_id=blog.id).delete()
        if tag_ids:
            tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
            for t in tags:
                db.session.add(BlogTag(blog_id=blog.id, tag_id=t.id))

    db.session.commit()
    return jsonify({"ok": True})


@bp.delete("/<int:blog_id>")
@jwt_required()
def delete_blog(blog_id: int):
    user_id = int(get_jwt_identity())
    blog = db.session.get(Blog, blog_id)
    if blog is None:
        return jsonify({"error": "not found"}), 404
    if blog.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    db.session.delete(blog)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/<int:blog_id>/like")
@jwt_required()
def toggle_blog_like(blog_id: int):
    user_id = int(get_jwt_identity())
    blog = db.session.get(Blog, blog_id)
    if blog is None or not blog.is_published:
        return jsonify({"error": "not found"}), 404

    like = BlogLike.query.filter_by(blog_id=blog_id, user_id=user_id).first()
    if like is None:
        db.session.add(BlogLike(blog_id=blog_id, user_id=user_id))
        blog.like_count += 1
        liked = True
    else:
        db.session.delete(like)
        blog.like_count = max(0, blog.like_count - 1)
        liked = False

    db.session.commit()
    return jsonify({"liked": liked, "like_count": blog.like_count})
