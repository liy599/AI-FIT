from io import BytesIO

from app.services.food.matching import FoodForMatch, match_food_labels
from app.services.food.stepfun import StepfunRecognizeResult, try_parse_string_array


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


def test_recognize_uses_ai_report_env_fallback(client, monkeypatch):
    app = client.application
    app.config["STEPFUN_API_URL"] = ""
    app.config["STEPFUN_API_KEY"] = ""
    app.config["STEPFUN_MODEL"] = ""
    app.config["AI_REPORT_API_URL"] = "https://example.invalid/v1/chat/completions"
    app.config["AI_REPORT_API_KEY"] = "dummy-ai-report-key"
    app.config["AI_REPORT_MODEL"] = "dummy-ai-report-model"

    captured: dict[str, str] = {}

    def fake_recognize(*, api_url: str, api_key: str, model: str, image_data_url: str, timeout_seconds: int = 20):
        captured["api_url"] = api_url
        captured["api_key"] = api_key
        captured["model"] = model
        captured["image_data_url"] = image_data_url
        return StepfunRecognizeResult(ok=True, labels=["banana"], raw_text='["banana"]')

    monkeypatch.setattr("app.routes.food.recognize.recognize_foods_by_stepfun", fake_recognize)
    monkeypatch.setattr("app.routes.food.recognize.match_food_labels", lambda labels, foods: ([1], []))

    response = client.post(
        "/api/recognize",
        data={"image": (BytesIO(b"fake image"), "food.jpg", "image/jpeg")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["names"] == ["banana"]
    assert payload["foodIds"] == [1]
    assert payload["unmatchedNames"] == []

    assert captured["api_url"] == "https://example.invalid/v1/chat/completions"
    assert captured["api_key"] == "dummy-ai-report-key"
    assert captured["model"] == "dummy-ai-report-model"
    assert captured["image_data_url"].startswith("data:image/jpeg;base64,")
