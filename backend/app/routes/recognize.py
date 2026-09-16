import base64

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.food.catalog_runtime import get_foods_for_match
from ..services.food.matching import FoodForMatch, match_food_items
from ..services.food.stepfun import recognize_foods_by_stepfun
from ..utils.rate_limit import consume_rate_limit, get_client_ip

bp = Blueprint("recognize", __name__)

_ALLOWED_IMAGE_MIMETYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@bp.post("")
@jwt_required()
def recognize_foods():
    api_url = (current_app.config.get("STEPFUN_API_URL") or "").strip()
    api_key = (current_app.config.get("STEPFUN_API_KEY") or "").strip()
    if not api_url or not api_key:
        return jsonify({"error": "stepfun not configured"}), 503

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip_result = consume_rate_limit(
            f"recognize:ip:{get_client_ip()}",
            limit=int(current_app.config.get("RECOGNIZE_RATE_LIMIT_PER_IP", 60)),
            window_seconds=int(current_app.config.get("RECOGNIZE_RATE_LIMIT_IP_WINDOW_SECONDS", 3600)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"recognize:acct:{get_jwt_identity()}",
            limit=int(current_app.config.get("RECOGNIZE_RATE_LIMIT_PER_ACCOUNT", 30)),
            window_seconds=int(current_app.config.get("RECOGNIZE_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 3600)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "image required"}), 400
    if image.mimetype and image.mimetype not in _ALLOWED_IMAGE_MIMETYPES:
        return jsonify({"error": "unsupported image type"}), 400
    raw = image.read()
    if not raw:
        return jsonify({"error": "image required"}), 400
    max_bytes = int(current_app.config.get("RECOGNIZE_MAX_IMAGE_BYTES", 8 * 1024 * 1024))
    if len(raw) > max_bytes:
        return jsonify({"error": "image too large"}), 413

    result = recognize_foods_by_stepfun(
        api_url=api_url, api_key=api_key,
        model=current_app.config.get("STEPFUN_MODEL", "step-1o-turbo-vision"),
        image_data_url=f"data:{image.mimetype or 'image/jpeg'};base64,{base64.b64encode(raw).decode()}",
    )
    if not result.ok:
        return jsonify({"error": "stepfun_failed"}), 502

    foods = [FoodForMatch(**item) for item in get_foods_for_match()]
    matched, unmatched = match_food_items(result.items, foods)
    return jsonify({
        "matched": [
            {"foodId": item.food_id, "estimatedGrams": item.estimated_grams, "confidence": item.confidence}
            for item in matched
        ],
        "unmatchedNames": unmatched,
    })
