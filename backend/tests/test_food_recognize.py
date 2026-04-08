from io import BytesIO

from app.services.food.matching import FoodForMatch, match_food_labels
from app.services.food.stepfun import try_parse_string_array


def test_parse_stepfun_string_array_variants():
    assert try_parse_string_array('["banana","pizza"]') == ["banana", "pizza"]
    assert try_parse_string_array('```json\n["banana"]\n```') == ["banana"]
    assert try_parse_string_array('{"foods":["banana","pizza"]}') == ["banana", "pizza"]


def test_food_label_matching():
    foods = [
        FoodForMatch(id=1, name="banana", display_name="Banana", aliases=[]),
        FoodForMatch(id=2, name="french fries", display_name="French Fries", aliases=["fries"]),
    ]
    matched_ids, unmatched = match_food_labels(["bananas", "fries", "unknown item"], foods)
    assert matched_ids == [1, 2]
    assert unmatched == ["unknown item"]


def test_recognize_requires_stepfun_config(client):
    response = client.post(
        "/api/recognize",
        data={"image": (BytesIO(b"fake image"), "food.jpg", "image/jpeg")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 503
    assert response.get_json()["error"] == "stepfun not configured"
