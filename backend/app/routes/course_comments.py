from typing import Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Course, CourseComment, CourseCommentLike, User, UserCourse
from ..utils.pagination import parse_pagination

bp = Blueprint("course_comments", __name__)


def _is_admin(email: Optional[str]) -> bool:
    admin_email = (current_app.config.get("ADMIN_EMAIL") or "").strip().lower()
    return bool(admin_email) and (email or "").strip().lower() == admin_email


def _comment_public(c: CourseComment, liked_by_me: bool):
    return {
        "id": c.id,
        "course_id": c.course_id,
        "user": {"id": c.author.id, "username": c.author.username, "avatar_url": c.author.avatar_url},
        "rating": c.rating,
        "content": c.content,
        "like_count": c.like_count,
        "liked_by_me": liked_by_me,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


def _liked(comment_id: int, user_id: int):
    return CourseCommentLike.query.filter_by(course_comment_id=comment_id, user_id=user_id).first() is not None


@bp.get("/courses/<int:course_id>/comments")
@jwt_required()
def list_course_comments(course_id: int):
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)
    sort = request.args.get("sort") or "new"

    q = CourseComment.query.filter_by(course_id=course_id).join(User, CourseComment.user_id == User.id)
    if sort == "rating":
        q = q.order_by(CourseComment.rating.desc(), CourseComment.created_at.desc())
    else:
        q = q.order_by(CourseComment.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        {
            "items": [_comment_public(c, _liked(c.id, user_id)) for c in items],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.post("/courses/<int:course_id>/comments")
@jwt_required()
def create_course_comment(course_id: int):
    user_id = int(get_jwt_identity())
    course = Course.query.get(course_id)
    if course is None:
        return jsonify({"error": "not found"}), 404

    enrolled = UserCourse.query.filter_by(user_id=user_id, course_id=course_id).first() is not None
    if not enrolled:
        return jsonify({"error": "enrollment required"}), 403

    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    content = (data.get("content") or "").strip()
    if rating is None or not content:
        return jsonify({"error": "rating/content required"}), 400

    c = CourseComment(course_id=course_id, user_id=user_id, rating=int(rating), content=content)
    db.session.add(c)
    db.session.commit()
    return jsonify({"id": c.id}), 201


@bp.put("/course-comments/<int:comment_id>")
@jwt_required()
def update_course_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = CourseComment.query.get(comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404
    if c.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    if "rating" in data:
        c.rating = int(data["rating"])
    if "content" in data:
        content = (data.get("content") or "").strip()
        if not content:
            return jsonify({"error": "content required"}), 400
        c.content = content

    db.session.commit()
    return jsonify({"ok": True})


@bp.delete("/course-comments/<int:comment_id>")
@jwt_required()
def delete_course_comment(comment_id: int):
    user_id = int(get_jwt_identity())
    c = CourseComment.query.get(comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404

    me = User.query.get(user_id)
    if c.user_id != user_id and not _is_admin(me.email if me else None):
        return jsonify({"error": "forbidden"}), 403

    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/course-comments/<int:comment_id>/like")
@jwt_required()
def toggle_course_comment_like(comment_id: int):
    user_id = int(get_jwt_identity())
    c = CourseComment.query.get(comment_id)
    if c is None:
        return jsonify({"error": "not found"}), 404

    like = CourseCommentLike.query.filter_by(course_comment_id=comment_id, user_id=user_id).first()
    if like is None:
        db.session.add(CourseCommentLike(course_comment_id=comment_id, user_id=user_id))
        c.like_count += 1
        liked = True
    else:
        db.session.delete(like)
        c.like_count = max(0, c.like_count - 1)
        liked = False

    db.session.commit()
    return jsonify({"liked": liked, "like_count": c.like_count})

