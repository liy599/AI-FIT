from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, time

from flask import Blueprint, current_app, jsonify, request, send_file, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import AnalysisResult, AnalysisTask, TrainingSession, TrainingSet, VideoAsset
from ..services.pose.ai_report import build_fallback_ai_enhanced_report_v1, generate_ai_enhanced_report_v1
from ..services.pose.report_archive import build_stub_training_report, prepare_training_report_for_storage
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

    warnings: list[str] = []
    report_raw = data.get("report")
    max_bytes = int(current_app.config.get("POSE_TRAINING_REPORT_MAX_BYTES") or 0)
    stored_report = None
    if isinstance(report_raw, dict):
        stored_report, report_warnings, report_err = prepare_training_report_for_storage(report_raw, max_bytes=max_bytes)
        warnings.extend(report_warnings)
        if stored_report is None:
            warnings.append("report_dropped")
            if report_err:
                warnings.append(f"report_error:{report_err}")

    session = TrainingSession(
        user_id=user_id,
        started_at=_parse_dt(data.get("started_at")) or datetime.utcnow(),
        ended_at=_parse_dt(data.get("ended_at")),
        note=(data.get("note") or "").strip() or None,
        report_json=protect_json_payload(stored_report) if isinstance(stored_report, dict) else None,
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
    payload: dict = {"session": _training_session_public(session)}
    if warnings:
        payload["warnings"] = warnings
    return jsonify(payload), 201


@bp.get("/trainings")
@jwt_required()
def list_training_sessions():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=20)
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

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

    warnings: list[str] = []
    max_bytes = int(current_app.config.get("POSE_TRAINING_REPORT_MAX_BYTES") or 0)
    stored_report, warnings, report_err = prepare_training_report_for_storage(report, max_bytes=max_bytes)
    if stored_report is None:
        payload = {"error": "invalid_report", "detail": report_err or "invalid"}
        return jsonify(payload), 400

    session.report_json = protect_json_payload(stored_report) or {}
    db.session.commit()
    payload: dict = {"session": _training_session_public(session)}
    if warnings:
        payload["warnings"] = warnings
    return jsonify(payload)


@bp.post("/internal/trainings/<int:session_id>/recompute-report")
@jwt_required()
def recompute_training_session_report(session_id: int):
    user_id = int(get_jwt_identity())
    session = TrainingSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    mode = (data.get("mode") or "auto").strip().lower()
    dry_run = bool(data.get("dry_run"))

    max_bytes = int(current_app.config.get("POSE_TRAINING_REPORT_MAX_BYTES") or 0)
    warnings: list[str] = []
    current_report = reveal_json_payload(session.report_json)

    next_report = None
    if mode in {"compact", "compact_only"}:
        if not isinstance(current_report, dict):
            return jsonify({"error": "no_report"}), 409
        next_report, w, err = prepare_training_report_for_storage(current_report, max_bytes=max_bytes)
        warnings.extend(w)
        if next_report is None:
            return jsonify({"error": "invalid_report", "detail": err or "invalid"}), 400
    elif mode in {"stub", "stub_only"}:
        total_reps = sum(int(s.reps or 0) for s in (session.sets or []))
        next_report = build_stub_training_report(total_reps=total_reps, exercise_type=None, note=session.note)
        next_report, w, err = prepare_training_report_for_storage(next_report, max_bytes=max_bytes)
        warnings.extend(["report_recomputed_stub"] + w)
        if next_report is None:
            return jsonify({"error": "recompute_failed", "detail": err or "invalid"}), 500
    else:
        if isinstance(current_report, dict):
            next_report, w, err = prepare_training_report_for_storage(current_report, max_bytes=max_bytes)
            warnings.extend(["report_recomputed_compact"] + w)
            if next_report is None:
                total_reps = sum(int(s.reps or 0) for s in (session.sets or []))
                next_report = build_stub_training_report(total_reps=total_reps, exercise_type=None, note=session.note)
                next_report, w2, err2 = prepare_training_report_for_storage(next_report, max_bytes=max_bytes)
                warnings.extend(["report_recomputed_stub_fallback"] + w2)
                if next_report is None:
                    return jsonify({"error": "recompute_failed", "detail": err2 or "invalid"}), 500
        else:
            total_reps = sum(int(s.reps or 0) for s in (session.sets or []))
            next_report = build_stub_training_report(total_reps=total_reps, exercise_type=None, note=session.note)
            next_report, w, err = prepare_training_report_for_storage(next_report, max_bytes=max_bytes)
            warnings.extend(["report_recomputed_stub"] + w)
            if next_report is None:
                return jsonify({"error": "recompute_failed", "detail": err or "invalid"}), 500

    if not dry_run:
        session.report_json = protect_json_payload(next_report) or {}
        db.session.commit()

    payload: dict = {"session": _training_session_public(session), "dry_run": dry_run}
    if warnings:
        payload["warnings"] = warnings
    return jsonify(payload)


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
            if debug:
                payload["meta"]["rawText"] = result.raw_text
            return jsonify(payload)
        if debug:
            ai_meta["rawText"] = result.raw_text

    fallback = build_fallback_ai_enhanced_report_v1(base_report, language=language)
    payload = {"report": fallback, "meta": {"degraded": True, "ai": ai_meta}}
    return jsonify(payload)
