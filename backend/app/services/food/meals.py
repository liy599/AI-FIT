from __future__ import annotations

from datetime import date

from ...models import FoodMealItem, FoodMealRecord
from .catalog_runtime import serialize_food


def parse_iso_date_value(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"invalid {field_name}, expected YYYY-MM-DD") from exc


def normalize_meal_items(raw_items) -> list[dict]:
    normalized_items = []
    if not isinstance(raw_items, list):
        return normalized_items

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
    return normalized_items


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
        "items": [serialize_meal_item(item) for item in sorted(meal.items, key=lambda item: item.id)],
        "totals": calc_totals(meal),
    }
