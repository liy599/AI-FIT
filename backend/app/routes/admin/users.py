from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from ...extensions import db
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

    q = User.query
    query_text = (request.args.get("q") or "").strip()
    if query_text:
        q = q.filter(or_(User.username.ilike(f"%{query_text}%"), User.email.ilike(f"%{query_text}%")))
    admin_filter = _parse_bool_query("is_admin")
    if admin_filter is not None:
        q = q.filter(User.is_admin.is_(admin_filter))
    disabled_filter = _parse_bool_query("is_disabled")
    if disabled_filter is not None:
        q = q.filter(User.is_disabled.is_(disabled_filter))
    q = q.order_by(_sort_expression())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": u.id,
                    "username": u.username,
                    "email_masked": _mask_email(u.email),
                    "created_at": u.created_at.isoformat(),
                    "is_admin": bool(u.is_admin),
                    "is_disabled": bool(u.is_disabled),
                }
                for u in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.patch("/users/<int:user_id>")
@jwt_required()
def update_user(user_id: int):
    allowed, current_user = _admin_guard()
    if not allowed or current_user is None:
        return jsonify({"error": "forbidden"}), 403

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    if "is_admin" in data:
        next_is_admin = bool(data.get("is_admin"))
        if user.id == current_user.id and not next_is_admin:
            return jsonify({"error": "cannot remove your own admin access"}), 400
        user.is_admin = next_is_admin

    if "is_disabled" in data:
        next_is_disabled = bool(data.get("is_disabled"))
        if user.id == current_user.id and next_is_disabled:
            return jsonify({"error": "cannot disable your own account"}), 400
        user.is_disabled = next_is_disabled

    db.session.commit()
    return jsonify(_admin_user_payload(user))


@bp.get("/users/<int:user_id>/contact")
@jwt_required()
def get_user_contact(user_id: int):
    allowed, _ = _admin_guard()
    if not allowed:
        return jsonify({"error": "forbidden"}), 403

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"id": user.id, "email": user.email})


def _admin_user_payload(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email_masked": _mask_email(u.email),
        "created_at": u.created_at.isoformat(),
        "is_admin": bool(u.is_admin),
        "is_disabled": bool(u.is_disabled),
    }


def _parse_bool_query(name: str) -> bool | None:
    value = request.args.get(name)
    if value is None or value == "":
        return None
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _sort_expression():
    sort_by = (request.args.get("sort_by") or "id").strip().lower()
    sort_dir = (request.args.get("sort_dir") or "asc").strip().lower()
    sort_fields = {
        "id": User.id,
        "username": User.username,
        "created_at": User.created_at,
        "is_admin": User.is_admin,
        "is_disabled": User.is_disabled,
    }
    column = sort_fields.get(sort_by, User.id)
    return column.desc() if sort_dir == "desc" else column.asc()


def _mask_email(email: str) -> str:
    local, sep, domain = email.partition("@")
    if not sep:
        return "***"
    if len(local) <= 1:
        masked_local = "*"
    elif len(local) == 2:
        masked_local = f"{local[0]}*"
    else:
        masked_local = f"{local[0]}***{local[-1]}"
    return f"{masked_local}@{domain}"

