import json
import urllib.parse
import urllib.request

from flask import Blueprint, jsonify, request

bp = Blueprint("nutrition", __name__)


def _fetch_open_food_facts(food_name: str):
    query = urllib.parse.urlencode(
        {
            "search_terms": food_name,
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": 1,
        }
    )
    url = f"https://world.openfoodfacts.org/cgi/search.pl?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "AI-FitGuard/1.0"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    products = payload.get("products") or []
    return products[0] if products else None


@bp.post("/analyze")
def analyze():
    data = request.get_json(silent=True) or {}
    food_name = (data.get("food_name") or "").strip()
    if not food_name:
        return jsonify({"error": "food_name required"}), 400

    try:
        product = _fetch_open_food_facts(food_name)
    except Exception:
        product = None

    if not product:
        return jsonify(
            {
                "food_name": food_name,
                "source": "mock",
                "nutrition_per_100g": {"calories_kcal": None, "protein_g": None, "fat_g": None, "carbohydrates_g": None},
            }
        )

    nutr = product.get("nutriments") or {}
    result = {
        "food_name": product.get("product_name") or food_name,
        "source": "openfoodfacts",
        "image_url": product.get("image_url"),
        "nutrition_per_100g": {
            "calories_kcal": nutr.get("energy-kcal_100g"),
            "protein_g": nutr.get("proteins_100g"),
            "fat_g": nutr.get("fat_100g"),
            "carbohydrates_g": nutr.get("carbohydrates_100g"),
            "fiber_g": nutr.get("fiber_100g"),
            "sugar_g": nutr.get("sugars_100g"),
            "salt_g": nutr.get("salt_100g"),
        },
    }
    return jsonify(result)

