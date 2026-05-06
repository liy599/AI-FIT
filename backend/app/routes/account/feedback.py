from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from ...extensions import db
from ...models import User, UserFeedback
from ...utils.pagination import parse_pagination
from ...utils.privacy import mask_email
from ...utils.rate_limit import consume_rate_limit, get_client_ip, subject_fingerprint

bp = Blueprint("feedback", __name__)


@bp.get("")
@jwt_required()
def list_feedback():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User, user_id)
    if current_user is None:
        return jsonify({"error": "not found"}), 404

    admin_email = (current_app.config.get("ADMIN_EMAIL") or "").strip().lower()
    if not admin_email:
        return jsonify({"error": "admin email not configured"}), 403
    if current_user.email.strip().lower() != admin_email:
        return jsonify({"error": "forbidden"}), 403

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
    raw_type = (data.get("type") or "").strip().lower()
    normalized_type = raw_type.replace("-", "_").replace(" ", "_")
    type_map = {
        "\u8bc4\u4ef7": "\u8bc4\u4ef7",
        "review": "\u8bc4\u4ef7",
        "rating": "\u8bc4\u4ef7",
        "feedback": "\u8bc4\u4ef7",
        "\u8054\u7cfb\u6211\u4eec": "\u8054\u7cfb\u6211\u4eec",
        "contact": "\u8054\u7cfb\u6211\u4eec",
        "contact_us": "\u8054\u7cfb\u6211\u4eec",
    }
    rating = data.get("rating")
    if not normalized_type:
        normalized_type = "review" if rating is not None else "contact"

    ftype = type_map.get(normalized_type, normalized_type)
    content = (data.get("content") or "").strip()
    contact_email = (data.get("contact_email") or "").strip().lower() or None

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"feedback:ip:{ip}",
            limit=int(current_app.config.get("FEEDBACK_RATE_LIMIT_PER_IP", 20)),
            window_seconds=int(current_app.config.get("FEEDBACK_RATE_LIMIT_IP_WINDOW_SECONDS", 600)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        subject = f"user:{user_id}" if user_id is not None else f"anon:{contact_email or ip}"
        subject_result = consume_rate_limit(
            f"feedback:subject:{subject_fingerprint(subject)}",
            limit=int(current_app.config.get("FEEDBACK_RATE_LIMIT_PER_SUBJECT", 10)),
            window_seconds=int(current_app.config.get("FEEDBACK_RATE_LIMIT_SUBJECT_WINDOW_SECONDS", 600)),
        )
        if not subject_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": subject_result.retry_after_seconds}), 429

    if ftype not in ("\u8bc4\u4ef7", "\u8054\u7cfb\u6211\u4eec"):
        return jsonify({"error": "invalid type"}), 400
    if not content:
        return jsonify({"error": "content required"}), 400
    if user_id is None and not contact_email:
        return jsonify({"error": "contact_email required for anonymous"}), 400
    parsed_rating = None
    if ftype == "\u8bc4\u4ef7":
        if rating is None:
            return jsonify({"error": "rating required"}), 400
        try:
            parsed_rating = int(rating)
        except (TypeError, ValueError):
            return jsonify({"error": "rating must be an integer"}), 400
        if parsed_rating < 1 or parsed_rating > 5:
            return jsonify({"error": "rating must be between 1 and 5"}), 400

    fb = UserFeedback(
        user_id=user_id,
        type=ftype,
        content=content,
        contact_email=mask_email(contact_email),
        rating=parsed_rating,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"ok": True, "id": fb.id}), 201
