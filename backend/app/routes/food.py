from flask import Blueprint, jsonify

bp = Blueprint("food", __name__)


@bp.get("/meta")
def food_meta():
    return jsonify(
        {
            "module": "food",
            "status": "active",
            "phase": "step-3-minimum-viable-loop",
            "endpoints": [
                "/api/food/meta",
                "/api/foods",
                "/api/foods/bulk",
                "/api/meals",
                "/api/recognize",
            ],
            "notes": [
                "foodidentity is the business baseline",
                "AI-FIT backend is the formal runtime carrier",
                "formal foods, meals, and recognize APIs are live in AI-FIT",
                "legacy /api/nutrition and /api/diets are no longer formal runtime entry points",
            ],
        }
    )
