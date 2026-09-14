from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import FoodItem, FoodMealItem, FoodMealRecord
from ..services.food import MEAL_TYPES
from ..services.food.catalog_runtime import serialize_food
from ..utils.pagination import parse_pagination

bp = Blueprint("meals", __name__)


def _date(value, name):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return jsonify({"error": f"invalid {name}, expected YYYY-MM-DD"}), 400


def _serialize(meal):
    totals = {"kcal": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}
    items = []
    for item in sorted(meal.items, key=lambda row: row.id):
        food = serialize_food(item.food) if item.food else None
        if food:
            factor = float(item.grams) / 100
            totals["kcal"] += food["calories"] * factor
            totals["protein"] += food["protein"] * factor
            totals["fat"] += food["fat"] * factor
            totals["carbs"] += food["carbs"] * factor
        items.append({"id": item.id, "foodId": item.food_id, "grams": float(item.grams), "food": food})
    return {"id": meal.id, "mealType": meal.meal_type, "recordedOn": meal.recorded_on.isoformat(),
            "items": items, "totals": {key: round(value, 2) for key, value in totals.items()}}


@bp.get("/today")
@jwt_required()
def today():
    user_id = int(get_jwt_identity())
    selected = request.args.get("date") or date.today().isoformat()
    parsed = _date(selected, "date")
    if not isinstance(parsed, date):
        return parsed
    meals = FoodMealRecord.query.filter_by(user_id=user_id, recorded_on=parsed).order_by(FoodMealRecord.id).all()
    serialized = [_serialize(meal) for meal in meals]
    totals = {key: round(sum(item["totals"][key] for item in serialized), 2)
              for key in ("kcal", "protein", "fat", "carbs")}
    return jsonify({"date": parsed.isoformat(), "meals": serialized, "totals": totals})


@bp.get("/history")
@jwt_required()
def history():
    page, page_size = parse_pagination(request.args, default_page_size=12)
    query = FoodMealRecord.query.filter_by(user_id=int(get_jwt_identity())).order_by(
        FoodMealRecord.recorded_on.desc(), FoodMealRecord.id.desc())
    return jsonify({"items": [_serialize(item) for item in query.offset((page - 1) * page_size).limit(page_size).all()],
                    "page": page, "page_size": page_size, "total": query.count()})


@bp.get("/<int:meal_id>")
@jwt_required()
def get_meal(meal_id):
    meal = FoodMealRecord.query.filter_by(id=meal_id, user_id=int(get_jwt_identity())).first()
    return jsonify(_serialize(meal)) if meal else (jsonify({"error": "meal not found"}), 404)


@bp.post("")
@jwt_required()
def save_meal():
    payload = request.get_json(silent=True) or {}
    meal_type = payload.get("mealType")
    if meal_type not in MEAL_TYPES or not isinstance(payload.get("items"), list):
        return jsonify({"error": "invalid mealType or items"}), 400
    normalized = []
    for item in payload["items"]:
        try:
            food_id, grams = int(item["foodId"]), float(item["grams"])
        except (KeyError, TypeError, ValueError):
            continue
        if grams > 0:
            normalized.append((food_id, grams))
    if not normalized:
        return jsonify({"error": "items must not be empty"}), 400
    ids = {food_id for food_id, _ in normalized}
    valid = {row[0] for row in db.session.query(FoodItem.id).filter(FoodItem.id.in_(ids)).all()}
    missing = sorted(ids - valid)
    if missing:
        return jsonify({"error": f"invalid foodIds: {', '.join(map(str, missing))}"}), 400
    recorded = payload.get("recordedOn") or date.today().isoformat()
    parsed = _date(recorded, "recordedOn")
    if not isinstance(parsed, date):
        return parsed
    user_id = int(get_jwt_identity())
    meal = FoodMealRecord.query.filter_by(user_id=user_id, meal_type=meal_type, recorded_on=parsed).first()
    if meal is None:
        meal = FoodMealRecord(user_id=user_id, meal_type=meal_type, recorded_on=parsed)
        db.session.add(meal)
        db.session.flush()
    FoodMealItem.query.filter_by(meal_id=meal.id).delete()
    db.session.add_all(FoodMealItem(meal_id=meal.id, food_id=food_id, grams=grams) for food_id, grams in normalized)
    db.session.commit()
    return jsonify(_serialize(meal)), 201


@bp.delete("/<int:meal_id>")
@jwt_required()
def delete_meal(meal_id):
    meal = FoodMealRecord.query.filter_by(id=meal_id, user_id=int(get_jwt_identity())).first()
    if not meal:
        return jsonify({"error": "meal not found"}), 404
    db.session.delete(meal)
    db.session.commit()
    return jsonify({"ok": True})
