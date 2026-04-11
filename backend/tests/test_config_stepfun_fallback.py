import importlib

import app.config as config_module


def test_ai_report_defaults_to_stepfun(monkeypatch):
    monkeypatch.setenv("STEPFUN_API_URL", "https://stepfun.example/v1/chat/completions")
    monkeypatch.setenv("STEPFUN_API_KEY", "stepfun-key")
    monkeypatch.setenv("STEPFUN_MODEL", "stepfun-model")
    monkeypatch.delenv("AI_REPORT_API_URL", raising=False)
    monkeypatch.delenv("AI_REPORT_API_KEY", raising=False)
    monkeypatch.delenv("AI_REPORT_MODEL", raising=False)

    cfg = importlib.reload(config_module).Config

    assert cfg.AI_REPORT_API_URL == "https://stepfun.example/v1/chat/completions"
    assert cfg.AI_REPORT_API_KEY == "stepfun-key"
    assert cfg.AI_REPORT_MODEL == "stepfun-model"


def test_ai_report_explicit_values_override_stepfun(monkeypatch):
    monkeypatch.setenv("STEPFUN_API_URL", "https://stepfun.example/v1/chat/completions")
    monkeypatch.setenv("STEPFUN_API_KEY", "stepfun-key")
    monkeypatch.setenv("STEPFUN_MODEL", "stepfun-model")
    monkeypatch.setenv("AI_REPORT_API_URL", "https://report.example/v1/chat/completions")
    monkeypatch.setenv("AI_REPORT_API_KEY", "report-key")
    monkeypatch.setenv("AI_REPORT_MODEL", "report-model")

    cfg = importlib.reload(config_module).Config

    assert cfg.AI_REPORT_API_URL == "https://report.example/v1/chat/completions"
    assert cfg.AI_REPORT_API_KEY == "report-key"
    assert cfg.AI_REPORT_MODEL == "report-model"

