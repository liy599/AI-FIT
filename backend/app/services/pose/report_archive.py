from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

_ISSUE_SEVERITIES = {"info", "warning", "error"}


def json_size_bytes(value: Any) -> int:
    try:
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return -1
    try:
        return len(text.encode("utf-8"))
    except Exception:
        return -1


def validate_training_report_schema(value: Any) -> tuple[bool, str | None]:
    if not isinstance(value, dict):
        return False, "top must be object"

    version = value.get("version")
    if version is not None:
        if not isinstance(version, int):
            return False, "version must be int"
        if version not in {1, 3}:
            return False, "unsupported version"

    status = value.get("status")
    if status is not None and (not isinstance(status, str) or not status.strip()):
        return False, "status must be non-empty string"

    summary = value.get("summary")
    if summary is not None and not isinstance(summary, str):
        return False, "summary must be string"

    key_metrics = value.get("keyMetrics")
    if key_metrics is not None and not isinstance(key_metrics, dict):
        return False, "keyMetrics must be object"

    issues = value.get("issues")
    if issues is not None:
        if not isinstance(issues, list):
            return False, "issues must be array"
        for item in issues:
            if not isinstance(item, dict):
                return False, "issue item must be object"
            severity = item.get("severity")
            if severity is not None:
                if not isinstance(severity, str) or severity not in _ISSUE_SEVERITIES:
                    return False, "invalid issue severity"
            message = item.get("message")
            if message is not None and not isinstance(message, str):
                return False, "invalid issue message"

    suggestions = value.get("suggestions")
    if suggestions is not None:
        if not isinstance(suggestions, list):
            return False, "suggestions must be array"
        for item in suggestions:
            if not isinstance(item, str):
                return False, "invalid suggestion item"

    details = value.get("details")
    if details is not None and not isinstance(details, dict):
        return False, "details must be object"

    sections = value.get("sections")
    if sections is not None and not isinstance(sections, dict):
        return False, "sections must be object"

    return True, None


def _clone_json(value: Any):
    try:
        return json.loads(json.dumps(value, ensure_ascii=False))
    except Exception:
        if isinstance(value, dict):
            return dict(value)
        return value


def _truncate_str(value: Any, max_chars: int) -> Any:
    if max_chars <= 0:
        return value
    if isinstance(value, str) and len(value) > max_chars:
        return value[:max_chars]
    return value


def _truncate_list(value: Any, max_items: int) -> Any:
    if max_items <= 0:
        return value
    if isinstance(value, list) and len(value) > max_items:
        return value[:max_items]
    return value


def compact_training_report(report: dict[str, Any], *, max_bytes: int) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    cur = _clone_json(report)
    if not isinstance(cur, dict):
        return {}, ["invalid_report_payload"]

    def shrink_strings():
        if "summary" in cur:
            cur["summary"] = _truncate_str(cur.get("summary"), 4000)
        if isinstance(cur.get("issues"), list):
            for item in cur["issues"]:
                if isinstance(item, dict):
                    item["message"] = _truncate_str(item.get("message"), 1000)
                    item["title"] = _truncate_str(item.get("title"), 300)
                    item["evidence"] = _truncate_str(item.get("evidence"), 800)
        if isinstance(cur.get("suggestions"), list):
            cur["suggestions"] = [_truncate_str(x, 300) for x in cur["suggestions"] if isinstance(x, str)]

    def drop_duplicate_sections():
        details = cur.get("details")
        sections = cur.get("sections")
        if isinstance(details, dict) and isinstance(sections, dict):
            if "timelineSampled" in details and "timelineSampled" in sections:
                sections.pop("timelineSampled", None)
                warnings.append("report_compacted_drop_sections_timelineSampled")
            if "gating" in details and "gating" in sections:
                sections.pop("gating", None)
                warnings.append("report_compacted_drop_sections_gating")

    def trim_timeline():
        details = cur.get("details")
        if isinstance(details, dict):
            if isinstance(details.get("timelineSampled"), list):
                before = len(details["timelineSampled"])
                details["timelineSampled"] = _truncate_list(details["timelineSampled"], 180)
                if len(details["timelineSampled"]) != before:
                    warnings.append("report_compacted_trim_details_timelineSampled")
            for k in ["timeline", "timelineRows", "frames", "landmarks", "keypoints", "rawFrames"]:
                if k in details:
                    details.pop(k, None)
                    warnings.append(f"report_compacted_drop_details_{k}")

    def trim_sections():
        sections = cur.get("sections")
        if isinstance(sections, dict):
            if isinstance(sections.get("timelineSampled"), list):
                before = len(sections["timelineSampled"])
                sections["timelineSampled"] = _truncate_list(sections["timelineSampled"], 180)
                if len(sections["timelineSampled"]) != before:
                    warnings.append("report_compacted_trim_sections_timelineSampled")

    def trim_lists():
        if isinstance(cur.get("issues"), list):
            before = len(cur["issues"])
            cur["issues"] = _truncate_list(cur["issues"], 200)
            if len(cur["issues"]) != before:
                warnings.append("report_compacted_trim_issues")
        if isinstance(cur.get("suggestions"), list):
            before = len(cur["suggestions"])
            cur["suggestions"] = _truncate_list(cur["suggestions"], 50)
            if len(cur["suggestions"]) != before:
                warnings.append("report_compacted_trim_suggestions")

    def drop_sections_entirely():
        if "sections" in cur:
            cur.pop("sections", None)
            warnings.append("report_compacted_drop_sections")

    def keep_minimal_shape():
        keep = {"version", "generatedAt", "status", "tool", "task", "exercise", "video", "summary", "keyMetrics", "issues", "suggestions", "details"}
        reduced = {k: cur.get(k) for k in keep if k in cur}
        reduced["details"] = reduced.get("details") if isinstance(reduced.get("details"), dict) else {}
        warnings.append("report_compacted_keep_minimal_shape")
        return reduced

    steps = [shrink_strings, trim_lists, drop_duplicate_sections, trim_timeline, trim_sections, drop_sections_entirely]
    for step in steps:
        step()
        if max_bytes > 0:
            size = json_size_bytes(cur)
            if size != -1 and size <= max_bytes:
                return cur, warnings

    if max_bytes > 0:
        minimal = keep_minimal_shape()
        if json_size_bytes(minimal) != -1 and json_size_bytes(minimal) <= max_bytes:
            return minimal, warnings

    return cur, warnings


def prepare_training_report_for_storage(
    report: dict[str, Any], *, max_bytes: int
) -> tuple[dict[str, Any] | None, list[str], str | None]:
    ok, err = validate_training_report_schema(report)
    if not ok:
        return None, ["invalid_report_schema"], err

    size = json_size_bytes(report)
    if size == -1:
        return None, ["invalid_report_json"], "not_json_serializable"

    if max_bytes > 0 and size > max_bytes:
        compacted, warnings = compact_training_report(report, max_bytes=max_bytes)
        size2 = json_size_bytes(compacted)
        if size2 == -1:
            return None, warnings + ["invalid_report_json"], "not_json_serializable"
        if size2 > max_bytes:
            return None, warnings + ["report_too_large"], f"size_bytes={size2}"
        return compacted, ["report_compacted"] + warnings, None

    return report, [], None


def build_stub_training_report(
    *,
    total_reps: int,
    exercise_type: str | None,
    note: str | None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    now = generated_at
    if not isinstance(now, str) or not now.strip():
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    summary = f"Recomputed stub report: total reps {total_reps}."
    if exercise_type:
        summary = f"{summary} exercise={exercise_type}."
    if note:
        summary = f"{summary} note={_truncate_str(note, 120)}"

    return {
        "version": 3,
        "generatedAt": now,
        "status": "ok",
        "summary": summary,
        "keyMetrics": {"totalReps": int(total_reps)},
        "issues": [],
        "suggestions": [],
        "details": {"type": "recomputed_stub", "exerciseType": exercise_type},
        "sections": {"overview": {"generatedAt": now, "status": "ok", "summary": summary}, "metrics": {"totalReps": int(total_reps)}},
    }
