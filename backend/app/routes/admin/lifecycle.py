from __future__ import annotations

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import case, func

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

    user_counts = db.session.query(
        func.count(User.id),
        func.sum(case((User.is_disabled.is_(True), 1), else_=0)),
        func.sum(case((User.is_admin.is_(True), 1), else_=0)),
    ).one()
    blog_counts = db.session.query(
        func.count(Blog.id),
        func.sum(case((Blog.is_published.is_(True), 1), else_=0)),
    ).filter(Blog.visibility == "public").one()

    total_users = int(user_counts[0] or 0)
    disabled_users = int(user_counts[1] or 0)
    admin_users = int(user_counts[2] or 0)
    total_blogs = int(blog_counts[0] or 0)
    published_blogs = int(blog_counts[1] or 0)
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
