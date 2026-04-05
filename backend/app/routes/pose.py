from __future__ import annotations

import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request, send_file, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import AnalysisResult, AnalysisTask, TrainingSession, TrainingSet, VideoAsset
from ..utils.pagination import parse_pagination

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
                "report": result.report_json,
                "created_at": result.created_at.isoformat(),
            }
            if result
            else None
        ),
    }


def _pose_video_dir(user_id: int):
    return os.path.join(current_app.config["UPLOAD_FOLDER"], "pose", "videos", str(user_id))


def _parse_dt(value: str | None):
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


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

    video = VideoAsset(
        user_id=user_id,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_path=path,
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
    if not os.path.isfile(video.storage_path):
        return jsonify({"error": "file missing"}), 404
    return send_file(video.storage_path, mimetype=video.mime_type, conditional=True)


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

    result = AnalysisResult(task_id=task.id, report_json=report)
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
        report_json=data.get("report") if isinstance(data.get("report"), dict) else None,
    )
    db.session.add(session)
    db.session.flush()

    created_sets = []
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
        created_sets.append(item)

    db.session.commit()
    return (
        jsonify(
            {
                "session": {
                    "id": session.id,
                    "started_at": session.started_at.isoformat(),
                    "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                    "note": session.note,
                    "report": session.report_json,
                    "sets": [
                        {
                            "id": item.id,
                            "exercise_type": item.exercise_type,
                            "set_order": item.set_order,
                            "reps": item.reps,
                            "weight": float(item.weight) if item.weight is not None else None,
                            "note": item.note,
                        }
                        for item in created_sets
                    ],
                }
            }
        ),
        201,
    )
