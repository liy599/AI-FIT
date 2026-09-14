from __future__ import annotations

from ...extensions import db
from ...models import FoodItem

SEED_FOODS = [
    {"name": "rice", "display_name": "米饭", "calories": 116, "protein": 2.6, "fat": 0.3, "carbs": 25.9, "category": "主食", "aliases": "steamed rice,white rice"},
    {"name": "banana", "display_name": "香蕉", "calories": 89, "protein": 1.1, "fat": 0.3, "carbs": 22.8, "category": "蔬果", "aliases": ""},
    {"name": "egg", "display_name": "鸡蛋", "calories": 143, "protein": 13.0, "fat": 9.5, "carbs": 0.7, "category": "肉蛋奶", "aliases": "boiled egg"},
    {"name": "chicken breast", "display_name": "鸡胸肉", "calories": 165, "protein": 31.0, "fat": 3.6, "carbs": 0.0, "category": "肉蛋奶", "aliases": "chicken"},
    {"name": "broccoli", "display_name": "西兰花", "calories": 34, "protein": 2.8, "fat": 0.4, "carbs": 6.6, "category": "蔬果", "aliases": ""},
    {"name": "pizza", "display_name": "披萨", "calories": 266, "protein": 11.0, "fat": 10.0, "carbs": 33.0, "category": "西式菜肴", "aliases": "beef pizza,hawaiian pizza"},
]

FOOD_IMAGE_URLS = {
    "rice": "/assets/images/hero/hero_slide_3.jpg",
    "banana": "/assets/images/about/about_privacy_food.jpg",
    "egg": "/assets/images/hero/hero_slide_4.jpg",
    "chicken breast": "/assets/images/hero/hero_slide_2.jpg",
    "broccoli": "/assets/images/about/about_privacy_food.jpg",
    "pizza": "/assets/images/hero/hero_slide_1.jpg",
}


def ensure_food_seed_data() -> None:
    if FoodItem.query.count():
        return
    db.session.add_all(FoodItem(**payload) for payload in SEED_FOODS)
    db.session.commit()


def serialize_food(food: FoodItem) -> dict:
    return {
        "id": food.id,
        "name": food.name,
        "displayName": food.display_name,
        "imageUrl": FOOD_IMAGE_URLS.get(food.name),
        "category": food.category,
        "aliases": [item.strip() for item in (food.aliases or "").split(",") if item.strip()],
        "calories": float(food.calories),
        "protein": float(food.protein),
        "fat": float(food.fat),
        "carbs": float(food.carbs),
    }


def get_foods_for_match():
    return [
        {"id": item.id, "name": item.name, "display_name": item.display_name,
         "aliases": [a.strip() for a in (item.aliases or "").split(",") if a.strip()]}
        for item in FoodItem.query.order_by(FoodItem.id.asc()).all()
    ]
