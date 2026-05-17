from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...models import User
from ...utils.pagination import parse_pagination
from .lifecycle import _admin_guard

bp = Blueprint("admin_users", __name__)


@bp.get("/users")
@jwt_required()
def list_users():
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    page, page_size = parse_pagination(request.args, default_page_size=20, max_page_size=50)

    q = User.query.order_by(User.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "created_at": u.created_at.isoformat(),
                    "is_admin": bool(u.is_admin),
                }
                for u in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )

