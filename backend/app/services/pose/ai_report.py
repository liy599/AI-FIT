from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import request


@dataclass
class AiEnhancedReportResult:
    ok: bool
    report: dict[str, Any]
    raw_text: str
    error: str | None
    provider: str
    model: str | None


_ALLOWED_SEVERITIES = {"info", "warning", "error"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _strip_code_fences(input_text: str) -> str:
    stripped = (input_text or "").strip()
    if not stripped.startswith("```"):
        return stripped
    line_end = stripped.find("\n")
    if line_end == -1:
        return ""
    stripped = stripped[line_end + 1 :]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


def _as_nonempty_str(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _validate_issue(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    severity = _as_nonempty_str(value.get("severity"))
    title = _as_nonempty_str(value.get("title"))
    evidence = value.get("evidence")
    if severity not in _ALLOWED_SEVERITIES or title is None:
        return False
    if evidence is not None and _as_nonempty_str(evidence) is None:
        return False
    return True


def validate_ai_enhanced_report_v1(
    value: Any,
    *,
    expected_language: str | None = None,
    expected_provider: str | None = None,
    expected_model: str | None = None,
    allowed_statuses: set[str] | None = None,
) -> tuple[bool, str | None]:
    if not isinstance(value, dict):
        return False, "top must be object"

    version = value.get("version")
    if version != 1:
        return False, "version must be 1"

    language = _as_nonempty_str(value.get("language"))
    if language is None:
        return False, "language required"
    if expected_language is not None and language != expected_language:
        return False, "language mismatch"

    score = value.get("score")
    if score is not None and not isinstance(score, (int, float)):
        return False, "score must be number|null"

    title = _as_nonempty_str(value.get("title"))
    summary = _as_nonempty_str(value.get("summary"))
    if title is None or summary is None:
        return False, "title and summary required"

    issues = value.get("issues")
    if not isinstance(issues, list):
        return False, "issues must be array"
    for item in issues:
        if not _validate_issue(item):
            return False, "invalid issue item"

    suggestions = value.get("suggestions")
    if not isinstance(suggestions, list):
        return False, "suggestions must be array"
    for item in suggestions:
        if _as_nonempty_str(item) is None:
            return False, "suggestions must be string[]"

    source = value.get("source")
    if not isinstance(source, dict):
        return False, "source required"
    provider = _as_nonempty_str(source.get("provider"))
    if provider is None:
        return False, "source.provider required"
    if expected_provider is not None and provider != expected_provider:
        return False, "source.provider mismatch"
    model = source.get("model")
    if model is not None and not isinstance(model, str):
        return False, "source.model must be string|null"
    if expected_model is not None and model != expected_model:
        return False, "source.model mismatch"

    disclaimer = value.get("disclaimer")
    if disclaimer is not None and not isinstance(disclaimer, str):
        return False, "disclaimer must be string|null"

    return True, None


def build_fallback_ai_enhanced_report_v1(base_report: dict[str, Any], *, language: str) -> dict[str, Any]:
    summary = _as_nonempty_str(base_report.get("summary")) or ""
    title = "AI Enhanced Training Report"

    score = None
    candidate_scores = []
    key_metrics = base_report.get("keyMetrics") if isinstance(base_report.get("keyMetrics"), dict) else {}
    if isinstance(key_metrics, dict):
        for key in ["score", "formScore", "accuracy", "accuracyPct", "stabilityScore", "mobilityScore", "rhythmScore", "symmetryScore"]:
            value = key_metrics.get(key)
            if isinstance(value, (int, float)):
                candidate_scores.append(float(value))
    if candidate_scores:
        score = max(0, min(100, round(candidate_scores[0], 1)))

    issues_in = base_report.get("issues") if isinstance(base_report.get("issues"), list) else []
    issues: list[dict[str, Any]] = []
    for raw in issues_in[:12]:
        if not isinstance(raw, dict):
            continue
        code = _as_nonempty_str(raw.get("code")) or "unknown"
        severity = _as_nonempty_str(raw.get("severity")) or "info"
        if severity not in _ALLOWED_SEVERITIES:
            severity = "info"
        message = _as_nonempty_str(raw.get("message")) or code
        at_frame = raw.get("atFrame")
        evidence = None
        if isinstance(at_frame, int):
            evidence = f"atFrame={at_frame}"
        issues.append(
            {
                "severity": severity,
                "title": message[:120],
                "evidence": evidence,
            }
        )

    suggestions = base_report.get("suggestions") if isinstance(base_report.get("suggestions"), list) else []
    suggestion_list = []
    for item in suggestions[:6]:
        s = _as_nonempty_str(item)
        if s:
            suggestion_list.append(s[:200])

    report: dict[str, Any] = {
        "version": 1,
        "language": language,
        "score": score,
        "title": title,
        "summary": summary,
        "issues": issues,
        "suggestions": suggestion_list,
        "disclaimer": "This content is for fitness guidance only and is not medical advice.",
        "source": {"provider": "fallback", "model": None},
    }
    return report


def _compact_base_report(base_report: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in ["version", "generatedAt", "status", "summary", "keyMetrics", "issues", "suggestions", "task", "exercise", "video"]:
        value = base_report.get(key)
        if value is None:
            continue
        out[key] = value
    issues = out.get("issues")
    if isinstance(issues, list) and len(issues) > 30:
        out["issues"] = issues[:30]
    suggestions = out.get("suggestions")
    if isinstance(suggestions, list) and len(suggestions) > 20:
        out["suggestions"] = suggestions[:20]
    return out


def generate_ai_enhanced_report_v1(
    *,
    api_url: str,
    api_key: str,
    model: str,
    base_report: dict[str, Any],
    language: str,
    timeout_seconds: int,
    max_input_chars: int,
) -> AiEnhancedReportResult:
    provider = "stepfun"
    compact = _compact_base_report(base_report)
    base_json = json.dumps(compact, ensure_ascii=False)
    if max_input_chars > 0 and len(base_json) > max_input_chars:
        compact = {k: compact.get(k) for k in ["version", "status", "summary", "keyMetrics", "issues", "suggestions"]}
        base_json = json.dumps(compact, ensure_ascii=False)
        if len(base_json) > max_input_chars:
            base_json = base_json[:max_input_chars]

    schema = {
        "version": 1,
        "language": language,
        "score": "number|null",
        "title": "string",
        "summary": "string",
        "issues": [{"title": "string", "severity": "info|warning|error", "evidence": "string|null"}],
        "suggestions": ["string"],
        "disclaimer": "string|null",
        "source": {"provider": provider, "model": model},
    }

    system_text = "You are a JSON generator. Reply with JSON only. Do not use Markdown. Do not wrap in code fences."
    user_text = "\n".join(
        [
            "Given the pose analysis report JSON below, generate an enhanced coaching report.",
            "Output MUST be a single JSON object matching this schema, with correct types and required keys:",
            json.dumps(schema, ensure_ascii=False),
            "Constraints:",
            "- use concise and plain user-friendly English",
            "- score can be null when insufficient confidence",
            "- suggestions should be actionable",
            "- language must equal the provided language",
            "Input report JSON:",
            base_json,
        ]
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
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
        return AiEnhancedReportResult(
            ok=False,
            report={},
            raw_text=str(exc),
            error="request_failed",
            provider=provider,
            model=model,
        )

    choices = raw_json.get("choices") if isinstance(raw_json, dict) else None
    first = choices[0] if isinstance(choices, list) and choices else {}
    message = first.get("message") if isinstance(first, dict) else {}
    raw_text = ""
    if isinstance(message, dict) and isinstance(message.get("content"), str):
        raw_text = message["content"]
    elif isinstance(raw_json, str):
        raw_text = raw_json
    else:
        raw_text = json.dumps(raw_json, ensure_ascii=False)

    trimmed = _strip_code_fences(raw_text)
    try:
        parsed = json.loads(trimmed)
    except Exception:
        return AiEnhancedReportResult(
            ok=False,
            report={},
            raw_text=raw_text,
            error="invalid_json",
            provider=provider,
            model=model,
        )

    ok, err = validate_ai_enhanced_report_v1(
        parsed,
        expected_language=language,
        expected_provider=provider,
        expected_model=model,
        allowed_statuses={"ok"},
    )
    if not ok:
        return AiEnhancedReportResult(
            ok=False,
            report={},
            raw_text=raw_text,
            error=err or "invalid_schema",
            provider=provider,
            model=model,
        )

    return AiEnhancedReportResult(
        ok=True,
        report=parsed,
        raw_text=raw_text,
        error=None,
        provider=provider,
        model=model,
    )
