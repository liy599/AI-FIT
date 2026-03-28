from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Course, CourseComment, UserCourse
from ..utils.pagination import parse_pagination

bp = Blueprint("courses", __name__)


def _course_card(c: Course):
    enroll_count = db.session.query(func.count(UserCourse.id)).filter(UserCourse.course_id == c.id).scalar() or 0
    avg_rating = db.session.query(func.avg(CourseComment.rating)).filter(CourseComment.course_id == c.id).scalar()
    return {
        "id": c.id,
        "title": c.title,
        "cover_image_url": c.cover_image_url,
        "instructor_name": c.instructor_name,
        "is_free": c.is_free,
        "price": float(c.price) if c.price is not None else None,
        "view_count": c.view_count,
        "enroll_count": int(enroll_count),
        "avg_rating": float(avg_rating) if avg_rating is not None else None,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


@bp.get("")
@jwt_required()
def list_courses():
    page, page_size = parse_pagination(request.args, default_page_size=12)
    qtext = (request.args.get("q") or "").strip()
    is_free = request.args.get("is_free")
    sort = request.args.get("sort") or "new"

    q = Course.query
    if qtext:
        q = q.filter(Course.title.ilike(f"%{qtext}%"))
    if is_free in ("true", "false"):
        q = q.filter(Course.is_free.is_(is_free == "true"))

    if sort == "hot":
        q = q.outerjoin(UserCourse).group_by(Course.id).order_by(func.count(UserCourse.id).desc(), Course.id.desc())
    elif sort == "rating":
        q = q.outerjoin(CourseComment).group_by(Course.id).order_by(func.avg(CourseComment.rating).desc().nullslast())
    else:
        q = q.order_by(Course.created_at.desc())

    total = q.distinct(Course.id).count()
    items = q.distinct(Course.id).offset((page - 1) * page_size).limit(page_size).all()
    return jsonify({"items": [_course_card(c) for c in items], "page": page, "page_size": page_size, "total": total})


@bp.get("/<int:course_id>")
@jwt_required()
def get_course(course_id: int):
    user_id = int(get_jwt_identity())
    course = Course.query.get(course_id)
    if course is None:
        return jsonify({"error": "not found"}), 404

    course.view_count += 1
    db.session.commit()

    enrolled = UserCourse.query.filter_by(course_id=course_id, user_id=user_id).first() is not None
    payload = _course_card(course)
    payload.update(
        {
            "description": course.description,
            "intro_video_url": course.intro_video_url,
            "instructor_bio": course.instructor_bio,
            "instructor_avatar_url": course.instructor_avatar_url,
            "enrolled": enrolled,
        }
    )
    return jsonify(payload)


@bp.post("/<int:course_id>/enroll")
@jwt_required()
def enroll_course(course_id: int):
    user_id = int(get_jwt_identity())
    course = Course.query.get(course_id)
    if course is None:
        return jsonify({"error": "not found"}), 404

    existing = UserCourse.query.filter_by(course_id=course_id, user_id=user_id).first()
    if existing is not None:
        return jsonify({"ok": True, "already_enrolled": True})

    if course.is_free:
        enrollment = UserCourse(user_id=user_id, course_id=course_id, payment_status="paid")
    else:
        data = request.get_json(silent=True) or {}
        paid = bool(data.get("paid", False))
        if not paid:
            return jsonify({"error": "payment required"}), 402
        enrollment = UserCourse(user_id=user_id, course_id=course_id, payment_status="paid")

    db.session.add(enrollment)
    db.session.commit()
    return jsonify({"ok": True})

