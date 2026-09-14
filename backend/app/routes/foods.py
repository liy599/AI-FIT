from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import FoodItem
from ..services.food.catalog_runtime import ensure_food_seed_data, serialize_food

bp = Blueprint("foods", __name__)


@bp.get("")
def list_foods():
    ensure_food_seed_data()
    query = (request.args.get("q") or "").strip()
    category = (request.args.get("category") or "").strip()
    limit = min(max(request.args.get("limit", default=60, type=int) or 60, 1), 300)
    result = FoodItem.query
    if category:
        result = result.filter(FoodItem.category == category)
    if query:
        pattern = f"%{query}%"
        result = result.filter(
            FoodItem.name.ilike(pattern) | FoodItem.display_name.ilike(pattern) | FoodItem.aliases.ilike(pattern)
        )
    return jsonify([serialize_food(item) for item in result.order_by(FoodItem.id.asc()).limit(limit).all()])


@bp.get("/<int:food_id>")
def get_food(food_id: int):
    food = db.session.get(FoodItem, food_id)
    return jsonify(serialize_food(food)) if food else (jsonify({"error": "food not found"}), 404)


@bp.post("/bulk")
def get_foods_bulk():
    payload = request.get_json(silent=True) or {}
    ids = [int(value) for value in payload.get("ids", []) if str(value).isdigit()]
    items = FoodItem.query.filter(FoodItem.id.in_(ids)).order_by(FoodItem.id.asc()).all() if ids else []
    return jsonify([serialize_food(item) for item in items])
