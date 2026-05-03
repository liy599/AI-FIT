import json


def register_and_token(client, email="pose-ai@example.com", username="pose-ai-user", password="pass1234"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["user"]["id"]


def auth_headers(client):
    csrf_cookie = client.get_cookie("csrf_access_token")
    csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
    return {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}


def test_pose_ai_report_requires_jwt(client):
    response = client.post("/api/pose/reports/ai", json={"report": {"version": 3}})
    assert response.status_code in {401, 422}


def test_pose_ai_report_degrades_when_not_configured(client):
    token = register_and_token(client)
    _ = token
    base_report = {
        "version": 3,
        "status": "ok",
        "summary": "analysis ok",
        "keyMetrics": {"avgScore": 88},
        "issues": [{"code": "knee_in", "severity": "warning", "message": "knee caves in", "atFrame": 12}],
        "suggestions": ["keep knees out"],
    }
    response = client.post("/api/pose/reports/ai", headers=auth_headers(client), json={"report": base_report, "language": "zh-CN"})
    assert response.status_code == 200
    payload = response.get_json()
    report = payload["report"]
    assert report["version"] == 1
    assert report["language"] == "zh-CN"
    assert report["score"] is None or isinstance(report["score"], (int, float))
    assert "analysis ok" in report["summary"]
    assert report["source"]["provider"] == "fallback"
    assert isinstance(report["issues"], list)
    assert isinstance(report["suggestions"], list)
    assert payload["meta"]["degraded"] is True


def test_pose_ai_report_degrades_on_invalid_ai_json(client, monkeypatch):
    token = register_and_token(client, email="pose-ai2@example.com", username="pose-ai-user-2")
    _ = token
    app = client.application
    app.config["POSE_REPORT_AI_ENABLED"] = "1"
    app.config["STEPFUN_API_URL"] = "https://example.invalid/v1/chat/completions"
    app.config["STEPFUN_API_KEY"] = "dummy"
    app.config["STEPFUN_MODEL"] = "dummy-model"

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({"choices": [{"message": {"content": "not json"}}]}).encode("utf-8")

    def fake_urlopen(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("app.services.pose.ai_report.request.urlopen", fake_urlopen)

    base_report = {"version": 3, "status": "ok", "summary": "analysis ok", "keyMetrics": {}, "issues": [], "suggestions": []}
    response = client.post("/api/pose/reports/ai", headers=auth_headers(client), json={"report": base_report, "language": "zh-CN", "debug": True})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["meta"]["degraded"] is True
    assert payload["meta"]["ai"]["used"] is True
    assert payload["meta"]["ai"]["ok"] is False
    assert payload["report"]["source"]["provider"] == "fallback"


def test_pose_ai_report_degrades_on_timeout(client, monkeypatch):
    token = register_and_token(client, email="pose-ai3@example.com", username="pose-ai-user-3")
    _ = token
    app = client.application
    app.config["POSE_REPORT_AI_ENABLED"] = "1"
    app.config["STEPFUN_API_URL"] = "https://example.invalid/v1/chat/completions"
    app.config["STEPFUN_API_KEY"] = "dummy"
    app.config["STEPFUN_MODEL"] = "dummy-model"

    def fake_urlopen(*args, **kwargs):
        raise TimeoutError("timeout")

    monkeypatch.setattr("app.services.pose.ai_report.request.urlopen", fake_urlopen)

    base_report = {"version": 3, "status": "ok", "summary": "analysis ok", "keyMetrics": {}, "issues": [], "suggestions": []}
    response = client.post("/api/pose/reports/ai", headers=auth_headers(client), json={"report": base_report, "language": "zh-CN"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["meta"]["degraded"] is True
    assert payload["meta"]["ai"]["used"] is True
    assert payload["meta"]["ai"]["ok"] is False
    assert payload["meta"]["ai"]["error"] == "request_failed"


def test_pose_ai_report_returns_ok_when_ai_schema_valid(client, monkeypatch):
    token = register_and_token(client, email="pose-ai4@example.com", username="pose-ai-user-4")
    _ = token
    app = client.application
    app.config["POSE_REPORT_AI_ENABLED"] = "1"
    app.config["STEPFUN_API_URL"] = "https://example.invalid/v1/chat/completions"
    app.config["STEPFUN_API_KEY"] = "dummy"
    app.config["STEPFUN_MODEL"] = "dummy-model"

    ai_report = {
        "version": 1,
        "language": "zh-CN",
        "score": 86,
        "title": "测试增强报告",
        "summary": "更易读的总结",
        "issues": [{"title": "膝盖内扣", "severity": "warning", "evidence": "set 2"}],
        "suggestions": ["Keep knees out", "Control descent speed"],
        "disclaimer": None,
        "source": {"provider": "stepfun", "model": "dummy-model"},
    }

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({"choices": [{"message": {"content": json.dumps(ai_report, ensure_ascii=False)}}]}).encode("utf-8")

    def fake_urlopen(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("app.services.pose.ai_report.request.urlopen", fake_urlopen)

    base_report = {"version": 3, "status": "ok", "summary": "analysis ok", "keyMetrics": {"avgScore": 88}, "issues": [], "suggestions": []}
    response = client.post("/api/pose/reports/ai", headers=auth_headers(client), json={"report": base_report, "language": "zh-CN"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["meta"]["degraded"] is False
    assert payload["meta"]["ai"]["used"] is True
    assert payload["meta"]["ai"]["ok"] is True
    assert payload["report"]["score"] == 86
    assert payload["report"]["source"]["provider"] == "stepfun"
    assert payload["report"]["source"]["model"] == "dummy-model"
