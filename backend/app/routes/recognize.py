import base64

from flask import Blueprint, current_app, jsonify, request

from ..services.food.catalog_runtime import get_foods_for_match
from ..services.food.matching import match_food_labels
from ..services.food.stepfun import recognize_foods_by_stepfun

bp = Blueprint("recognize", __name__)


@bp.post("")
def recognize_foods():
    api_url = (current_app.config.get("STEPFUN_API_URL") or "").strip() or (current_app.config.get("AI_REPORT_API_URL") or "").strip()
    api_key = (current_app.config.get("STEPFUN_API_KEY") or "").strip() or (current_app.config.get("AI_REPORT_API_KEY") or "").strip()
    model = (
        (current_app.config.get("STEPFUN_MODEL") or "").strip()
        or (current_app.config.get("AI_REPORT_MODEL") or "").strip()
        or "step-1v-8k"
    )

    if not api_url or not api_key:
        return jsonify({"error": "stepfun not configured"}), 503

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "image required"}), 400

    image_bytes = image.read()
    if not image_bytes:
        return jsonify({"error": "image required"}), 400

    mime = image.mimetype or "image/jpeg"
    image_data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    recognized = recognize_foods_by_stepfun(
        api_url=api_url,
        api_key=api_key,
        model=model,
        image_data_url=image_data_url,
    )
    if not recognized.ok:
        payload = {"error": "stepfun_failed"}
        if not is_production:
            payload["rawText"] = recognized.raw_text
        return jsonify(payload), 502

    matched_ids, unmatched_names = match_food_labels(recognized.labels, get_foods_for_match())
    payload = {
        "names": recognized.labels,
        "foodIds": matched_ids,
        "unmatchedNames": unmatched_names,
    }
    if request.args.get("debug") == "1" and not is_production:
        payload["rawText"] = recognized.raw_text
    return jsonify(payload)
    is_production = str(current_app.config.get("APP_ENV", "")).lower() == "production"
