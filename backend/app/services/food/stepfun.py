from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import request


@dataclass
class StepfunRecognizeResult:
    ok: bool
    labels: list[str]
    raw_text: str


def try_parse_string_array(text: str) -> list[str]:
    value = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = json.loads(value)
    except Exception:
        left, right = value.find("["), value.rfind("]")
        if left < 0 or right <= left:
            return []
        try:
            parsed = json.loads(value[left:right + 1])
        except Exception:
            return []
    if isinstance(parsed, dict):
        for key in ("food", "foods", "labels", "items", "result", "data"):
            if isinstance(parsed.get(key), list):
                parsed = parsed[key]
                break
    if not isinstance(parsed, list):
        return []
    return list(dict.fromkeys(str(item).strip() for item in parsed if str(item).strip()))


def recognize_foods_by_stepfun(*, api_url: str, api_key: str, model: str, image_data_url: str,
                               timeout_seconds: int = 20) -> StepfunRecognizeResult:
    payload = {"model": model, "messages": [{"role": "user", "content": [
        {"type": "text", "text": "Return ONLY a JSON array of concise English food names."},
        {"type": "image_url", "image_url": {"url": image_data_url}},
    ]}], "temperature": 0.2}
    req = request.Request(api_url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST")
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            raw_json = json.loads(response.read().decode())
    except Exception as exc:
        return StepfunRecognizeResult(False, [], str(exc))
    choices = raw_json.get("choices", []) if isinstance(raw_json, dict) else []
    message = choices[0].get("message", {}) if choices else {}
    raw_text = message.get("content", "") if isinstance(message, dict) else ""
    if not isinstance(raw_text, str):
        raw_text = json.dumps(raw_json)
    return StepfunRecognizeResult(True, try_parse_string_array(raw_text), raw_text)
