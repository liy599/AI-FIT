from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import request

RECOGNIZE_PROMPT = (
    "You are a nutrition assistant estimating what is on a plate from a single photo. "
    "Identify each distinct food item visible. For each item, estimate its portion weight in "
    "grams by reasoning step by step: (1) identify any visible reference objects such as the "
    "plate/bowl diameter (a standard dinner plate is about 26-28cm), utensils, a hand, or a "
    "coin/card, (2) judge the food's area and height relative to that reference, (3) convert to "
    "a weight estimate in grams. Also return a confidence from 0 to 1 for each estimate. "
    "Return ONLY a JSON array, no prose, no markdown fences, shaped exactly like: "
    '[{"name": "white rice", "estimated_grams": 180, "confidence": 0.6}]. '
    "Use concise English food names. If you cannot see the food clearly enough to estimate a "
    "weight, still include the item with your best guess and a low confidence value."
)


@dataclass(frozen=True)
class RecognizedFoodItem:
    name: str
    estimated_grams: float | None
    confidence: float | None


@dataclass
class StepfunRecognizeResult:
    ok: bool
    items: list[RecognizedFoodItem]
    raw_text: str


def _coerce_float(value) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed or parsed < 0:  # NaN or negative
        return None
    return parsed


def _coerce_confidence(value) -> float | None:
    parsed = _coerce_float(value)
    if parsed is None:
        return None
    return max(0.0, min(1.0, parsed))


def try_parse_food_items(text: str) -> list[RecognizedFoodItem]:
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

    items: list[RecognizedFoodItem] = []
    seen: set[str] = set()
    for entry in parsed:
        if isinstance(entry, dict):
            name = str(entry.get("name") or entry.get("food") or entry.get("label") or "").strip()
            grams = _coerce_float(entry.get("estimated_grams", entry.get("grams")))
            confidence = _coerce_confidence(entry.get("confidence"))
        else:
            name = str(entry).strip()
            grams = None
            confidence = None
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        items.append(RecognizedFoodItem(name=name, estimated_grams=grams, confidence=confidence))
    return items


def recognize_foods_by_stepfun(*, api_url: str, api_key: str, model: str, image_data_url: str,
                               timeout_seconds: int = 20) -> StepfunRecognizeResult:
    payload = {"model": model, "messages": [{"role": "user", "content": [
        {"type": "text", "text": RECOGNIZE_PROMPT},
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
    return StepfunRecognizeResult(True, try_parse_food_items(raw_text), raw_text)
