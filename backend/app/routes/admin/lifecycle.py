from __future__ import annotations

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...extensions import db
from ...models import Blog, User

bp = Blueprint("admin", __name__)


def _admin_guard() -> tuple[bool, User | None]:
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return False, None
    if user.is_disabled or not user.is_admin:
        return False, user
    return True, user


@bp.get("/summary")
@jwt_required()
def get_summary():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    total_users = User.query.count()
    disabled_users = User.query.filter(User.is_disabled.is_(True)).count()
    admin_users = User.query.filter(User.is_admin.is_(True)).count()
    total_blogs = Blog.query.filter(Blog.visibility == "public").count()
    published_blogs = Blog.query.filter(Blog.visibility == "public", Blog.is_published.is_(True)).count()
    draft_blogs = total_blogs - published_blogs

    return jsonify(
        {
            "users": {
                "total": total_users,
                "disabled": disabled_users,
                "admins": admin_users,
            },
            "blogs": {
                "total": total_blogs,
                "published": published_blogs,
                "drafts": draft_blogs,
            },
        }
    )
