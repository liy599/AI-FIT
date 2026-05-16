from __future__ import annotations

from flask import current_app

POSE_POLICY_VERSION_DEFAULT = "2026-05-04.v1"
POSE_EXERCISE_TYPES = ("squat", "pushup", "lateral-raise", "bent-over-row")


def normalize_pose_exercise_type(value: str | None, default: str = "squat") -> str:
    exercise_type = (value or "").strip().lower()
    if exercise_type in POSE_EXERCISE_TYPES:
        return exercise_type
    return default


def get_pose_policy() -> dict:
    actions_raw = str(current_app.config.get("POSE_POLICY_OFFLINE_ALLOWED_ACTIONS", "")).strip()
    allowed_actions = [normalize_pose_exercise_type(x, default="") for x in actions_raw.split(",") if x.strip()]
    allowed_actions = [x for x in allowed_actions if x]
    if not allowed_actions:
        allowed_actions = list(POSE_EXERCISE_TYPES)

    return {
        "version": _cfg_str("POSE_POLICY_VERSION", POSE_POLICY_VERSION_DEFAULT),
        "offline": {
            "max_video_bytes": _cfg_int("POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES", 50 * 1024 * 1024, 5 * 1024 * 1024, 1024 * 1024 * 1024),
            "analysis_limit_seconds": _cfg_int("POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS", 120, 10, 600),
            "analysis_target_fps": _cfg_int("POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS", 40, 1, 120),
            "allowed_actions": allowed_actions,
        },
        "rules": {
            "privacy": {
                "local_inference_only": True,
            },
            "analyzer_common": {
                "tracking_quality_min": _cfg_float("POSE_POLICY_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                "tempo_fast_threshold_seconds": _cfg_float("POSE_POLICY_TEMPO_FAST_THRESHOLD_SECONDS", 0.4, 0.2, 2.0),
            },
            "squat": {
                "knee_forward_warn_ratio": _cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_WARN_RATIO", 0.045, 0.01, 0.3),
                "knee_forward_fail_ratio": _cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_RATIO", 0.058, 0.01, 0.35),
                "forward_lean_warn_deg": _cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_WARN_DEG", 40, 10, 80),
                "forward_lean_fail_deg": _cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_DEG", 55, 15, 90),
            },
            "pushup": {
                "body_line_warn_ratio": _cfg_float("POSE_POLICY_PUSHUP_BODY_LINE_WARN_RATIO", 0.20, 0.01, 1.0),
                "body_line_fail_ratio": _cfg_float("POSE_POLICY_PUSHUP_BODY_LINE_FAIL_RATIO", 0.45, 0.01, 1.0),
                "depth_warn_ratio": _cfg_float("POSE_POLICY_PUSHUP_DEPTH_WARN_RATIO", 0.20, 0.01, 1.0),
                "depth_fail_ratio": _cfg_float("POSE_POLICY_PUSHUP_DEPTH_FAIL_RATIO", 0.45, 0.01, 1.0),
            },
            "lateral_raise": {
                "torso_sway_warn_ratio": _cfg_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_RATIO", 0.12, 0.01, 1.0),
                "torso_sway_fail_ratio": _cfg_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_RATIO", 0.35, 0.01, 1.0),
                "symmetry_warn_ratio": _cfg_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_RATIO", 0.12, 0.01, 1.0),
                "symmetry_fail_ratio": _cfg_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_RATIO", 0.35, 0.01, 1.0),
            },
            "bent_over_row": {
                "back_angle_warn_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG", 35, 5, 90),
                "back_angle_fail_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG", 50, 5, 110),
                "range_warn_ratio": _cfg_float("POSE_POLICY_BENT_OVER_ROW_RANGE_WARN_RATIO", 0.12, 0.01, 1.0),
                "range_fail_ratio": _cfg_float("POSE_POLICY_BENT_OVER_ROW_RANGE_FAIL_RATIO", 0.35, 0.01, 1.0),
            },
            "analyzer": {
                "squat": {
                    "knee_forward_warn_ratio": _cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_WARN_RATIO", 0.045, 0.01, 0.3),
                    "knee_forward_fail_ratio": _cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_RATIO", 0.058, 0.01, 0.35),
                    "knee_forward_fail_min_frames": _cfg_int("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_MIN_FRAMES", 2, 1, 30),
                    "forward_lean_warn_deg": _cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_WARN_DEG", 40, 10, 80),
                    "forward_lean_fail_deg": _cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_DEG", 55, 15, 90),
                    "forward_lean_fail_min_frames": _cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_MIN_FRAMES", 5, 1, 60),
                    "tracking_quality_min": _cfg_float("POSE_POLICY_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                },
                "pushup": {
                    "tracking_quality_min_for_count": _cfg_float("POSE_POLICY_PUSHUP_TRACKING_QUALITY_MIN_FOR_COUNT", 0.22, 0.05, 0.95),
                    "tracking_quality_min_for_assess": _cfg_float("POSE_POLICY_PUSHUP_TRACKING_QUALITY_MIN_FOR_ASSESS", 0.30, 0.05, 0.95),
                    "side_view_warn_deg": _cfg_int("POSE_POLICY_PUSHUP_SIDE_VIEW_WARN_DEG", 55, 5, 120),
                    "depth_required_elbow_angle": _cfg_int("POSE_POLICY_PUSHUP_DEPTH_REQUIRED_ELBOW_ANGLE", 130, 60, 170),
                    "body_line_fail_angle": _cfg_int("POSE_POLICY_PUSHUP_BODY_LINE_FAIL_ANGLE", 145, 90, 180),
                    "hip_sag_hard_deg": _cfg_int("POSE_POLICY_PUSHUP_HIP_SAG_HARD_DEG", 28, 1, 80),
                    "hip_pike_hard_deg": _cfg_int("POSE_POLICY_PUSHUP_HIP_PIKE_HARD_DEG", 28, 1, 80),
                },
                "lateral_raise": {
                    "tracking_quality_min": _cfg_float("POSE_POLICY_LATERAL_RAISE_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                    "torso_sway_warn_deg": _cfg_int("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_DEG", 20, 1, 80),
                    "torso_sway_fail_deg": _cfg_int("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_DEG", 30, 1, 100),
                    "symmetry_warn_deg": _cfg_int("POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_DEG", 22, 1, 80),
                    "symmetry_fail_deg": _cfg_int("POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_DEG", 32, 1, 100),
                    "top_range_min_deg": _cfg_int("POSE_POLICY_LATERAL_RAISE_TOP_RANGE_MIN_DEG", 70, 30, 140),
                },
                "bent_over_row": {
                    "tracking_quality_min": _cfg_float("POSE_POLICY_BENT_OVER_ROW_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                    "torso_lean_warn_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG", 35, 5, 90),
                    "torso_lean_fail_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG", 50, 5, 110),
                    "symmetry_warn_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_SYMMETRY_WARN_DEG", 18, 1, 80),
                    "symmetry_fail_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_SYMMETRY_FAIL_DEG", 28, 1, 100),
                    "top_range_min_deg": _cfg_int("POSE_POLICY_BENT_OVER_ROW_TOP_RANGE_MIN_DEG", 90, 30, 160),
                },
            },
        },
    }


def _cfg_str(name: str, default: str) -> str:
    return str(current_app.config.get(name, default)).strip() or default


def _cfg_float(name: str, default: float, lo: float, hi: float) -> float:
    try:
        value = float(current_app.config.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(lo, min(hi, value))


def _cfg_int(name: str, default: int, lo: int, hi: int) -> int:
    try:
        value = int(current_app.config.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(lo, min(hi, value))
