import base64

from flask import Blueprint, current_app, jsonify, request

from ..services.food.catalog_runtime import get_foods_for_match
from ..services.food.matching import FoodForMatch, match_food_labels
from ..services.food.stepfun import recognize_foods_by_stepfun

bp = Blueprint("recognize", __name__)


@bp.post("")
def recognize_foods():
    api_url = (current_app.config.get("STEPFUN_API_URL") or "").strip()
    api_key = (current_app.config.get("STEPFUN_API_KEY") or "").strip()
    if not api_url or not api_key:
        return jsonify({"error": "stepfun not configured"}), 503
    image = request.files.get("image")
    if not image:
        return jsonify({"error": "image required"}), 400
    raw = image.read()
    if not raw:
        return jsonify({"error": "image required"}), 400
    result = recognize_foods_by_stepfun(
        api_url=api_url, api_key=api_key,
        model=current_app.config.get("STEPFUN_MODEL", "step-1v-8k"),
        image_data_url=f"data:{image.mimetype or 'image/jpeg'};base64,{base64.b64encode(raw).decode()}",
    )
    if not result.ok:
        return jsonify({"error": "stepfun_failed", "rawText": result.raw_text}), 502
    foods = [FoodForMatch(**item) for item in get_foods_for_match()]
    matched, unmatched = match_food_labels(result.labels, foods)
    return jsonify({"names": result.labels, "foodIds": matched, "unmatchedNames": unmatched})
