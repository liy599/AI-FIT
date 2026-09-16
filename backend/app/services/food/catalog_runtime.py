from __future__ import annotations

from ...extensions import db
from ...models import FoodItem

# Nutritional values are per 100g (source: USDA FoodData Central)
# Category keys match frontend CATEGORY_META: Grain, Protein, Vegetable, Fruit, Dairy, Seafood, Beverage, Other
SEED_FOODS = [
    # ── Grain ──────────────────────────────────────────────────────────────
    {"name": "white rice cooked",       "display_name": "米饭",       "calories": 130, "protein": 2.7,  "fat": 0.3, "carbs": 28.2, "category": "Grain",     "aliases": "rice,steamed rice"},
    {"name": "brown rice cooked",       "display_name": "糙米饭",     "calories": 112, "protein": 2.6,  "fat": 0.9, "carbs": 23.5, "category": "Grain",     "aliases": "brown rice"},
    {"name": "oats cooked",             "display_name": "燕麦粥",     "calories": 71,  "protein": 2.5,  "fat": 1.5, "carbs": 12.0, "category": "Grain",     "aliases": "oatmeal,porridge"},
    {"name": "whole wheat bread",       "display_name": "全麦面包",   "calories": 247, "protein": 13.0, "fat": 3.4, "carbs": 41.3, "category": "Grain",     "aliases": "wheat bread"},
    {"name": "white bread",             "display_name": "白面包",     "calories": 265, "protein": 9.0,  "fat": 3.2, "carbs": 49.0, "category": "Grain",     "aliases": "bread"},
    {"name": "pasta cooked",            "display_name": "意面",       "calories": 131, "protein": 5.0,  "fat": 1.1, "carbs": 25.1, "category": "Grain",     "aliases": "spaghetti,noodles"},
    {"name": "corn",                    "display_name": "玉米",       "calories": 86,  "protein": 3.3,  "fat": 1.4, "carbs": 19.0, "category": "Grain",     "aliases": "sweetcorn,maize"},
    {"name": "sweet potato cooked",     "display_name": "红薯",       "calories": 90,  "protein": 2.0,  "fat": 0.1, "carbs": 20.7, "category": "Grain",     "aliases": "sweet potato,yam"},
    {"name": "potato boiled",           "display_name": "土豆",       "calories": 87,  "protein": 1.9,  "fat": 0.1, "carbs": 20.1, "category": "Grain",     "aliases": "potato"},
    {"name": "quinoa cooked",           "display_name": "藜麦",       "calories": 120, "protein": 4.4,  "fat": 1.9, "carbs": 21.3, "category": "Grain",     "aliases": "quinoa"},
    {"name": "udon noodles cooked",     "display_name": "乌冬面",     "calories": 118, "protein": 3.0,  "fat": 0.6, "carbs": 23.7, "category": "Grain",     "aliases": "udon"},
    {"name": "ramen noodles cooked",    "display_name": "拉面",       "calories": 136, "protein": 4.8,  "fat": 2.2, "carbs": 24.5, "category": "Grain",     "aliases": "ramen"},
    {"name": "millet cooked",           "display_name": "小米粥",     "calories": 119, "protein": 3.5,  "fat": 1.0, "carbs": 23.7, "category": "Grain",     "aliases": "millet"},
    {"name": "tortilla flour",          "display_name": "面粉饼",     "calories": 312, "protein": 8.0,  "fat": 7.4, "carbs": 52.0, "category": "Grain",     "aliases": "wrap,tortilla"},
    {"name": "white steamed bun",       "display_name": "馒头",       "calories": 233, "protein": 7.0,  "fat": 1.1, "carbs": 47.0, "category": "Grain",     "aliases": "mantou,steamed bun"},

    # ── Protein ────────────────────────────────────────────────────────────
    {"name": "chicken breast cooked",   "display_name": "鸡胸肉",     "calories": 165, "protein": 31.0, "fat": 3.6, "carbs": 0.0,  "category": "Protein",   "aliases": "chicken breast"},
    {"name": "chicken thigh cooked",    "display_name": "鸡腿",       "calories": 209, "protein": 26.0, "fat": 11.0,"carbs": 0.0,  "category": "Protein",   "aliases": "chicken thigh"},
    {"name": "whole egg",               "display_name": "鸡蛋",       "calories": 143, "protein": 13.0, "fat": 9.5, "carbs": 0.7,  "category": "Protein",   "aliases": "egg,boiled egg"},
    {"name": "egg white",               "display_name": "蛋白",       "calories": 52,  "protein": 11.0, "fat": 0.2, "carbs": 0.7,  "category": "Protein",   "aliases": "egg white"},
    {"name": "lean beef cooked",        "display_name": "牛肉",       "calories": 215, "protein": 26.1, "fat": 11.8,"carbs": 0.0,  "category": "Protein",   "aliases": "beef,steak"},
    {"name": "pork tenderloin cooked",  "display_name": "猪里脊",     "calories": 143, "protein": 26.2, "fat": 3.5, "carbs": 0.0,  "category": "Protein",   "aliases": "pork"},
    {"name": "tofu firm",               "display_name": "豆腐",       "calories": 76,  "protein": 8.1,  "fat": 4.3, "carbs": 1.9,  "category": "Protein",   "aliases": "tofu,bean curd"},
    {"name": "tofu silken",             "display_name": "嫩豆腐",     "calories": 55,  "protein": 5.3,  "fat": 2.5, "carbs": 2.0,  "category": "Protein",   "aliases": "soft tofu"},
    {"name": "lentils cooked",          "display_name": "扁豆",       "calories": 116, "protein": 9.0,  "fat": 0.4, "carbs": 20.1, "category": "Protein",   "aliases": "lentils"},
    {"name": "chickpeas cooked",        "display_name": "鹰嘴豆",     "calories": 164, "protein": 8.9,  "fat": 2.6, "carbs": 27.4, "category": "Protein",   "aliases": "garbanzo beans"},
    {"name": "black beans cooked",      "display_name": "黑豆",       "calories": 132, "protein": 8.9,  "fat": 0.5, "carbs": 23.7, "category": "Protein",   "aliases": "black beans"},
    {"name": "edamame",                 "display_name": "毛豆",       "calories": 121, "protein": 11.9, "fat": 5.2, "carbs": 8.9,  "category": "Protein",   "aliases": "edamame,soybeans"},
    {"name": "turkey breast cooked",    "display_name": "火鸡胸肉",   "calories": 189, "protein": 28.7, "fat": 7.4, "carbs": 0.0,  "category": "Protein",   "aliases": "turkey"},
    {"name": "duck cooked",             "display_name": "鸭肉",       "calories": 201, "protein": 23.5, "fat": 11.2,"carbs": 0.0,  "category": "Protein",   "aliases": "duck"},
    {"name": "pork belly cooked",       "display_name": "五花肉",     "calories": 395, "protein": 14.3, "fat": 37.3,"carbs": 0.0,  "category": "Protein",   "aliases": "pork belly"},
    {"name": "lamb cooked",             "display_name": "羊肉",       "calories": 258, "protein": 25.6, "fat": 16.5,"carbs": 0.0,  "category": "Protein",   "aliases": "lamb,mutton"},
    {"name": "soy tempeh",              "display_name": "天贝",       "calories": 193, "protein": 18.5, "fat": 10.8,"carbs": 9.4,  "category": "Protein",   "aliases": "tempeh"},

    # ── Vegetable ──────────────────────────────────────────────────────────
    {"name": "broccoli",                "display_name": "西兰花",     "calories": 34,  "protein": 2.8,  "fat": 0.4, "carbs": 6.6,  "category": "Vegetable", "aliases": "broccoli"},
    {"name": "spinach",                 "display_name": "菠菜",       "calories": 23,  "protein": 2.9,  "fat": 0.4, "carbs": 3.6,  "category": "Vegetable", "aliases": "spinach"},
    {"name": "carrot",                  "display_name": "胡萝卜",     "calories": 41,  "protein": 0.9,  "fat": 0.2, "carbs": 9.6,  "category": "Vegetable", "aliases": "carrot"},
    {"name": "tomato",                  "display_name": "西红柿",     "calories": 18,  "protein": 0.9,  "fat": 0.2, "carbs": 3.9,  "category": "Vegetable", "aliases": "tomato"},
    {"name": "cucumber",                "display_name": "黄瓜",       "calories": 15,  "protein": 0.7,  "fat": 0.1, "carbs": 3.6,  "category": "Vegetable", "aliases": "cucumber"},
    {"name": "cabbage",                 "display_name": "白菜",       "calories": 25,  "protein": 1.3,  "fat": 0.1, "carbs": 5.8,  "category": "Vegetable", "aliases": "cabbage,chinese cabbage"},
    {"name": "kale",                    "display_name": "羽衣甘蓝",   "calories": 49,  "protein": 4.3,  "fat": 0.9, "carbs": 8.8,  "category": "Vegetable", "aliases": "kale"},
    {"name": "lettuce",                 "display_name": "生菜",       "calories": 15,  "protein": 1.4,  "fat": 0.2, "carbs": 2.9,  "category": "Vegetable", "aliases": "lettuce,romaine"},
    {"name": "bell pepper red",         "display_name": "红椒",       "calories": 31,  "protein": 1.0,  "fat": 0.3, "carbs": 6.0,  "category": "Vegetable", "aliases": "red pepper,bell pepper"},
    {"name": "mushroom",                "display_name": "蘑菇",       "calories": 22,  "protein": 3.1,  "fat": 0.3, "carbs": 3.3,  "category": "Vegetable", "aliases": "mushroom,shiitake"},
    {"name": "eggplant",                "display_name": "茄子",       "calories": 25,  "protein": 1.0,  "fat": 0.2, "carbs": 5.9,  "category": "Vegetable", "aliases": "eggplant,aubergine"},
    {"name": "onion",                   "display_name": "洋葱",       "calories": 40,  "protein": 1.1,  "fat": 0.1, "carbs": 9.3,  "category": "Vegetable", "aliases": "onion"},
    {"name": "garlic",                  "display_name": "大蒜",       "calories": 149, "protein": 6.4,  "fat": 0.5, "carbs": 33.1, "category": "Vegetable", "aliases": "garlic"},
    {"name": "green beans",             "display_name": "四季豆",     "calories": 31,  "protein": 1.8,  "fat": 0.1, "carbs": 7.1,  "category": "Vegetable", "aliases": "green beans"},
    {"name": "celery",                  "display_name": "芹菜",       "calories": 16,  "protein": 0.7,  "fat": 0.2, "carbs": 3.0,  "category": "Vegetable", "aliases": "celery"},
    {"name": "zucchini",                "display_name": "西葫芦",     "calories": 17,  "protein": 1.2,  "fat": 0.3, "carbs": 3.1,  "category": "Vegetable", "aliases": "zucchini,courgette"},
    {"name": "asparagus",               "display_name": "芦笋",       "calories": 20,  "protein": 2.2,  "fat": 0.1, "carbs": 3.9,  "category": "Vegetable", "aliases": "asparagus"},
    {"name": "bok choy",                "display_name": "小白菜",     "calories": 13,  "protein": 1.5,  "fat": 0.2, "carbs": 2.2,  "category": "Vegetable", "aliases": "bok choy,pak choi"},
    {"name": "pumpkin",                 "display_name": "南瓜",       "calories": 26,  "protein": 1.0,  "fat": 0.1, "carbs": 6.5,  "category": "Vegetable", "aliases": "pumpkin"},

    # ── Fruit ──────────────────────────────────────────────────────────────
    {"name": "banana",                  "display_name": "香蕉",       "calories": 89,  "protein": 1.1,  "fat": 0.3, "carbs": 22.8, "category": "Fruit",     "aliases": "banana"},
    {"name": "apple",                   "display_name": "苹果",       "calories": 52,  "protein": 0.3,  "fat": 0.2, "carbs": 13.8, "category": "Fruit",     "aliases": "apple"},
    {"name": "orange",                  "display_name": "橙子",       "calories": 47,  "protein": 0.9,  "fat": 0.1, "carbs": 11.8, "category": "Fruit",     "aliases": "orange"},
    {"name": "strawberry",              "display_name": "草莓",       "calories": 32,  "protein": 0.7,  "fat": 0.3, "carbs": 7.7,  "category": "Fruit",     "aliases": "strawberry"},
    {"name": "blueberry",               "display_name": "蓝莓",       "calories": 57,  "protein": 0.7,  "fat": 0.3, "carbs": 14.5, "category": "Fruit",     "aliases": "blueberry"},
    {"name": "grape",                   "display_name": "葡萄",       "calories": 69,  "protein": 0.7,  "fat": 0.2, "carbs": 18.1, "category": "Fruit",     "aliases": "grape"},
    {"name": "watermelon",              "display_name": "西瓜",       "calories": 30,  "protein": 0.6,  "fat": 0.2, "carbs": 7.6,  "category": "Fruit",     "aliases": "watermelon"},
    {"name": "mango",                   "display_name": "芒果",       "calories": 60,  "protein": 0.8,  "fat": 0.4, "carbs": 15.0, "category": "Fruit",     "aliases": "mango"},
    {"name": "pineapple",               "display_name": "菠萝",       "calories": 50,  "protein": 0.5,  "fat": 0.1, "carbs": 13.1, "category": "Fruit",     "aliases": "pineapple"},
    {"name": "peach",                   "display_name": "桃子",       "calories": 39,  "protein": 0.9,  "fat": 0.3, "carbs": 9.5,  "category": "Fruit",     "aliases": "peach"},
    {"name": "pear",                    "display_name": "梨",         "calories": 57,  "protein": 0.4,  "fat": 0.1, "carbs": 15.2, "category": "Fruit",     "aliases": "pear"},
    {"name": "kiwi",                    "display_name": "猕猴桃",     "calories": 61,  "protein": 1.1,  "fat": 0.5, "carbs": 14.7, "category": "Fruit",     "aliases": "kiwi,kiwifruit"},
    {"name": "avocado",                 "display_name": "牛油果",     "calories": 160, "protein": 2.0,  "fat": 14.7,"carbs": 8.5,  "category": "Fruit",     "aliases": "avocado"},
    {"name": "lemon",                   "display_name": "柠檬",       "calories": 29,  "protein": 1.1,  "fat": 0.3, "carbs": 9.3,  "category": "Fruit",     "aliases": "lemon"},
    {"name": "cherry",                  "display_name": "樱桃",       "calories": 50,  "protein": 1.0,  "fat": 0.3, "carbs": 12.2, "category": "Fruit",     "aliases": "cherry"},

    # ── Dairy ──────────────────────────────────────────────────────────────
    {"name": "whole milk",              "display_name": "全脂牛奶",   "calories": 61,  "protein": 3.2,  "fat": 3.3, "carbs": 4.8,  "category": "Dairy",     "aliases": "milk,whole milk"},
    {"name": "low fat milk",            "display_name": "低脂牛奶",   "calories": 42,  "protein": 3.4,  "fat": 1.0, "carbs": 5.0,  "category": "Dairy",     "aliases": "skim milk,low fat milk"},
    {"name": "greek yogurt plain",      "display_name": "希腊酸奶",   "calories": 59,  "protein": 10.2, "fat": 0.4, "carbs": 3.6,  "category": "Dairy",     "aliases": "greek yogurt"},
    {"name": "plain yogurt",            "display_name": "原味酸奶",   "calories": 61,  "protein": 3.5,  "fat": 3.3, "carbs": 4.7,  "category": "Dairy",     "aliases": "yogurt"},
    {"name": "cheddar cheese",          "display_name": "切达奶酪",   "calories": 403, "protein": 24.9, "fat": 33.1,"carbs": 1.3,  "category": "Dairy",     "aliases": "cheddar,cheese"},
    {"name": "mozzarella cheese",       "display_name": "马苏里拉奶酪","calories": 280, "protein": 19.4, "fat": 17.1,"carbs": 2.2,  "category": "Dairy",     "aliases": "mozzarella"},
    {"name": "cottage cheese",          "display_name": "茅屋奶酪",   "calories": 98,  "protein": 11.1, "fat": 4.3, "carbs": 3.4,  "category": "Dairy",     "aliases": "cottage cheese"},
    {"name": "butter",                  "display_name": "黄油",       "calories": 717, "protein": 0.9,  "fat": 81.1,"carbs": 0.1,  "category": "Dairy",     "aliases": "butter"},
    {"name": "cream cheese",            "display_name": "奶油奶酪",   "calories": 342, "protein": 6.2,  "fat": 33.8,"carbs": 4.1,  "category": "Dairy",     "aliases": "cream cheese"},

    # ── Seafood ────────────────────────────────────────────────────────────
    {"name": "salmon cooked",           "display_name": "三文鱼",     "calories": 208, "protein": 20.4, "fat": 13.4,"carbs": 0.0,  "category": "Seafood",   "aliases": "salmon"},
    {"name": "tuna canned in water",    "display_name": "金枪鱼",     "calories": 116, "protein": 25.5, "fat": 1.0, "carbs": 0.0,  "category": "Seafood",   "aliases": "tuna"},
    {"name": "shrimp cooked",           "display_name": "虾",         "calories": 99,  "protein": 18.8, "fat": 1.7, "carbs": 0.2,  "category": "Seafood",   "aliases": "shrimp,prawn"},
    {"name": "cod cooked",              "display_name": "鳕鱼",       "calories": 105, "protein": 22.8, "fat": 0.9, "carbs": 0.0,  "category": "Seafood",   "aliases": "cod,white fish"},
    {"name": "tilapia cooked",          "display_name": "罗非鱼",     "calories": 128, "protein": 26.2, "fat": 2.7, "carbs": 0.0,  "category": "Seafood",   "aliases": "tilapia"},
    {"name": "crab cooked",             "display_name": "螃蟹",       "calories": 97,  "protein": 19.4, "fat": 1.8, "carbs": 0.0,  "category": "Seafood",   "aliases": "crab"},
    {"name": "sardines canned",         "display_name": "沙丁鱼",     "calories": 208, "protein": 24.6, "fat": 11.5,"carbs": 0.0,  "category": "Seafood",   "aliases": "sardines"},
    {"name": "mackerel cooked",         "display_name": "鲭鱼",       "calories": 205, "protein": 18.6, "fat": 13.9,"carbs": 0.0,  "category": "Seafood",   "aliases": "mackerel"},
    {"name": "squid cooked",            "display_name": "鱿鱼",       "calories": 92,  "protein": 15.6, "fat": 1.4, "carbs": 3.1,  "category": "Seafood",   "aliases": "squid,calamari"},
    {"name": "oyster cooked",           "display_name": "牡蛎",       "calories": 79,  "protein": 9.0,  "fat": 2.5, "carbs": 4.7,  "category": "Seafood",   "aliases": "oyster"},

    # ── Beverage ───────────────────────────────────────────────────────────
    {"name": "orange juice",            "display_name": "橙汁",       "calories": 45,  "protein": 0.7,  "fat": 0.2, "carbs": 10.4, "category": "Beverage",  "aliases": "orange juice,OJ"},
    {"name": "apple juice",             "display_name": "苹果汁",     "calories": 46,  "protein": 0.1,  "fat": 0.1, "carbs": 11.4, "category": "Beverage",  "aliases": "apple juice"},
    {"name": "green tea",               "display_name": "绿茶",       "calories": 1,   "protein": 0.2,  "fat": 0.0, "carbs": 0.2,  "category": "Beverage",  "aliases": "green tea"},
    {"name": "coffee black",            "display_name": "黑咖啡",     "calories": 2,   "protein": 0.3,  "fat": 0.0, "carbs": 0.0,  "category": "Beverage",  "aliases": "coffee,black coffee"},
    {"name": "soy milk",                "display_name": "豆浆",       "calories": 33,  "protein": 2.9,  "fat": 1.5, "carbs": 1.8,  "category": "Beverage",  "aliases": "soy milk"},
    {"name": "coconut water",           "display_name": "椰子水",     "calories": 19,  "protein": 0.7,  "fat": 0.2, "carbs": 3.7,  "category": "Beverage",  "aliases": "coconut water"},
    {"name": "sports drink",            "display_name": "运动饮料",   "calories": 26,  "protein": 0.0,  "fat": 0.1, "carbs": 6.8,  "category": "Beverage",  "aliases": "gatorade,sports drink"},
    {"name": "whole milk latte",        "display_name": "拿铁",       "calories": 42,  "protein": 2.4,  "fat": 1.7, "carbs": 4.8,  "category": "Beverage",  "aliases": "latte,cafe latte"},

    # ── Other ──────────────────────────────────────────────────────────────
    {"name": "olive oil",               "display_name": "橄榄油",     "calories": 884, "protein": 0.0,  "fat": 100.0,"carbs": 0.0, "category": "Other",     "aliases": "olive oil"},
    {"name": "peanut butter",           "display_name": "花生酱",     "calories": 588, "protein": 25.1, "fat": 50.4,"carbs": 20.0, "category": "Other",     "aliases": "peanut butter"},
    {"name": "honey",                   "display_name": "蜂蜜",       "calories": 304, "protein": 0.3,  "fat": 0.0, "carbs": 82.4, "category": "Other",     "aliases": "honey"},
    {"name": "almonds",                 "display_name": "杏仁",       "calories": 579, "protein": 21.2, "fat": 49.9,"carbs": 21.6, "category": "Other",     "aliases": "almonds"},
    {"name": "walnuts",                 "display_name": "核桃",       "calories": 654, "protein": 15.2, "fat": 65.2,"carbs": 13.7, "category": "Other",     "aliases": "walnuts"},
    {"name": "dark chocolate",          "display_name": "黑巧克力",   "calories": 546, "protein": 5.5,  "fat": 31.3,"carbs": 63.1, "category": "Other",     "aliases": "dark chocolate"},
    {"name": "cashews",                 "display_name": "腰果",       "calories": 553, "protein": 18.2, "fat": 43.9,"carbs": 30.2, "category": "Other",     "aliases": "cashews"},
    {"name": "sunflower seeds",         "display_name": "葵花籽",     "calories": 584, "protein": 20.8, "fat": 51.5,"carbs": 20.0, "category": "Other",     "aliases": "sunflower seeds"},
    {"name": "pizza",                   "display_name": "披萨",       "calories": 266, "protein": 11.0, "fat": 10.0,"carbs": 33.0, "category": "Other",     "aliases": "pizza"},
    {"name": "potato chips",            "display_name": "薯片",       "calories": 536, "protein": 7.0,  "fat": 35.0,"carbs": 53.0, "category": "Other",     "aliases": "chips,crisps"},
]


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
        "imageUrl": None,
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
