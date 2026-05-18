from collections import defaultdict
import re
from typing import Dict, List, Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy.orm import joinedload

from ...extensions import db
from ...models import Blog, Comment, CommentLike, Notification, User
from ...utils.pagination import parse_pagination

bp = Blueprint("comments", __name__)
MIN_COMMENT_LENGTH = 1
MAX_COMMENT_LENGTH = 500


def _is_public_blog(blog: Blog) -> bool:
    return bool(blog.is_published) and blog.moderation_status == "active" and blog.visibility == "public"


def _normalize_comment_content(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def _validate_comment_content(content: str):
    if not content:
        return "content required"
    if len(content) < MIN_COMMENT_LENGTH:
        return f"content must be at least {MIN_COMMENT_LENGTH} character"
    if len(content) > MAX_COMMENT_LENGTH:
        return f"content must be at most {MAX_COMMENT_LENGTH} characters"
    return None


def _comment_public(c: Comment, liked_by_me: bool):
    return {
        "id": c.id,
        "blog_id": c.blog_id,
        "user": {"id": c.author.id, "username": c.author.username, "avatar_url": c.author.avatar_url},
        "parent_id": c.parent_id,
        "content": c.content,
        "like_count": c.like_count,
        "liked_by_me": liked_by_me,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


def _liked_comment_ids(comment_ids: list[int], user_id: Optional[int]) -> set[int]:
    if user_id is None or not comment_ids:
        return set()
    rows = (
        db.session.query(CommentLike.comment_id)
        .filter(CommentLike.user_id == user_id, CommentLike.comment_id.in_(comment_ids))
        .all()
    )
    return {row[0] for row in rows}


def _root_comment_id(comment: Comment) -> int:
    node = comment
    seen = set()
    while node.parent_id is not None and node.parent_id not in seen:
        seen.add(node.id)
        parent = db.session.get(Comment, node.parent_id)
        if parent is None:
            break
        node = parent
    return node.id


def _delete_comment_preserving_replies(comment: Comment) -> None:
    Comment.query.filter_by(parent_id=comment.id).update(
        {Comment.parent_id: comment.parent_id},
        synchronize_session=False,
    )
    db.session.delete(comment)


@bp.get("/blogs/<int:blog_id>/comments")
def list_comments(blog_id: int):
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None

    blog = db.session.get(Blog, blog_id)
    if blog is None:
        return jsonify({"error": "not found"}), 404

    is_public = _is_public_blog(blog)
    current_user = db.session.get(User, user_id) if user_id is not None else None
    if not is_public and (
        current_user is None
        or (blog.user_id != user_id and (blog.visibility == "private" or not current_user.is_admin))
    ):
        return jsonify({"error": "not found"}), 404

    page, page_size = parse_pagination(request.args, default_page_size=10)

    root_query = Comment.query.filter_by(blog_id=blog_id, parent_id=None)
    total = root_query.count()
    roots = (
        root_query.options(joinedload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    replies = []
    root_ids = [comment.id for comment in roots]
    parent_to_root = {comment.id: comment.id for comment in roots}
    frontier = root_ids
    while frontier:
        children = (
            Comment.query.options(joinedload(Comment.author))
            .filter(Comment.blog_id == blog_id, Comment.parent_id.in_(frontier))
            .order_by(Comment.created_at.asc(), Comment.id.asc())
            .all()
        )
        replies.extend(children)
        next_frontier = []
        for child in children:
            if child.parent_id in parent_to_root:
                parent_to_root[child.id] = parent_to_root[child.parent_id]
                next_frontier.append(child.id)
        frontier = next_frontier
    comments = [*roots, *replies]

    liked_ids = _liked_comment_ids([comment.id for comment in comments], user_id)

    replies_by_root: Dict[int, List[Comment]] = defaultdict(list)
    for c in replies:
        root_id = parent_to_root.get(c.id)
        if root_id is not None:
            replies_by_root[root_id].append(c)

    comment_by_id = {comment.id: comment for comment in comments}

    def build_reply(child: Comment):
        item = _comment_public(child, child.id in liked_ids)
        parent = comment_by_id.get(child.parent_id) if child.parent_id is not None else None
        item["reply_to"] = (
            {
                "id": parent.id,
                "username": parent.author.username,
                "content": parent.content[:120],
            }
            if parent is not None
            else None
        )
        item["replies"] = []
        return item

    def build_root(node: Comment):
        item = _comment_public(node, node.id in liked_ids)
        item["reply_to"] = None
        item["replies"] = [build_reply(child) for child in replies_by_root.get(node.id, [])]
        return item

    return jsonify({"items": [build_root(c) for c in roots], "page": page, "page_size": page_size, "total": total})


@bp.post("/blogs/<int:blog_id>/comments")
@jwt_required()
def create_comment(blog_id: int):
    user_id = int(get_jwt_identity())
    blog = db.session.get(Blog, blog_id)
    if blog is None or not _is_public_blog(blog):
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    content = _normalize_comment_content(data.get("content") or "")
    parent_id = data.get("parent_id")
    validation_error = _validate_comment_content(content)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    parent = None
    if parent_id is not None:
        parent = db.session.get(Comment, int(parent_id))
        if parent is None or parent.blog_id != blog_id:
            return jsonify({"error": "invalid parent"}), 400

    c = Comment(blog_id=blog_id, user_id=user_id, parent_id=int(parent_id) if parent_id else None, content=content)
    db.session.add(c)
    db.session.flush()
    if parent is not None and parent.user_id != user_id:
        db.session.add(
            Notification(
                recipient_user_id=parent.user_id,
                actor_user_id=user_id,
                type="comment_reply",
                blog_id=blog_id,
                comment_id=c.id,
                root_comment_id=_root_comment_id(parent),
            )
        )
    db.session.commit()
    return jsonify({"id": c.id}), 201


@bp.put("/comments/<int:comment_id>")
@jwt_required()
def update_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = db.session.get(Comment, comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404
    if c.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    content = _normalize_comment_content(data.get("content") or "")
    validation_error = _validate_comment_content(content)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    c.content = content
    db.session.commit()
    return jsonify({"ok": True})


@bp.delete("/comments/<int:comment_id>")
@jwt_required()
def delete_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = db.session.get(Comment, comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404

    blog = db.session.get(Blog, c.blog_id)
    if blog is None:
        return jsonify({"error": "not found"}), 404

    if c.user_id != user_id and blog.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    _delete_comment_preserving_replies(c)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/comments/<int:comment_id>/like")
@jwt_required()
def toggle_comment_like(comment_id: int):
    user_id = int(get_jwt_identity())
    c = db.session.get(Comment, comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404
    blog = db.session.get(Blog, c.blog_id)
    if blog is None or not _is_public_blog(blog):
        return jsonify({"error": "not found"}), 404

    like = CommentLike.query.filter_by(comment_id=comment_id, user_id=user_id).first()
    if like is None:
        db.session.add(CommentLike(comment_id=comment_id, user_id=user_id))
        c.like_count += 1
        liked = True
    else:
        db.session.delete(like)
        c.like_count = max(0, c.like_count - 1)
        liked = False

    db.session.commit()
    return jsonify({"liked": liked, "like_count": c.like_count})

