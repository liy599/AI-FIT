from __future__ import annotations

from ...extensions import db
from ...models import FoodItem
from .matching import FoodForMatch

SEED_FOODS = [
    {
        "name": "rice",
        "display_name": "Steamed Rice",
        "calories": 116,
        "protein": 2.6,
        "fat": 0.3,
        "carbs": 25.9,
        "category": "Staples",
        "aliases": "steamed rice,white rice",
    },
    {
        "name": "banana",
        "display_name": "Banana",
        "calories": 89,
        "protein": 1.1,
        "fat": 0.3,
        "carbs": 22.8,
        "category": "Fruits & Vegetables",
        "aliases": "",
    },
    {
        "name": "egg",
        "display_name": "Egg",
        "calories": 143,
        "protein": 13.0,
        "fat": 9.5,
        "carbs": 0.7,
        "category": "Protein & Dairy",
        "aliases": "boiled egg",
    },
    {
        "name": "chicken breast",
        "display_name": "Chicken Breast",
        "calories": 165,
        "protein": 31.0,
        "fat": 3.6,
        "carbs": 0.0,
        "category": "Protein & Dairy",
        "aliases": "chicken",
    },
    {
        "name": "broccoli",
        "display_name": "Broccoli",
        "calories": 34,
        "protein": 2.8,
        "fat": 0.4,
        "carbs": 6.6,
        "category": "Fruits & Vegetables",
        "aliases": "",
    },
    {
        "name": "pizza",
        "display_name": "Pizza",
        "calories": 266,
        "protein": 11.0,
        "fat": 10.0,
        "carbs": 33.0,
        "category": "Western Dishes",
        "aliases": "beef pizza,hawaiian pizza",
    },
]

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


def ensure_food_seed_data() -> None:
    if FoodItem.query.count() > 0:
        return

    for payload in SEED_FOODS:
        db.session.add(FoodItem(**payload))
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
