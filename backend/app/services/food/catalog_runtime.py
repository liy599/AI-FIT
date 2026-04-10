from __future__ import annotations

import json
from pathlib import Path

from ...extensions import db
from ...models import FoodItem
from .matching import FoodForMatch

SEED_FOODS_JSON_PATH = Path(__file__).with_name("seed_foods.json")

BROKEN_TEXT_MAP = {
    "\u7eeb\u62bd\u30ad": "Steamed Rice",
    "\u68e3\u6b12\u6667": "Banana",
    "\u6966\xa4\u6cf2": "Egg",
    "\u6966\xa4\u514f\u9472?": "Chicken Breast",
    "\u7457\u57ae\u53de\u947a?": "Broccoli",
    "\u93b6\ue0a5\u60c3": "Pizza",
    "\u6d93\u5a5a\ue5e4": "Staples",
    "\u9484\ue101\u7049": "Fruits & Vegetables",
    "\u9472\u590e\u6cf2\u6fc2?": "Protein & Dairy",
    "\u749e\u55d9\u88ab\u9367\u6c2d\u7049": "Nuts & Legumes",
    "\u6d93\ue15e\u7d21\u947f\u6ec6\u505e": "Chinese Dishes",
    "\u7457\u57ae\u7d21\u947f\u6ec6\u505e": "Western Dishes",
    "\u95c6\u5815\ue5e4": "Snacks",
}


def normalize_food_text(value: str | None) -> str:
    if not value:
        return ""
    return BROKEN_TEXT_MAP.get(value, value)


def _load_seed_foods() -> list[dict]:
    if not SEED_FOODS_JSON_PATH.exists():
        raise RuntimeError(f"seed foods json not found: {SEED_FOODS_JSON_PATH}")

    try:
        raw = json.loads(SEED_FOODS_JSON_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError("seed foods json invalid") from exc

    raw_items = raw.get("foods") if isinstance(raw, dict) else raw
    if not isinstance(raw_items, list):
        raise RuntimeError("seed foods json must be a list or {foods: []}")

    normalized: list[dict] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        display_name = str(item.get("name") or "").strip()
        category = str(item.get("category") or "").strip()
        aliases_value = item.get("aliases") or ""
        try:
            calories = float(item.get("calories"))
            protein = float(item.get("protein", 0))
            fat = float(item.get("fat", 0))
            carbs = float(item.get("carbs", 0))
        except (TypeError, ValueError):
            continue

        if not display_name or not category:
            continue

        aliases: str
        if isinstance(aliases_value, list):
            aliases = ",".join(str(value).strip() for value in aliases_value if str(value).strip())
        else:
            aliases = str(aliases_value).strip()

        canonical_name = " ".join(display_name.lower().split())
        normalized.append(
            {
                "name": canonical_name[:100],
                "display_name": display_name,
                "calories": calories,
                "protein": protein,
                "fat": fat,
                "carbs": carbs,
                "category": category,
                "aliases": aliases,
            }
        )

    if not normalized:
        raise RuntimeError("seed foods json contains no valid items")
    return normalized


def ensure_food_seed_data() -> None:
    seeds = _load_seed_foods()
    existing = {
        value.lower().strip()
        for (value,) in db.session.query(FoodItem.name).all()
        if isinstance(value, str) and value.strip()
    }
    added = 0
    for payload in seeds:
        name = (payload.get("name") or "").strip()
        if not name:
            continue
        key = name.lower().strip()
        if key in existing:
            continue
        db.session.add(FoodItem(**payload))
        existing.add(key)
        added += 1

    if added:
        db.session.commit()


def serialize_food(food: FoodItem) -> dict:
    aliases = [item.strip() for item in (food.aliases or "").split(",") if item.strip()]
    return {
        "id": food.id,
        "name": food.name,
        "displayName": normalize_food_text(food.display_name),
        "category": normalize_food_text(food.category),
        "aliases": aliases,
        "calories": float(food.calories),
        "protein": float(food.protein),
        "fat": float(food.fat),
        "carbs": float(food.carbs),
    }


def get_foods_for_match() -> list[FoodForMatch]:
    items = FoodItem.query.order_by(FoodItem.id.asc()).all()
    return [
        FoodForMatch(
            id=item.id,
            name=item.name,
            display_name=normalize_food_text(item.display_name),
            aliases=[alias.strip() for alias in (item.aliases or "").split(",") if alias.strip()],
        )
        for item in items
    ]
