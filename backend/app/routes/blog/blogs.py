from __future__ import annotations

from datetime import datetime, time, timedelta
from hashlib import sha256
import json
import re
from typing import Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, load_only, selectinload

from ...extensions import db
from ...models import Blog, BlogLike, BlogTag, BlogView, Tag, User
from ...utils.image_upload import save_public_image_upload
from ...utils.media_url import available_public_media_urls, public_media_url_or_none
from ...utils.pagination import parse_pagination

bp = Blueprint("blogs", __name__)
MIN_BLOG_TITLE_LENGTH = 5
MAX_BLOG_TITLE_LENGTH = 80
MIN_BLOG_CONTENT_LENGTH = 1
MAX_BLOG_CONTENT_LENGTH = 4000
BLOG_TAG_ALIASES = {
    "Diet": ("Diet", "Nutrition", "\u996e\u98df"),
    "Training": ("Training", "Fitness Tips", "Training Plan", "\u8bad\u7ec3"),
    "Record": ("Record", "Log"),
    "Log": ("Record", "Log"),
    "Experience": ("Experience",),
    "Other": ("Other", "Rehab", "\u5176\u5b83"),
}
BLOG_TOPIC_TAGS = {"Diet", "Training"}
BLOG_POST_TYPE_TAGS = {"Record", "Experience"}
BLOG_POST_TYPE_FILTER_TAGS = BLOG_POST_TYPE_TAGS | {"Log"}
BLOG_VISIBILITIES = {"public", "private"}
MAX_BLOG_IMAGES = 9


def _normalize_blog_title(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _normalize_blog_content(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def _validate_blog_text(title: str, content: str):
    if not title or not content:
        return "title/content required"
    if len(title) < MIN_BLOG_TITLE_LENGTH:
        return f"title must be at least {MIN_BLOG_TITLE_LENGTH} characters"
    if len(title) > MAX_BLOG_TITLE_LENGTH:
        return f"title must be at most {MAX_BLOG_TITLE_LENGTH} characters"
    if len(content) < MIN_BLOG_CONTENT_LENGTH:
        return f"content must be at least {MIN_BLOG_CONTENT_LENGTH} character"
    if len(content) > MAX_BLOG_CONTENT_LENGTH:
        return f"content must be at most {MAX_BLOG_CONTENT_LENGTH} characters"
    return None


def _daily_blog_create_limit_error(user_id: int) -> str | None:
    limit = int(current_app.config.get("BLOG_CREATE_DAILY_LIMIT_PER_USER", 10))
    if limit <= 0:
        return None

    today = datetime.utcnow().date()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    count = Blog.query.filter(
        Blog.user_id == user_id,
        Blog.created_at >= start,
        Blog.created_at < end,
    ).count()
    if count >= limit:
        return f"daily blog limit reached: at most {limit} posts per day"
    return None


def _normalize_visibility(value: str | None) -> str:
    visibility = (value or "public").strip().lower()
    return visibility if visibility in BLOG_VISIBILITIES else "public"


def _blog_image_urls(blog: Blog) -> list[str]:
    raw = blog.image_urls
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    urls = [str(item) for item in parsed if isinstance(item, str) and item.strip()][:MAX_BLOG_IMAGES]
    return available_public_media_urls(urls)


def _normalize_image_urls(value) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        return []
    urls: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if text and text not in urls:
            urls.append(text)
        if len(urls) >= MAX_BLOG_IMAGES:
            break
    return urls


def _serialize_image_urls(urls: list[str]) -> str | None:
    return json.dumps(urls) if urls else None


def _is_public_blog(blog: Blog) -> bool:
    return bool(blog.is_published) and blog.moderation_status == "active" and blog.visibility == "public"


def _can_view_non_public_blog(blog: Blog, user_id: Optional[int], user: Optional[User]) -> bool:
    if user_id is None or user is None:
        return False
    if blog.user_id == user_id:
        return True
    if blog.visibility == "private":
        return False
    return bool(user.is_admin)


def _tag_filter_names(values: list[str]) -> set[str]:
    names: set[str] = set()
    for value in values:
        text = (value or "").strip()
        if not text:
            continue
        tag = None
        try:
            tag = db.session.get(Tag, int(text))
        except ValueError:
            names.add(text)
        if tag is not None:
            names.update(BLOG_TAG_ALIASES.get(tag.name, (tag.name,)))
        elif text in BLOG_TAG_ALIASES:
            names.update(BLOG_TAG_ALIASES[text])
    return names


def _validate_blog_tag_selection(tag_ids) -> tuple[list[Tag], str | None]:
    try:
        ids = [int(t) for t in (tag_ids or [])]
    except (TypeError, ValueError):
        return [], "category required"
    if not ids:
        return [], "category required"

    tags = Tag.query.filter(Tag.id.in_(ids)).all()
    names = {"Record" if tag.name == "Log" else tag.name for tag in tags}
    if len(tags) != len(set(ids)):
        return [], "category required"
    if len(names & BLOG_TOPIC_TAGS) != 1:
        return [], "choose one topic"
    if len(names & BLOG_POST_TYPE_TAGS) != 1:
        return [], "choose one post type"
    return tags, None


def _blog_status(blog: Blog) -> str:
    if bool(blog.is_published) and blog.moderation_status == "active":
        return "published"
    if blog.moderation_status == "unpublished":
        return "unpublished"
    return "draft"


def _blog_card(b: Blog):
    image_urls = _blog_image_urls(b)
    cover_image_url = public_media_url_or_none(b.cover_image_url)
    return {
        "id": b.id,
        "title": b.title,
        "cover_image_url": cover_image_url or (image_urls[0] if image_urls else None),
        "image_urls": image_urls,
        "excerpt": (b.content or "")[:160],
        "author": {"id": b.author.id, "username": b.author.username, "avatar_url": public_media_url_or_none(b.author.avatar_url)},
        "view_count": b.view_count,
        "like_count": b.like_count,
        "is_published": b.is_published,
        "status": _blog_status(b),
        "visibility": b.visibility,
        "restore_requested": bool(b.moderation_restore_requested),
        "created_at": b.created_at.isoformat(),
        "updated_at": b.updated_at.isoformat(),
        "tags": [{"id": bt.tag.id, "name": bt.tag.name} for bt in b.tags],
    }


def _is_liked_by_me(blog_id: int, user_id: Optional[int]) -> bool:
    if user_id is None:
        return False
    return BlogLike.query.filter_by(blog_id=blog_id, user_id=user_id).first() is not None


def _viewer_key(user_id: Optional[int]) -> str:
    if user_id is not None:
        return f"user:{user_id}"

    forwarded = (request.headers.get("X-Forwarded-For") or "").split(",", 1)[0].strip()
    ip = forwarded or (request.remote_addr or "unknown")
    agent = request.headers.get("User-Agent") or "unknown"
    digest = sha256(f"{ip}|{agent}".encode("utf-8")).hexdigest()
    return f"anon:{digest}"


def _record_unique_view(blog: Blog, user_id: Optional[int]) -> None:
    view = BlogView(blog_id=blog.id, viewer_key=_viewer_key(user_id))
    db.session.add(view)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return

    blog.view_count += 1
    db.session.commit()


def _jsonify_public(payload: dict, max_age: int = 30):
    response = jsonify(payload)
    response.headers["Cache-Control"] = f"public, max-age={max_age}"
    return response


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

    try:
        cover_image_url = save_public_image_upload(f, "blog_covers")
    except ValueError:
        return jsonify({"error": "unsupported file type"}), 400

    return jsonify({"cover_image_url": cover_image_url})


@bp.get("")
def list_blogs():
    page, page_size = parse_pagination(request.args, default_page_size=12)
    query_text = (request.args.get("q") or "").strip()
    tag_ids = request.args.getlist("tag")
    post_type = (request.args.get("type") or "").strip()
    sort_by = (request.args.get("sort_by") or "created_at").strip()
    sort_dir = (request.args.get("sort_dir") or "desc").strip().lower()

    q = Blog.query.join(Blog.author).filter(Blog.is_published.is_(True), Blog.moderation_status == "active", Blog.visibility == "public")
    if query_text:
        q = q.filter(or_(Blog.title.ilike(f"%{query_text}%"), User.username.ilike(f"%{query_text}%")))
    if tag_ids:
        tag_names = _tag_filter_names(tag_ids)
        if tag_names:
            q = q.filter(Blog.tags.any(BlogTag.tag.has(Tag.name.in_(tag_names))))
        else:
            q = q.filter(Blog.id == -1)
    if post_type:
        post_type_names = _tag_filter_names([post_type])
        if post_type_names & BLOG_POST_TYPE_TAGS:
            q = q.filter(Blog.tags.any(BlogTag.tag.has(Tag.name.in_(post_type_names & BLOG_POST_TYPE_FILTER_TAGS))))
        else:
            q = q.filter(Blog.id == -1)

    total = q.count()
    sort_columns = {
        "created_at": Blog.created_at,
        "updated_at": Blog.updated_at,
        "title": Blog.title,
        "view_count": Blog.view_count,
        "like_count": Blog.like_count,
    }
    sort_column = sort_columns.get(sort_by, Blog.created_at)
    order_expr = sort_column.asc() if sort_dir == "asc" else sort_column.desc()

    id_rows = (
        q.with_entities(Blog.id)
        .order_by(order_expr, Blog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    ids = [row[0] for row in id_rows]
    if not ids:
        return _jsonify_public({"items": [], "page": page, "page_size": page_size, "total": total})

    blogs = (
        Blog.query.options(
            load_only(
                Blog.id,
                Blog.title,
                Blog.content,
                Blog.cover_image_url,
                Blog.image_urls,
                Blog.view_count,
                Blog.like_count,
                Blog.is_published,
                Blog.moderation_status,
                Blog.visibility,
                Blog.moderation_restore_requested,
                Blog.created_at,
                Blog.updated_at,
                Blog.user_id,
            ),
            joinedload(Blog.author).load_only(User.id, User.username, User.avatar_url),
            selectinload(Blog.tags).joinedload(BlogTag.tag),
        )
        .filter(Blog.id.in_(ids))
        .order_by(order_expr, Blog.id.desc())
        .all()
    )

    return _jsonify_public({"items": [_blog_card(b) for b in blogs], "page": page, "page_size": page_size, "total": total})


@bp.get("/<int:blog_id>")
def get_blog(blog_id: int):
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None

    blog = (
        Blog.query.options(
            joinedload(Blog.author).load_only(User.id, User.username, User.avatar_url, User.is_admin),
            selectinload(Blog.tags).joinedload(BlogTag.tag),
        )
        .filter_by(id=blog_id)
        .first()
    )
    if blog is None:
        return jsonify({"error": "not found"}), 404
    is_public = _is_public_blog(blog)
    current_user = db.session.get(User, user_id) if user_id is not None else None
    if not is_public and not _can_view_non_public_blog(blog, user_id, current_user):
        return jsonify({"error": "not found"}), 404

    if is_public and request.args.get("view") == "1":
        _record_unique_view(blog, user_id)

    payload = _blog_card(blog)
    payload["content"] = blog.content
    payload["liked_by_me"] = _is_liked_by_me(blog.id, user_id)
    return jsonify(payload)


@bp.post("")
@jwt_required()
def create_blog():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    limit_error = _daily_blog_create_limit_error(user_id)
    if limit_error:
        return jsonify({"error": limit_error}), 429

    title = _normalize_blog_title(data.get("title") or "")
    content = _normalize_blog_content(data.get("content") or "")
    tag_ids = data.get("tag_ids") or []
    is_published = bool(data.get("is_published", False))
    image_urls = _normalize_image_urls(data.get("image_urls"))
    cover_image_url = (data.get("cover_image_url") or "").strip() or (image_urls[0] if image_urls else None)
    validation_error = _validate_blog_text(title, content)
    if validation_error:
        return jsonify({"error": validation_error}), 400
    tags, tag_error = _validate_blog_tag_selection(tag_ids)
    if tag_error:
        return jsonify({"error": tag_error}), 400

    blog = Blog(
        user_id=user_id,
        title=title,
        content=content,
        cover_image_url=cover_image_url,
        image_urls=_serialize_image_urls(image_urls),
        visibility=_normalize_visibility(data.get("visibility")),
        is_published=is_published,
        moderation_status="active",
        moderation_restore_requested=False,
    )
    db.session.add(blog)
    db.session.flush()

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
    moderation_action = (data.get("moderation_action") or "").strip().lower()
    if moderation_action == "request_restore":
        if blog.moderation_status != "unpublished":
            return jsonify({"error": "only admin-disabled posts can request restore"}), 400
        blog.moderation_restore_requested = True
        db.session.commit()
        return jsonify({"ok": True})

    next_title = blog.title
    next_content = blog.content
    if "title" in data:
        next_title = _normalize_blog_title(data.get("title") or "")
    if "content" in data:
        next_content = _normalize_blog_content(data.get("content") or "")
    validation_error = _validate_blog_text(next_title, next_content)
    if validation_error:
        return jsonify({"error": validation_error}), 400
    blog.title = next_title
    blog.content = next_content
    if "cover_image_url" in data:
        blog.cover_image_url = data.get("cover_image_url") or None
    if "image_urls" in data:
        image_urls = _normalize_image_urls(data.get("image_urls"))
        blog.image_urls = _serialize_image_urls(image_urls)
        if not blog.cover_image_url and image_urls:
            blog.cover_image_url = image_urls[0]
    if "visibility" in data:
        blog.visibility = _normalize_visibility(data.get("visibility"))
    if "is_published" in data:
        next_published = bool(data.get("is_published"))
        if next_published and blog.moderation_status == "unpublished":
            return jsonify({"error": "admin-disabled posts cannot be republished by the author"}), 403
        blog.is_published = next_published
        if not next_published and blog.moderation_status != "unpublished":
            blog.moderation_status = "active"
            blog.moderation_restore_requested = False
    if "tag_ids" in data:
        tags, tag_error = _validate_blog_tag_selection(data.get("tag_ids"))
        if tag_error:
            return jsonify({"error": tag_error}), 400
        BlogTag.query.filter_by(blog_id=blog.id).delete()
        for t in tags:
            db.session.add(BlogTag(blog_id=blog.id, tag_id=t.id))

    if blog.moderation_status == "unpublished":
        blog.moderation_restore_requested = False

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
    if blog is None or not _is_public_blog(blog):
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
