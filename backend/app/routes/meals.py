from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import FoodItem, FoodMealItem, FoodMealRecord
from ..services.food import MEAL_TYPES
from ..services.food.catalog_runtime import serialize_food
from ..utils.pagination import parse_pagination

bp = Blueprint("meals", __name__)


def parse_iso_date(value: str, field_name: str):
    try:
        return date.fromisoformat(value)
    except ValueError:
        return jsonify({"error": f"invalid {field_name}, expected YYYY-MM-DD"}), 400


def serialize_meal_item(item: FoodMealItem) -> dict:
    return {
        "id": item.id,
        "foodId": item.food_id,
        "grams": float(item.grams),
        "food": serialize_food(item.food) if item.food else None,
    }


def calc_totals(meal: FoodMealRecord) -> dict:
    kcal = protein = fat = carbs = 0.0
    for item in meal.items:
        if not item.food:
            continue
        factor = float(item.grams) / 100
        kcal += float(item.food.calories) * factor
        protein += float(item.food.protein) * factor
        fat += float(item.food.fat) * factor
        carbs += float(item.food.carbs) * factor
    return {
        "kcal": round(kcal, 2),
        "protein": round(protein, 2),
        "fat": round(fat, 2),
        "carbs": round(carbs, 2),
    }


def serialize_meal(meal: FoodMealRecord) -> dict:
    return {
        "id": meal.id,
        "mealType": meal.meal_type,
        "recordedOn": meal.recorded_on.isoformat(),
        "items": [serialize_meal_item(item) for item in sorted(meal.items, key=lambda x: x.id)],
        "totals": calc_totals(meal),
    }


@bp.get("/today")
@jwt_required()
def get_today():
    user_id = int(get_jwt_identity())
    raw_date = (request.args.get("date") or "").strip()
    if raw_date:
        parsed = parse_iso_date(raw_date, "date")
        if not isinstance(parsed, date):
            return parsed
        selected_date = parsed
    else:
        selected_date = date.today()

    meals = (
        FoodMealRecord.query.filter_by(user_id=user_id, recorded_on=selected_date)
        .order_by(FoodMealRecord.id.asc())
        .all()
    )
    serialized = [serialize_meal(meal) for meal in meals]

    totals = {"kcal": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}
    for meal in serialized:
        totals["kcal"] += meal["totals"]["kcal"]
        totals["protein"] += meal["totals"]["protein"]
        totals["fat"] += meal["totals"]["fat"]
        totals["carbs"] += meal["totals"]["carbs"]

    return jsonify(
        {
            "date": selected_date.isoformat(),
            "meals": serialized,
            "totals": {key: round(value, 2) for key, value in totals.items()},
        }
    )


@bp.get("/history")
@jwt_required()
def get_history():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=12)

    query = FoodMealRecord.query.filter_by(user_id=user_id).order_by(
        FoodMealRecord.recorded_on.desc(), FoodMealRecord.id.desc()
    )
    total = query.count()
    meals = query.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [serialize_meal(meal) for meal in meals],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.get("/<int:meal_id>")
@jwt_required()
def get_meal(meal_id: int):
    user_id = int(get_jwt_identity())
    meal = FoodMealRecord.query.filter_by(id=meal_id, user_id=user_id).first()
    if not meal:
        return jsonify({"error": "meal not found"}), 404
    return jsonify(serialize_meal(meal))


@bp.post("")
@jwt_required()
def save_meal():
    user_id = int(get_jwt_identity())
    payload = request.get_json(silent=True) or {}
    meal_type = payload.get("mealType")
    recorded_on = payload.get("recordedOn") or date.today().isoformat()
    raw_items = payload.get("items") or []

    if meal_type not in MEAL_TYPES:
        return jsonify({"error": "invalid mealType"}), 400
    if not isinstance(raw_items, list):
        return jsonify({"error": "items must be a list"}), 400

    normalized_items = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        food_id = item.get("foodId")
        grams = item.get("grams")
        try:
            food_id = int(food_id)
            grams = float(grams)
        except (TypeError, ValueError):
            continue
        if grams <= 0:
            continue
        normalized_items.append({"foodId": food_id, "grams": grams})

    if not normalized_items:
        return jsonify({"error": "items must not be empty"}), 400

    valid_food_ids = {
        value for (value,) in db.session.query(FoodItem.id).filter(FoodItem.id.in_({item["foodId"] for item in normalized_items})).all()
    }
    missing_food_ids = sorted({item["foodId"] for item in normalized_items} - valid_food_ids)
    if missing_food_ids:
        return jsonify({"error": f"invalid foodIds: {', '.join(str(food_id) for food_id in missing_food_ids)}"}), 400

    parsed = parse_iso_date(recorded_on, "recordedOn")
    if not isinstance(parsed, date):
        return parsed
    meal_date = parsed
    meal = FoodMealRecord.query.filter_by(user_id=user_id, meal_type=meal_type, recorded_on=meal_date).first()
    if meal is None:
        meal = FoodMealRecord(user_id=user_id, meal_type=meal_type, recorded_on=meal_date)
        db.session.add(meal)
        db.session.flush()

    FoodMealItem.query.filter_by(meal_id=meal.id).delete()
    for item in normalized_items:
        db.session.add(FoodMealItem(meal_id=meal.id, food_id=item["foodId"], grams=item["grams"]))

    db.session.commit()
    refreshed = FoodMealRecord.query.filter_by(id=meal.id).first()
    return jsonify(serialize_meal(refreshed)), 201


@bp.delete("/<int:meal_id>")
@jwt_required()
def delete_meal(meal_id: int):
    user_id = int(get_jwt_identity())
    meal = FoodMealRecord.query.filter_by(id=meal_id, user_id=user_id).first()
    if not meal:
        return jsonify({"error": "meal not found"}), 404

    db.session.delete(meal)
    db.session.commit()
    return jsonify({"ok": True})
