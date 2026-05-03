from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, time

from flask import Blueprint, current_app, jsonify, request, send_file, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import exists
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import AnalysisResult, AnalysisTask, TrainingSession, TrainingSet, VideoAsset
from ..services.pose.ai_report import build_fallback_ai_enhanced_report_v1, generate_ai_enhanced_report_v1
from ..utils.pagination import parse_pagination
from ..utils.privacy import decrypt_text, encrypt_text, protect_json_payload, reveal_json_payload
from ..utils.upload_access import build_upload_access_token

bp = Blueprint("pose", __name__)

ALLOWED_VIDEO_MIME_TYPES = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
}
ALLOWED_VIEW_ANGLES = {"unknown", "front", "side", "back"}
ALLOWED_STATUSES = {"uploaded", "running", "succeeded", "failed"}


def _pose_policy_from_config() -> dict:
    # Build runtime policy from backend config as a single source of truth.
    actions_raw = str(current_app.config.get("POSE_POLICY_OFFLINE_ALLOWED_ACTIONS", "")).strip()
    allowed_actions = [x.strip() for x in actions_raw.split(",") if x.strip()]
    if not allowed_actions:
        allowed_actions = ["squat", "pushup", "lateral-raise", "bent-over-row"]
    live_target_fps = max(1, int(current_app.config.get("POSE_POLICY_LIVE_TARGET_FPS", 40)))
    live_session_limit_seconds = max(30, int(current_app.config.get("POSE_POLICY_LIVE_SESSION_LIMIT_SECONDS", 120)))
    offline_max_video_bytes = max(5 * 1024 * 1024, int(current_app.config.get("POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES", 50 * 1024 * 1024)))
    offline_analysis_limit_seconds = max(10, int(current_app.config.get("POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS", 120)))
    offline_analysis_target_fps = max(1, int(current_app.config.get("POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS", 40)))
    policy_version = str(current_app.config.get("POSE_POLICY_VERSION", "2026-05-04.v1")).strip() or "2026-05-04.v1"

    def cfg_float(name: str, default: float, lo: float, hi: float) -> float:
        try:
            value = float(current_app.config.get(name, default))
        except (TypeError, ValueError):
            value = default
        return max(lo, min(hi, value))

    def cfg_int(name: str, default: int, lo: int, hi: int) -> int:
        try:
            value = int(current_app.config.get(name, default))
        except (TypeError, ValueError):
            value = default
        return max(lo, min(hi, value))

    return {
        "version": policy_version,
        "live": {
            "target_fps": live_target_fps,
            "session_limit_seconds": live_session_limit_seconds,
        },
        "offline": {
            "max_video_bytes": offline_max_video_bytes,
            "analysis_limit_seconds": offline_analysis_limit_seconds,
            "analysis_target_fps": offline_analysis_target_fps,
            "allowed_actions": allowed_actions,
        },
        "rules": {
            "privacy": {
                "local_inference_default": True,
                "server_upload_requires_explicit_consent": True,
            },
            "realtime": {
                "tracking_quality_min": cfg_float("POSE_POLICY_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                "tempo_fast_threshold_seconds": cfg_float("POSE_POLICY_TEMPO_FAST_THRESHOLD_SECONDS", 0.4, 0.2, 2.0),
            },
            "squat": {
                "knee_forward_warn_ratio": cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_WARN_RATIO", 0.045, 0.01, 0.3),
                "knee_forward_fail_ratio": cfg_float("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_RATIO", 0.058, 0.01, 0.35),
                "forward_lean_warn_deg": cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_WARN_DEG", 40, 10, 80),
                "forward_lean_fail_deg": cfg_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_DEG", 55, 15, 90),
            },
            "pushup": {
                "body_line_warn_ratio": cfg_float("POSE_POLICY_PUSHUP_BODY_LINE_WARN_RATIO", 0.20, 0.01, 1.0),
                "body_line_fail_ratio": cfg_float("POSE_POLICY_PUSHUP_BODY_LINE_FAIL_RATIO", 0.45, 0.01, 1.0),
                "depth_warn_ratio": cfg_float("POSE_POLICY_PUSHUP_DEPTH_WARN_RATIO", 0.20, 0.01, 1.0),
                "depth_fail_ratio": cfg_float("POSE_POLICY_PUSHUP_DEPTH_FAIL_RATIO", 0.45, 0.01, 1.0),
            },
            "lateral_raise": {
                "torso_sway_warn_ratio": cfg_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_RATIO", 0.12, 0.01, 1.0),
                "torso_sway_fail_ratio": cfg_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_RATIO", 0.35, 0.01, 1.0),
                "symmetry_warn_ratio": cfg_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_RATIO", 0.12, 0.01, 1.0),
                "symmetry_fail_ratio": cfg_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_RATIO", 0.35, 0.01, 1.0),
            },
            "bent_over_row": {
                "back_angle_warn_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG", 35, 5, 90),
                "back_angle_fail_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG", 50, 5, 110),
                "range_warn_ratio": cfg_float("POSE_POLICY_BENT_OVER_ROW_RANGE_WARN_RATIO", 0.12, 0.01, 1.0),
                "range_fail_ratio": cfg_float("POSE_POLICY_BENT_OVER_ROW_RANGE_FAIL_RATIO", 0.35, 0.01, 1.0),
            },
            "analyzer": {
                "pushup": {
                    "tracking_quality_min_for_count": cfg_float("POSE_POLICY_PUSHUP_TRACKING_QUALITY_MIN_FOR_COUNT", 0.22, 0.05, 0.95),
                    "tracking_quality_min_for_assess": cfg_float("POSE_POLICY_PUSHUP_TRACKING_QUALITY_MIN_FOR_ASSESS", 0.30, 0.05, 0.95),
                    "side_view_warn_deg": cfg_int("POSE_POLICY_PUSHUP_SIDE_VIEW_WARN_DEG", 55, 5, 120),
                    "depth_required_elbow_angle": cfg_int("POSE_POLICY_PUSHUP_DEPTH_REQUIRED_ELBOW_ANGLE", 130, 60, 170),
                    "body_line_fail_angle": cfg_int("POSE_POLICY_PUSHUP_BODY_LINE_FAIL_ANGLE", 145, 90, 180),
                    "hip_sag_hard_deg": cfg_int("POSE_POLICY_PUSHUP_HIP_SAG_HARD_DEG", 28, 1, 80),
                    "hip_pike_hard_deg": cfg_int("POSE_POLICY_PUSHUP_HIP_PIKE_HARD_DEG", 28, 1, 80),
                },
                "lateral_raise": {
                    "tracking_quality_min": cfg_float("POSE_POLICY_LATERAL_RAISE_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                    "torso_sway_warn_deg": cfg_int("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_DEG", 20, 1, 80),
                    "torso_sway_fail_deg": cfg_int("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_DEG", 30, 1, 100),
                    "symmetry_warn_deg": cfg_int("POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_DEG", 22, 1, 80),
                    "symmetry_fail_deg": cfg_int("POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_DEG", 32, 1, 100),
                    "top_range_min_deg": cfg_int("POSE_POLICY_LATERAL_RAISE_TOP_RANGE_MIN_DEG", 70, 30, 140),
                },
                "bent_over_row": {
                    "tracking_quality_min": cfg_float("POSE_POLICY_BENT_OVER_ROW_TRACKING_QUALITY_MIN", 0.28, 0.05, 0.95),
                    "torso_lean_warn_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG", 35, 5, 90),
                    "torso_lean_fail_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG", 50, 5, 110),
                    "symmetry_warn_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_SYMMETRY_WARN_DEG", 18, 1, 80),
                    "symmetry_fail_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_SYMMETRY_FAIL_DEG", 28, 1, 100),
                    "top_range_min_deg": cfg_int("POSE_POLICY_BENT_OVER_ROW_TOP_RANGE_MIN_DEG", 90, 30, 160),
                },
            },
        },
    }


SQUAT_TUNING_FILENAME = "squat_tuning.json"
SQUAT_TUNING_DEFAULTS = {
    "kneeForwardWarnRatio": 0.045,
    "kneeForwardFailRatio": 0.058,
    "kneeForwardFailMinFrames": 2,
    "forwardLeanWarnDeg": 40,
    "forwardLeanFailDeg": 55,
    "forwardLeanFailMinFrames": 5,
    "trackingQualityMin": 0.28,
}
SQUAT_TUNING_BOUNDS = {
    "kneeForwardWarnRatio": (0.01, 0.3),
    "kneeForwardFailRatio": (0.01, 0.35),
    "kneeForwardFailMinFrames": (1, 30),
    "forwardLeanWarnDeg": (10, 80),
    "forwardLeanFailDeg": (15, 90),
    "forwardLeanFailMinFrames": (1, 60),
    "trackingQualityMin": (0.05, 0.95),
}


def _admin_guard(user_id: int) -> bool:
    from ..models import User

    user = db.session.get(User, user_id)
    if user is None:
        return False
    admin_email = (current_app.config.get("ADMIN_EMAIL") or "").strip().lower()
    return bool(admin_email) and user.email.strip().lower() == admin_email


def _pose_config_dir() -> str:
    folder = os.path.join(current_app.instance_path, "pose")
    os.makedirs(folder, exist_ok=True)
    return folder


def _squat_tuning_path() -> str:
    return os.path.join(_pose_config_dir(), SQUAT_TUNING_FILENAME)


def _normalize_squat_tuning(raw: dict | None) -> dict:
    merged = dict(SQUAT_TUNING_DEFAULTS)
    if isinstance(raw, dict):
        merged.update(raw)
    out: dict[str, float | int] = {}
    for key, default_value in SQUAT_TUNING_DEFAULTS.items():
        value = merged.get(key, default_value)
        lo, hi = SQUAT_TUNING_BOUNDS[key]
        is_int = isinstance(default_value, int)
        try:
            numeric = int(value) if is_int else float(value)
        except (TypeError, ValueError):
            numeric = default_value
        numeric = max(lo, min(hi, numeric))
        out[key] = int(numeric) if is_int else float(numeric)
    if out["kneeForwardFailRatio"] < out["kneeForwardWarnRatio"]:
        out["kneeForwardFailRatio"] = out["kneeForwardWarnRatio"]
    if out["forwardLeanFailDeg"] < out["forwardLeanWarnDeg"]:
        out["forwardLeanFailDeg"] = out["forwardLeanWarnDeg"]
    return out


def _find_legacy_squat_tuning_path() -> str | None:
    folder = _pose_config_dir()
    pattern = re.compile(r"^squat[0-9]+_tuning\.json$")
    for name in os.listdir(folder):
        if pattern.match(name):
            candidate = os.path.join(folder, name)
            if os.path.isfile(candidate):
                return candidate
    return None


def _load_squat_tuning() -> tuple[dict, str]:
    path = _squat_tuning_path()
    if not os.path.isfile(path):
        legacy = _find_legacy_squat_tuning_path()
        if legacy:
            try:
                with open(legacy, "r", encoding="utf-8") as f:
                    payload = json.load(f)
                if not isinstance(payload, dict):
                    raise ValueError("invalid payload")
                normalized = _normalize_squat_tuning(payload)
                _save_squat_tuning(normalized)
                try:
                    os.remove(legacy)
                except OSError:
                    pass
                return normalized, "migrated"
            except Exception:
                return dict(SQUAT_TUNING_DEFAULTS), "default"
        return dict(SQUAT_TUNING_DEFAULTS), "default"
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, dict):
            raise ValueError("invalid payload")
        normalized = _normalize_squat_tuning(payload)
        return normalized, "stored"
    except Exception:
        return dict(SQUAT_TUNING_DEFAULTS), "default"


def _save_squat_tuning(tuning: dict) -> None:
    path = _squat_tuning_path()
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(tuning, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _video_public(video: VideoAsset):
    return {
        "id": video.id,
        "original_name": video.original_name,
        "mime_type": video.mime_type,
        "size_bytes": video.size_bytes,
        "duration_seconds": float(video.duration_seconds) if video.duration_seconds is not None else None,
        "url": url_for("pose.get_video_file", video_id=video.id, _external=False),
        "created_at": video.created_at.isoformat(),
    }


def _task_public(task: AnalysisTask, result: AnalysisResult | None = None):
    return {
        "id": task.id,
        "status": task.status,
        "exercise_type": task.exercise_type,
        "view_angle": task.view_angle,
        "instruction": task.instruction,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "finished_at": task.finished_at.isoformat() if task.finished_at else None,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "video": _video_public(task.video_asset),
        "result": (
            {
                "id": result.id,
                "report": reveal_json_payload(result.report_json),
                "created_at": result.created_at.isoformat(),
            }
            if result
            else None
        ),
    }


def _pose_video_dir(user_id: int):
    return os.path.join(current_app.config["UPLOAD_FOLDER"], "pose", "videos", str(user_id))


def _resolve_video_path(stored_path: str) -> str | None:
    decoded = decrypt_text(stored_path) or stored_path
    upload_root = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
    if os.path.isabs(decoded):
        candidate = os.path.realpath(decoded)
    else:
        candidate = os.path.realpath(os.path.join(upload_root, decoded))
    if not candidate.startswith(upload_root):
        return None
    return candidate


def _video_relative_path(stored_path: str) -> str | None:
    resolved = _resolve_video_path(stored_path)
    if not resolved:
        return None
    upload_root = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
    rel = os.path.relpath(resolved, upload_root).replace("\\", "/")
    if rel.startswith(".."):
        return None
    return rel


def _purge_video_payload(video: VideoAsset) -> None:
    resolved = _resolve_video_path(video.storage_path)
    if resolved and os.path.isfile(resolved):
        try:
            os.remove(resolved)
        except OSError:
            pass
    tombstone = f"deleted/{video.id}"
    video.storage_path = encrypt_text(tombstone) or tombstone
    video.size_bytes = 0
    video.duration_seconds = None


def _parse_dt(value: str | None):
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


def _parse_date_boundary(value: str | None, *, end_of_day: bool):
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        day = datetime.fromisoformat(text).date()
    except ValueError as exc:
        raise ValueError("date must be in YYYY-MM-DD format") from exc
    return datetime.combine(day, time.max if end_of_day else time.min)


def _training_session_public(session: TrainingSession):
    ordered_sets = sorted(session.sets, key=lambda item: (item.set_order, item.id))
    return {
        "id": session.id,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "note": session.note,
        "report": reveal_json_payload(session.report_json),
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
        "sets": [
            {
                "id": item.id,
                "exercise_type": item.exercise_type,
                "set_order": item.set_order,
                "reps": item.reps,
                "weight": float(item.weight) if item.weight is not None else None,
                "note": item.note,
            }
            for item in ordered_sets
        ],
    }


@bp.get("/config/squat-tuning")
def get_squat_tuning():
    tuning, source = _load_squat_tuning()
    return jsonify({"tuning": tuning, "source": source})


@bp.get("/capabilities")
def get_pose_capabilities():
    return jsonify(
        {
            "local_inference": {
                "enabled": True,
                "default": True,
                "privacy": "video_stays_on_device",
            },
            "server_inference": {
                "enabled": bool(current_app.config.get("POSE_SERVER_INFERENCE_ENABLED", False)),
                "requires_explicit_consent": True,
                "privacy": "uploads_video_or_keyframes",
            },
        }
    )


@bp.get("/policy")
def get_pose_policy():
    return jsonify(_pose_policy_from_config())


@bp.put("/config/squat-tuning")
@jwt_required()
def update_squat_tuning():
    user_id = int(get_jwt_identity())
    if not _admin_guard(user_id):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    raw = data.get("tuning")
    if not isinstance(raw, dict):
        return jsonify({"error": "tuning object required"}), 400
    normalized = _normalize_squat_tuning(raw)
    _save_squat_tuning(normalized)
    return jsonify({"ok": True, "tuning": normalized})


@bp.get("/videos")
@jwt_required()
def list_videos():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=12)
    q = VideoAsset.query.filter_by(user_id=user_id).order_by(VideoAsset.created_at.desc(), VideoAsset.id.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        {
            "items": [_video_public(v) for v in items],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.post("/videos")
@jwt_required()
def create_video():
    user_id = int(get_jwt_identity())
    f = request.files.get("file")
    if f is None or not f.filename:
        return jsonify({"error": "file required"}), 400

    mime_type = (getattr(f, "mimetype", "") or "").lower()
    ext = ALLOWED_VIDEO_MIME_TYPES.get(mime_type)
    if ext is None:
        filename = secure_filename(f.filename)
        fallback_ext = os.path.splitext(filename)[1].lower()
        if fallback_ext not in {".mp4", ".mov", ".webm", ".mkv"}:
            return jsonify({"error": "unsupported video type"}), 400
        ext = fallback_ext
        mime_type = mime_type or "application/octet-stream"

    original_name = secure_filename(f.filename) or f"video{ext}"
    folder = _pose_video_dir(user_id)
    os.makedirs(folder, exist_ok=True)
    saved_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, saved_name)
    f.save(path)
    size_bytes = os.path.getsize(path)

    relative_path = os.path.relpath(path, current_app.config["UPLOAD_FOLDER"]).replace("\\", "/")
    video = VideoAsset(
        user_id=user_id,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_path=encrypt_text(relative_path) or relative_path,
    )
    db.session.add(video)
    db.session.commit()
    return jsonify({"video": _video_public(video)}), 201


@bp.get("/videos/<int:video_id>/file")
@jwt_required()
def get_video_file(video_id: int):
    user_id = int(get_jwt_identity())
    video = VideoAsset.query.filter_by(id=video_id, user_id=user_id).first()
    if video is None:
        return jsonify({"error": "not found"}), 404
    resolved_path = _resolve_video_path(video.storage_path)
    if not resolved_path or not os.path.isfile(resolved_path):
        return jsonify({"error": "file missing"}), 404
    return send_file(resolved_path, mimetype=video.mime_type, conditional=True)


@bp.get("/videos/<int:video_id>/signed-url")
@jwt_required()
def get_video_signed_url(video_id: int):
    user_id = int(get_jwt_identity())
    video = VideoAsset.query.filter_by(id=video_id, user_id=user_id).first()
    if video is None:
        return jsonify({"error": "not found"}), 404

    rel = _video_relative_path(video.storage_path)
    if not rel:
        return jsonify({"error": "file missing"}), 404

    token = build_upload_access_token(rel)
    expires_in = int(current_app.config.get("UPLOAD_SIGNED_URL_TTL_SECONDS", 300))
    return jsonify({"url": f"/uploads/{rel}?token={token}", "expires_in": expires_in})


@bp.post("/analysis/tasks")
@jwt_required()
def create_analysis_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    video_asset_id = data.get("video_asset_id")
    exercise_type = (data.get("exercise_type") or "squat").strip().lower()
    view_angle = (data.get("view_angle") or "unknown").strip().lower()
    instruction = (data.get("instruction") or "").strip() or None

    if not isinstance(video_asset_id, int):
        return jsonify({"error": "video_asset_id required"}), 400
    if view_angle not in ALLOWED_VIEW_ANGLES:
        return jsonify({"error": "invalid view_angle"}), 400

    video = VideoAsset.query.filter_by(id=video_asset_id, user_id=user_id).first()
    if video is None:
        return jsonify({"error": "video not found"}), 404

    task = AnalysisTask(
        user_id=user_id,
        video_asset_id=video.id,
        exercise_type=exercise_type or "squat",
        view_angle=view_angle,
        instruction=instruction,
        status="running",
        started_at=datetime.utcnow(),
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": _task_public(task)}), 201


@bp.post("/server-analysis/submit")
@jwt_required()
def submit_server_analysis():
    user_id = int(get_jwt_identity())
    if not bool(current_app.config.get("POSE_SERVER_INFERENCE_ENABLED", False)):
        return jsonify({"error": "server inference disabled"}), 403

    consent_raw = (request.form.get("consent") or "").strip().lower()
    if consent_raw not in {"1", "true", "yes", "on"}:
        return jsonify({"error": "explicit consent required"}), 400

    exercise_type = (request.form.get("exercise_type") or "squat").strip().lower() or "squat"
    view_angle = (request.form.get("view_angle") or "unknown").strip().lower()
    if view_angle not in ALLOWED_VIEW_ANGLES:
        return jsonify({"error": "invalid view_angle"}), 400

    f = request.files.get("file")
    if f is None or not f.filename:
        return jsonify({"error": "file required"}), 400

    mime_type = (getattr(f, "mimetype", "") or "").lower()
    ext = ALLOWED_VIDEO_MIME_TYPES.get(mime_type)
    if ext is None:
        filename = secure_filename(f.filename)
        fallback_ext = os.path.splitext(filename)[1].lower()
        if fallback_ext not in {".mp4", ".mov", ".webm", ".mkv"}:
            return jsonify({"error": "unsupported video type"}), 400
        ext = fallback_ext
        mime_type = mime_type or "application/octet-stream"

    original_name = secure_filename(f.filename) or f"video{ext}"
    folder = _pose_video_dir(user_id)
    os.makedirs(folder, exist_ok=True)
    saved_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, saved_name)
    f.save(path)
    size_bytes = os.path.getsize(path)

    relative_path = os.path.relpath(path, current_app.config["UPLOAD_FOLDER"]).replace("\\", "/")
    video = VideoAsset(
        user_id=user_id,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_path=encrypt_text(relative_path) or relative_path,
    )
    db.session.add(video)
    db.session.flush()

    task = AnalysisTask(
        user_id=user_id,
        video_asset_id=video.id,
        exercise_type=exercise_type,
        view_angle=view_angle,
        instruction="server_inference_requested_with_explicit_consent:v1",
        status="uploaded",
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": _task_public(task), "queued": True}), 201


@bp.post("/server-analysis/<int:task_id>/cancel")
@jwt_required()
def cancel_server_analysis(task_id: int):
    user_id = int(get_jwt_identity())
    task = AnalysisTask.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return jsonify({"error": "not found"}), 404

    video = VideoAsset.query.filter_by(id=task.video_asset_id, user_id=user_id).first()
    if task.status in {"succeeded", "failed"}:
        return jsonify({"error": "task already finished"}), 400

    task.status = "failed"
    task.finished_at = datetime.utcnow()
    task.error_message = "cancelled_by_user"

    if video is not None:
        _purge_video_payload(video)

    db.session.commit()
    return jsonify({"ok": True, "task_id": task.id, "status": task.status})


@bp.get("/analysis/tasks/<int:task_id>")
@jwt_required()
def get_analysis_task(task_id: int):
    user_id = int(get_jwt_identity())
    task = AnalysisTask.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return jsonify({"error": "not found"}), 404
    result = (
        AnalysisResult.query.filter_by(task_id=task.id).order_by(AnalysisResult.created_at.desc(), AnalysisResult.id.desc()).first()
    )
    return jsonify({"task": _task_public(task, result)})


@bp.post("/analysis/tasks/<int:task_id>/complete")
@jwt_required()
def complete_analysis_task(task_id: int):
    user_id = int(get_jwt_identity())
    task = AnalysisTask.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    report = data.get("report")
    if not isinstance(report, dict):
        return jsonify({"error": "report required"}), 400

    result = AnalysisResult(task_id=task.id, report_json=protect_json_payload(report) or {})
    task.status = "succeeded"
    if task.started_at is None:
        task.started_at = datetime.utcnow()
    task.finished_at = datetime.utcnow()
    task.error_message = None

    db.session.add(result)
    db.session.commit()
    return jsonify({"task": _task_public(task, result)})


@bp.post("/analysis/tasks/<int:task_id>/fail")
@jwt_required()
def fail_analysis_task(task_id: int):
    user_id = int(get_jwt_identity())
    task = AnalysisTask.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    error_message = (data.get("error") or "").strip()
    if not error_message:
        return jsonify({"error": "error required"}), 400

    task.status = "failed"
    if task.started_at is None:
        task.started_at = datetime.utcnow()
    task.finished_at = datetime.utcnow()
    task.error_message = error_message[:1000]
    db.session.commit()
    return jsonify({"task": _task_public(task)})


@bp.post("/trainings")
@jwt_required()
def create_training_session():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    sets_data = data.get("sets")
    if not isinstance(sets_data, list) or len(sets_data) == 0:
        return jsonify({"error": "sets required"}), 400

    session = TrainingSession(
        user_id=user_id,
        started_at=_parse_dt(data.get("started_at")) or datetime.utcnow(),
        ended_at=_parse_dt(data.get("ended_at")),
        note=(data.get("note") or "").strip() or None,
        report_json=protect_json_payload(data.get("report")) if isinstance(data.get("report"), dict) else None,
    )
    db.session.add(session)
    db.session.flush()

    for idx, raw in enumerate(sets_data, start=1):
        if not isinstance(raw, dict):
            db.session.rollback()
            return jsonify({"error": "invalid set payload"}), 400
        reps = raw.get("reps")
        if not isinstance(reps, int):
            db.session.rollback()
            return jsonify({"error": "set reps required"}), 400
        item = TrainingSet(
            training_id=session.id,
            exercise_type=((raw.get("exercise_type") or data.get("exercise_type") or "squat").strip().lower() or "squat"),
            set_order=int(raw.get("set_order") or idx),
            reps=reps,
            weight=raw.get("weight"),
            note=(raw.get("note") or "").strip() or None,
        )
        db.session.add(item)

    db.session.commit()
    return jsonify({"session": _training_session_public(session)}), 201


@bp.get("/trainings")
@jwt_required()
def list_training_sessions():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=20)
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    exercise_type = (request.args.get("exercise_type") or "").strip().lower()

    try:
        from_dt = _parse_date_boundary(date_from, end_of_day=False)
        to_dt = _parse_date_boundary(date_to, end_of_day=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    q = TrainingSession.query.filter_by(user_id=user_id)
    if from_dt:
        q = q.filter(TrainingSession.started_at >= from_dt)
    if to_dt:
        q = q.filter(TrainingSession.started_at <= to_dt)
    if exercise_type:
        q = q.filter(
            exists()
            .where(TrainingSet.training_id == TrainingSession.id)
            .where(TrainingSet.exercise_type == exercise_type)
        )
    q = q.order_by(TrainingSession.started_at.desc(), TrainingSession.id.desc())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        {
            "items": [_training_session_public(item) for item in items],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.get("/trainings/<int:session_id>")
@jwt_required()
def get_training_session(session_id: int):
    user_id = int(get_jwt_identity())
    session = TrainingSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"session": _training_session_public(session)})


@bp.put("/trainings/<int:session_id>/report")
@jwt_required()
def update_training_session_report(session_id: int):
    user_id = int(get_jwt_identity())
    session = TrainingSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    report = data.get("report")
    if not isinstance(report, dict):
        return jsonify({"error": "report required"}), 400

    session.report_json = protect_json_payload(report) or {}
    db.session.commit()
    return jsonify({"session": _training_session_public(session)})


@bp.post("/reports/ai")
@jwt_required()
def create_ai_report():
    _ = int(get_jwt_identity())
    raw_body = request.get_data(cache=False, as_text=True) or ""
    try:
        data = json.loads(raw_body) if raw_body.strip() else {}
    except Exception:
        return jsonify({"error": "invalid_json"}), 400

    if not isinstance(data, dict):
        return jsonify({"error": "invalid_payload"}), 400

    base_report = data.get("report")
    if not isinstance(base_report, dict):
        return jsonify({"error": "report required"}), 400

    language = (data.get("language") or data.get("locale") or "en-US")
    if isinstance(language, str):
        language = language.strip() or "en-US"
    else:
        language = "en-US"

    def truthy(value) -> bool:
        if value is True:
            return True
        if value is False or value is None:
            return False
        if isinstance(value, int):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() not in {"", "0", "false", "no", "off"}
        return False

    debug = truthy(data.get("debug")) or request.args.get("debug") == "1"
    is_production = str(current_app.config.get("APP_ENV", "")).lower() == "production"

    enabled = truthy(current_app.config.get("POSE_REPORT_AI_ENABLED"))
    api_url = (current_app.config.get("AI_REPORT_API_URL") or "").strip() or (current_app.config.get("STEPFUN_API_URL") or "").strip()
    api_key = (current_app.config.get("AI_REPORT_API_KEY") or "").strip() or (current_app.config.get("STEPFUN_API_KEY") or "").strip()
    model = (
        (current_app.config.get("POSE_REPORT_AI_MODEL") or "").strip()
        or (current_app.config.get("AI_REPORT_MODEL") or "").strip()
        or (current_app.config.get("STEPFUN_MODEL") or "").strip()
        or "step-1v-8k"
    )
    timeout_seconds = int(current_app.config.get("AI_REPORT_TIMEOUT_SECONDS") or current_app.config.get("POSE_REPORT_AI_TIMEOUT_SECONDS") or 20)
    max_input_chars = int(current_app.config.get("POSE_REPORT_AI_MAX_INPUT_CHARS") or 12000)

    ai_meta: dict = {
        "used": False,
        "ok": False,
        "provider": "stepfun",
        "model": model,
        "error": None,
    }

    if enabled and api_url and api_key:
        ai_meta["used"] = True
        result = generate_ai_enhanced_report_v1(
            api_url=api_url,
            api_key=api_key,
            model=model,
            base_report=base_report,
            language=language,
            timeout_seconds=timeout_seconds,
            max_input_chars=max_input_chars,
        )
        ai_meta["ok"] = bool(result.ok)
        ai_meta["error"] = result.error
        if result.ok and isinstance(result.report, dict):
            payload = {"report": result.report, "meta": {"degraded": False, "ai": ai_meta}}
            if debug and not is_production:
                payload["meta"]["rawText"] = result.raw_text
            return jsonify(payload)
        if debug and not is_production:
            ai_meta["rawText"] = result.raw_text

    fallback = build_fallback_ai_enhanced_report_v1(base_report, language=language)
    payload = {"report": fallback, "meta": {"degraded": True, "ai": ai_meta}}
    return jsonify(payload)

