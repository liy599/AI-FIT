from collections import defaultdict
from typing import Dict, List, Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from ..extensions import db
from ..models import Blog, Comment, CommentLike, User
from ..utils.pagination import parse_pagination

bp = Blueprint("comments", __name__)


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


def _is_comment_liked(comment_id: int, user_id: Optional[int]):
    if user_id is None:
        return False
    return CommentLike.query.filter_by(comment_id=comment_id, user_id=user_id).first() is not None


@bp.get("/blogs/<int:blog_id>/comments")
def list_comments(blog_id: int):
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None

    blog = Blog.query.get(blog_id)
    if blog is None or not blog.is_published:
        return jsonify({"error": "not found"}), 404

    page, page_size = parse_pagination(request.args, default_page_size=10)

    comments = (
        Comment.query.filter_by(blog_id=blog_id)
        .join(User, Comment.user_id == User.id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .all()
    )

    by_parent: Dict[Optional[int], List[Comment]] = defaultdict(list)
    for c in comments:
        by_parent[c.parent_id].append(c)

    def build(node: Comment):
        item = _comment_public(node, _is_comment_liked(node.id, user_id))
        item["replies"] = [build(child) for child in by_parent.get(node.id, [])]
        return item

    roots = [build(c) for c in by_parent.get(None, [])]
    total = len(roots)
    start = (page - 1) * page_size
    end = start + page_size
    return jsonify({"items": roots[start:end], "page": page, "page_size": page_size, "total": total})


@bp.post("/blogs/<int:blog_id>/comments")
@jwt_required()
def create_comment(blog_id: int):
    user_id = int(get_jwt_identity())
    blog = Blog.query.get(blog_id)
    if blog is None or not blog.is_published:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    parent_id = data.get("parent_id")
    if not content:
        return jsonify({"error": "content required"}), 400

    if parent_id is not None:
        parent = Comment.query.get(int(parent_id))
        if parent is None or parent.blog_id != blog_id:
            return jsonify({"error": "invalid parent"}), 400

    c = Comment(blog_id=blog_id, user_id=user_id, parent_id=int(parent_id) if parent_id else None, content=content)
    db.session.add(c)
    db.session.commit()
    return jsonify({"id": c.id}), 201


@bp.put("/comments/<int:comment_id>")
@jwt_required()
def update_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = Comment.query.get(comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404
    if c.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content required"}), 400

    c.content = content
    db.session.commit()
    return jsonify({"ok": True})


@bp.delete("/comments/<int:comment_id>")
@jwt_required()
def delete_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = Comment.query.get(comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404

    blog = Blog.query.get(c.blog_id)
    if blog is None:
        return jsonify({"error": "not found"}), 404

    if c.user_id != user_id and blog.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/comments/<int:comment_id>/like")
@jwt_required()
def toggle_comment_like(comment_id: int):
    user_id = int(get_jwt_identity())
    c = Comment.query.get(comment_id)
    if c is None:
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

