from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Course, CourseComment, UserCourse
from ..utils.pagination import parse_pagination

bp = Blueprint("courses", __name__)


def card(course):
    return {
        "id": course.id, "title": course.title, "cover_image_url": course.cover_image_url,
        "instructor_name": course.instructor_name, "is_free": course.is_free,
        "price": float(course.price) if course.price is not None else None, "view_count": course.view_count,
        "enroll_count": db.session.query(func.count(UserCourse.id)).filter_by(course_id=course.id).scalar() or 0,
        "avg_rating": db.session.query(func.avg(CourseComment.rating)).filter_by(course_id=course.id).scalar(),
        "created_at": course.created_at.isoformat(), "updated_at": course.updated_at.isoformat(),
    }


@bp.get("")
@jwt_required()
def list_courses():
    page, page_size = parse_pagination(request.args, default_page_size=12)
    query = Course.query
    text = (request.args.get("q") or "").strip()
    if text:
        query = query.filter(Course.title.ilike(f"%{text}%"))
    if request.args.get("is_free") in ("true", "false"):
        query = query.filter(Course.is_free.is_(request.args.get("is_free") == "true"))
    sort = request.args.get("sort", "new")
    if sort == "hot":
        query = query.outerjoin(UserCourse).group_by(Course.id).order_by(func.count(UserCourse.id).desc())
    elif sort == "rating":
        query = query.outerjoin(CourseComment).group_by(Course.id).order_by(func.avg(CourseComment.rating).desc())
    else:
        query = query.order_by(Course.created_at.desc())
    total = query.count()
    return jsonify({"items": [card(c) for c in query.offset((page - 1) * page_size).limit(page_size).all()],
                    "page": page, "page_size": page_size, "total": total})


@bp.get("/<int:course_id>")
@jwt_required()
def get_course(course_id):
    course = db.session.get(Course, course_id)
    if course is None:
        return jsonify({"error": "not found"}), 404
    course.view_count += 1
    db.session.commit()
    result = card(course)
    result.update({"description": course.description, "intro_video_url": course.intro_video_url,
                   "instructor_bio": course.instructor_bio, "instructor_avatar_url": course.instructor_avatar_url,
                   "enrolled": UserCourse.query.filter_by(course_id=course_id, user_id=int(get_jwt_identity())).first() is not None})
    return jsonify(result)


@bp.post("/<int:course_id>/enroll")
@jwt_required()
def enroll(course_id):
    course = db.session.get(Course, course_id)
    if course is None:
        return jsonify({"error": "not found"}), 404
    user_id = int(get_jwt_identity())
    if UserCourse.query.filter_by(course_id=course_id, user_id=user_id).first():
        return jsonify({"ok": True, "already_enrolled": True})
    if not course.is_free and not bool((request.get_json(silent=True) or {}).get("paid")):
        return jsonify({"error": "payment required"}), 402
    db.session.add(UserCourse(user_id=user_id, course_id=course_id, payment_status="paid"))
    db.session.commit()
    return jsonify({"ok": True})
