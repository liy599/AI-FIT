from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import db
from ..models import User, UserFeedback
from ..utils.pagination import parse_pagination

bp = Blueprint("feedback", __name__)


@bp.get("")
def list_feedback():
    page, page_size = parse_pagination(request.args, default_page_size=6, max_page_size=20)

    q = UserFeedback.query.filter_by(type="\u8bc4\u4ef7").order_by(UserFeedback.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": f.id,
                    "user": {"id": f.user.id, "username": f.user.username} if f.user else None,
                    "content": f.content,
                    "rating": f.rating,
                    "created_at": f.created_at.isoformat(),
                }
                for f in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.post("")
def submit_feedback():
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None

    data = request.get_json(silent=True) or {}
    raw_type = (data.get("type") or "").strip()
    type_map = {
        "\u8bc4\u4ef7": "\u8bc4\u4ef7",
        "review": "\u8bc4\u4ef7",
        "rating": "\u8bc4\u4ef7",
        "feedback": "\u8bc4\u4ef7",
        "\u8054\u7cfb\u6211\u4eec": "\u8054\u7cfb\u6211\u4eec",
        "contact": "\u8054\u7cfb\u6211\u4eec",
        "contact_us": "\u8054\u7cfb\u6211\u4eec",
    }
    ftype = type_map.get(raw_type, raw_type)
    content = (data.get("content") or "").strip()
    contact_email = (data.get("contact_email") or "").strip().lower() or None
    rating = data.get("rating")

    if ftype not in ("\u8bc4\u4ef7", "\u8054\u7cfb\u6211\u4eec") or not content:
        return jsonify({"error": "type/content required"}), 400
    if user_id is None and not contact_email:
        return jsonify({"error": "contact_email required for anonymous"}), 400
    if ftype == "\u8bc4\u4ef7" and rating is None:
        return jsonify({"error": "rating required"}), 400

    fb = UserFeedback(
        user_id=user_id,
        type=ftype,
        content=content,
        contact_email=contact_email,
        rating=int(rating) if rating is not None else None,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"ok": True, "id": fb.id}), 201
