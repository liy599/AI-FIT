from io import BytesIO

from app.services.food.stepfun import StepfunRecognizeResult
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


def test_recognize_uses_ai_report_config_as_fallback(client, monkeypatch):
    app = client.application
    app.config["STEPFUN_API_URL"] = ""
    app.config["STEPFUN_API_KEY"] = ""
    app.config["STEPFUN_MODEL"] = ""
    app.config["AI_REPORT_API_URL"] = "https://example.invalid/v1/chat/completions"
    app.config["AI_REPORT_API_KEY"] = "dummy-key"
    app.config["AI_REPORT_MODEL"] = "dummy-model"

    called = {}

    def fake_recognize_foods_by_stepfun(*, api_url, api_key, model, image_data_url, timeout_seconds=20):
        called["api_url"] = api_url
        called["api_key"] = api_key
        called["model"] = model
        called["image_data_url"] = image_data_url
        called["timeout_seconds"] = timeout_seconds
        return StepfunRecognizeResult(ok=True, labels=[], raw_text="[]")

    monkeypatch.setattr("app.routes.recognize.recognize_foods_by_stepfun", fake_recognize_foods_by_stepfun)

    response = client.post(
        "/api/recognize",
        data={"image": (BytesIO(b"fake image"), "food.jpg", "image/jpeg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.get_json()["names"] == []
    assert called["api_url"] == "https://example.invalid/v1/chat/completions"
    assert called["api_key"] == "dummy-key"
    assert called["model"] == "dummy-model"
