from __future__ import annotations

from ...extensions import db
from ...models import FoodItem
from .matching import FoodForMatch

SEED_FOODS = [
    {
        "name": "rice",
        "display_name": "米饭",
        "calories": 116,
        "protein": 2.6,
        "fat": 0.3,
        "carbs": 25.9,
        "category": "主食",
        "aliases": "steamed rice,white rice",
    },
    {
        "name": "banana",
        "display_name": "香蕉",
        "calories": 89,
        "protein": 1.1,
        "fat": 0.3,
        "carbs": 22.8,
        "category": "蔬果",
        "aliases": "",
    },
    {
        "name": "egg",
        "display_name": "鸡蛋",
        "calories": 143,
        "protein": 13.0,
        "fat": 9.5,
        "carbs": 0.7,
        "category": "肉蛋奶",
        "aliases": "boiled egg",
    },
    {
        "name": "chicken breast",
        "display_name": "鸡胸肉",
        "calories": 165,
        "protein": 31.0,
        "fat": 3.6,
        "carbs": 0.0,
        "category": "肉蛋奶",
        "aliases": "chicken",
    },
    {
        "name": "broccoli",
        "display_name": "西兰花",
        "calories": 34,
        "protein": 2.8,
        "fat": 0.4,
        "carbs": 6.6,
        "category": "蔬果",
        "aliases": "",
    },
    {
        "name": "pizza",
        "display_name": "披萨",
        "calories": 266,
        "protein": 11.0,
        "fat": 10.0,
        "carbs": 33.0,
        "category": "西式菜肴",
        "aliases": "beef pizza,hawaiian pizza",
    },
]

BROKEN_TEXT_MAP = {
    "绫抽キ": "米饭",
    "棣欒晧": "香蕉",
    "楦¤泲": "鸡蛋",
    "楦¤兏鑲?": "鸡胸肉",
    "瑗垮叞鑺?": "西兰花",
    "鎶惃": "披萨",
    "涓婚": "主食",
    "钄灉": "蔬果",
    "鑲夎泲濂?": "肉蛋奶",
    "璞嗙被鍧氭灉": "豆类坚果",
    "涓紡鑿滆偞": "中式菜肴",
    "瑗垮紡鑿滆偞": "西式菜肴",
    "闆堕": "零食",
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
