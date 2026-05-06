from flask import Blueprint, jsonify, request

from ...extensions import db
from ...models import FoodItem
from ...services.food.catalog_runtime import serialize_food

bp = Blueprint("foods", __name__)


@bp.get("/categories")
def list_food_categories():
    rows = (
        db.session.query(FoodItem.category)
        .filter(FoodItem.category.isnot(None))
        .distinct()
        .order_by(FoodItem.category.asc())
        .all()
    )
    categories = [row[0] for row in rows if row and row[0]]
    return jsonify(categories)


@bp.get("")
def list_foods():
    query = (request.args.get("q") or "").strip()
    category = (request.args.get("category") or "").strip()
    limit = min(max(request.args.get("limit", default=60, type=int) or 60, 1), 300)
    offset = request.args.get("offset", type=int)
    page = request.args.get("page", type=int)
    paged = (request.args.get("paged") or "").strip().lower() in {"1", "true", "yes"}

    if offset is None:
        page = page or 1
        page = max(page, 1)
        offset = (page - 1) * limit
    else:
        offset = max(offset, 0)

    db_query = FoodItem.query
    if category:
        db_query = db_query.filter(FoodItem.category == category)
    if query:
        pattern = f"%{query}%"
        db_query = db_query.filter(
            FoodItem.name.ilike(pattern)
            | FoodItem.display_name.ilike(pattern)
            | FoodItem.aliases.ilike(pattern)
        )

    total = db_query.order_by(None).count() if paged else None
    items = (
        db_query.order_by(FoodItem.display_name.asc(), FoodItem.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    serialized = [serialize_food(item) for item in items]
    if not paged:
        return jsonify(serialized)

    page_value = page if page else (offset // limit) + 1
    return jsonify({"items": serialized, "total": total, "limit": limit, "offset": offset, "page": page_value})


@bp.get("/<int:food_id>")
def get_food(food_id: int):
    food = db.session.get(FoodItem, food_id)
    if not food:
        return jsonify({"error": "food not found"}), 404
    return jsonify(serialize_food(food))


@bp.post("/bulk")
def get_foods_bulk():
    payload = request.get_json(silent=True) or {}
    raw_ids = payload.get("ids") or []
    ids = [int(value) for value in raw_ids if isinstance(value, (int, float, str)) and str(value).isdigit()]
    if not ids:
        return jsonify([])

    items = FoodItem.query.filter(FoodItem.id.in_(ids)).order_by(FoodItem.id.asc()).all()
    return jsonify([serialize_food(item) for item in items])
