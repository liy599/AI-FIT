from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Course, CourseComment, CourseCommentLike, User, UserCourse
from ..utils.pagination import parse_pagination

bp = Blueprint("course_comments", __name__)


def public(comment, user_id):
    return {"id": comment.id, "course_id": comment.course_id,
            "user": {"id": comment.author.id, "username": comment.author.username, "avatar_url": comment.author.avatar_url},
            "rating": comment.rating, "content": comment.content, "like_count": comment.like_count,
            "liked_by_me": CourseCommentLike.query.filter_by(course_comment_id=comment.id, user_id=user_id).first() is not None,
            "created_at": comment.created_at.isoformat(), "updated_at": comment.updated_at.isoformat()}


@bp.get("/courses/<int:course_id>/comments")
@jwt_required()
def list_comments(course_id):
    page, page_size = parse_pagination(request.args, default_page_size=10)
    query = CourseComment.query.filter_by(course_id=course_id).order_by(CourseComment.created_at.desc())
    total = query.count()
    user_id = int(get_jwt_identity())
    return jsonify({"items": [public(c, user_id) for c in query.offset((page - 1) * page_size).limit(page_size).all()],
                    "page": page, "page_size": page_size, "total": total})


@bp.post("/courses/<int:course_id>/comments")
@jwt_required()
def create_comment(course_id):
    user_id = int(get_jwt_identity())
    if not db.session.get(Course, course_id):
        return jsonify({"error": "not found"}), 404
    if not UserCourse.query.filter_by(user_id=user_id, course_id=course_id).first():
        return jsonify({"error": "enrollment required"}), 403
    data = request.get_json(silent=True) or {}
    content = str(data.get("content") or "").strip()
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        rating = 0
    if not content or not 1 <= rating <= 5:
        return jsonify({"error": "rating/content required"}), 400
    comment = CourseComment(course_id=course_id, user_id=user_id, rating=rating, content=content)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"id": comment.id}), 201


@bp.post("/course-comments/<int:comment_id>/like")
@jwt_required()
def toggle_like(comment_id):
    comment = db.session.get(CourseComment, comment_id)
    if not comment:
        return jsonify({"error": "not found"}), 404
    user_id = int(get_jwt_identity())
    like = CourseCommentLike.query.filter_by(course_comment_id=comment_id, user_id=user_id).first()
    if like:
        db.session.delete(like)
        comment.like_count = max(0, comment.like_count - 1)
        liked = False
    else:
        db.session.add(CourseCommentLike(course_comment_id=comment_id, user_id=user_id))
        comment.like_count += 1
        liked = True
    db.session.commit()
    return jsonify({"liked": liked, "like_count": comment.like_count})
