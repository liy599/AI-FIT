from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Blog, Comment, User
from ..utils.pagination import parse_pagination

bp = Blueprint("user", __name__)


def _user_public(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "avatar_url": u.avatar_url,
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
    user = User.query.get(user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(_user_public(user))


@bp.put("/profile")
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    for field in ["username", "avatar_url", "gender", "fitness_goal"]:
        if field in data:
            setattr(user, field, (data.get(field) or None))

    for field in ["height", "weight"]:
        if field in data:
            v = data.get(field)
            setattr(user, field, v if v is not None and v != "" else None)

    if "username" in data:
        existing = User.query.filter(User.username == user.username, User.id != user.id).first()
        if existing is not None:
            return jsonify({"error": "username already exists"}), 409

    db.session.commit()
    return jsonify(_user_public(user))


@bp.get("/blogs")
@jwt_required()
def my_blogs():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)

    q = Blog.query.filter_by(user_id=user_id).order_by(Blog.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": b.id,
                    "title": b.title,
                    "cover_image_url": b.cover_image_url,
                    "is_published": b.is_published,
                    "created_at": b.created_at.isoformat(),
                    "updated_at": b.updated_at.isoformat(),
                }
                for b in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.get("/comments")
@jwt_required()
def my_comments():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=10)

    q = Comment.query.filter_by(user_id=user_id).order_by(Comment.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": c.id,
                    "blog_id": c.blog_id,
                    "content": c.content,
                    "created_at": c.created_at.isoformat(),
                    "updated_at": c.updated_at.isoformat(),
                }
                for c in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )

