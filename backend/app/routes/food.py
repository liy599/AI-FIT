from flask import Blueprint, jsonify

bp = Blueprint("food", __name__)


@bp.get("/meta")
def food_meta():
    return jsonify({
        "module": "food",
        "status": "active",
        "endpoints": ["/api/food/meta", "/api/foods", "/api/meals", "/api/recognize"],
    })
