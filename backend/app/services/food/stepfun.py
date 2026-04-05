from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import request


@dataclass
class StepfunRecognizeResult:
    ok: bool
    labels: list[str]
    raw_text: str


def _strip_code_fences(input_text: str) -> str:
    stripped = input_text.strip()
    if not stripped.startswith("```"):
        return stripped
    line_end = stripped.find("\n")
    if line_end == -1:
        return ""
    stripped = stripped[line_end + 1 :]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


def _collect_strings(value, out: list[str]) -> None:
    if isinstance(value, str):
        candidate = value.strip()
        if candidate:
            out.append(candidate)
        return
    if isinstance(value, list):
        for item in value:
            _collect_strings(item, out)
        return
    if isinstance(value, dict):
        for item in value.values():
            _collect_strings(item, out)


def _uniq_strings(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        lowered = value.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        output.append(value)
    return output


def try_parse_string_array(input_text: str) -> list[str]:
    trimmed = _strip_code_fences(input_text)

    def safe_parse(text: str):
        try:
            return json.loads(text)
        except Exception:
            return None

    parsed_top = safe_parse(trimmed)
    if isinstance(parsed_top, list):
        strings: list[str] = []
        _collect_strings(parsed_top, strings)
        return _uniq_strings(strings)

    if isinstance(parsed_top, dict):
        for key in ["food", "foods", "labels", "items", "result", "data"]:
            value = parsed_top.get(key)
            if isinstance(value, list):
                strings: list[str] = []
                _collect_strings(value, strings)
                unique = _uniq_strings(strings)
                if unique:
                    return unique
            if isinstance(value, str):
                nested = try_parse_string_array(value)
                if nested:
                    return nested

        strings = []
        _collect_strings(parsed_top, strings)
        unique = _uniq_strings(strings)
        if unique:
            return unique

    left = trimmed.find("[")
    right = trimmed.rfind("]")
    if left >= 0 and right > left:
        parsed = safe_parse(trimmed[left : right + 1])
        if isinstance(parsed, list):
            strings = []
            _collect_strings(parsed, strings)
            return _uniq_strings(strings)

    return []


def recognize_foods_by_stepfun(
    *,
    api_url: str,
    api_key: str,
    model: str,
    image_data_url: str,
    timeout_seconds: int = 20,
) -> StepfunRecognizeResult:
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": " ".join(
                            [
                                "Return ONLY a JSON array of food names (strings).",
                                "No Markdown, no extra keys, no explanation.",
                                "Use concise English lowercase names that can match database entries.",
                                'Example: ["cola","french fries"].',
                                "If there is no food, return [].",
                            ]
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_url},
                    },
                ],
            }
        ],
        "temperature": 0.2,
    }

    req = request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            raw_json = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return StepfunRecognizeResult(ok=False, labels=[], raw_text=str(exc))

    choices = raw_json.get("choices") if isinstance(raw_json, dict) else None
    first = choices[0] if isinstance(choices, list) and choices else {}
    message = first.get("message") if isinstance(first, dict) else {}
    delta = first.get("delta") if isinstance(first, dict) else {}
    raw_text = ""
    if isinstance(message, dict) and isinstance(message.get("content"), str):
        raw_text = message["content"]
    elif isinstance(delta, dict) and isinstance(delta.get("content"), str):
        raw_text = delta["content"]
    elif isinstance(raw_json, str):
        raw_text = raw_json
    else:
        raw_text = json.dumps(raw_json, ensure_ascii=False)

    labels = try_parse_string_array(raw_text)
    return StepfunRecognizeResult(ok=True, labels=labels, raw_text=raw_text)
