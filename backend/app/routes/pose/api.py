from __future__ import annotations

from datetime import datetime, time

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import exists
from sqlalchemy.orm import load_only, selectinload

from ...extensions import db
from ...models import TrainingSession, TrainingSet
from ...services.pose.policy import get_pose_policy as build_pose_policy, normalize_pose_exercise_type
from ...utils.audit import record_audit
from ...utils.pagination import cursor_datetime, decode_cursor, encode_cursor, parse_pagination
from ...utils.privacy import privacy_hash, protect_json_payload, reveal_json_payload

bp = Blueprint("pose", __name__)

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


def _clean_report_preview(value):
    if not isinstance(value, dict):
        return None

    preview: dict[str, object] = {}
    summary = value.get("summary")
    if isinstance(summary, str) and summary.strip():
        preview["summary"] = summary.strip()

    key_metrics = value.get("keyMetrics")
    if isinstance(key_metrics, dict):
        preview["keyMetrics"] = key_metrics

    for key in ("formAccuracyPct", "accuracyPct"):
        if isinstance(value.get(key), (int, float)):
            preview[key] = value[key]

    issues = value.get("issues")
    if isinstance(issues, list):
        safe_issues = []
        for issue in issues[:3]:
            if isinstance(issue, str):
                if issue.strip():
                    safe_issues.append(issue.strip())
                continue
            if not isinstance(issue, dict):
                continue
            safe_issue = {
                k: issue[k]
                for k in ("severity", "type", "message", "repNo", "frameTimeMs")
                if k in issue and isinstance(issue[k], (str, int, float))
            }
            if safe_issue:
                safe_issues.append(safe_issue)
        if safe_issues:
            preview["issues"] = safe_issues

    suggestions = value.get("suggestions")
    if isinstance(suggestions, list):
        safe_suggestions = [item.strip() for item in suggestions[:3] if isinstance(item, str) and item.strip()]
        if safe_suggestions:
            preview["suggestions"] = safe_suggestions

    return preview or None


def _training_session_summary_public(session: TrainingSession):
    ordered_sets = sorted(session.sets, key=lambda item: (item.set_order, item.id))
    return {
        "id": session.id,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "note": session.note,
        "report": reveal_json_payload(session.report_summary_json),
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


@bp.get("/policy")
def get_pose_policy():
    return jsonify(build_pose_policy())


@bp.post("/trainings")
@jwt_required()
def create_training_session():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    sets_data = data.get("sets")
    if not isinstance(sets_data, list) or len(sets_data) == 0:
        return jsonify({"error": "sets required"}), 400

    report = data.get("report") if isinstance(data.get("report"), dict) else None
    session = TrainingSession(
        user_id=user_id,
        started_at=_parse_dt(data.get("started_at")) or datetime.utcnow(),
        ended_at=_parse_dt(data.get("ended_at")),
        note=(data.get("note") or "").strip() or None,
        report_summary_json=protect_json_payload(_clean_report_preview(report)) if report else None,
        report_json=protect_json_payload(report) if report else None,
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
        if reps < 0:
            db.session.rollback()
            return jsonify({"error": "set reps must be nonnegative"}), 400
        set_order = int(raw.get("set_order") or idx)
        if set_order < 1:
            db.session.rollback()
            return jsonify({"error": "set_order must be positive"}), 400
        weight = raw.get("weight")
        if weight is not None:
            try:
                weight = float(weight)
            except (TypeError, ValueError):
                db.session.rollback()
                return jsonify({"error": "invalid weight"}), 400
            if weight < 0:
                db.session.rollback()
                return jsonify({"error": "weight must be nonnegative"}), 400
        item = TrainingSet(
            training_id=session.id,
            exercise_type=normalize_pose_exercise_type(raw.get("exercise_type") or data.get("exercise_type")),
            set_order=set_order,
            reps=reps,
            weight=weight,
            note=(raw.get("note") or "").strip() or None,
        )
        db.session.add(item)

    record_audit(actor_user_id=user_id, action="training.report.create", target_type="training_session", target_id=session.id)
    db.session.commit()
    return jsonify({"session": _training_session_public(session)}), 201


@bp.get("/trainings")
@jwt_required()
def list_training_sessions():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=20)
    cursor = decode_cursor(request.args.get("cursor"))
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    exercise_type = (request.args.get("exercise_type") or "").strip().lower()

    try:
        from_dt = _parse_date_boundary(date_from, end_of_day=False)
        to_dt = _parse_date_boundary(date_to, end_of_day=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    q = TrainingSession.query.options(
        load_only(
            TrainingSession.id,
            TrainingSession.started_at,
            TrainingSession.ended_at,
            TrainingSession.note_encrypted,
            TrainingSession.report_summary_json,
            TrainingSession.created_at,
            TrainingSession.updated_at,
        ),
        selectinload(TrainingSession.sets).load_only(
            TrainingSet.id,
            TrainingSet.training_id,
            TrainingSet.exercise_type_encrypted,
            TrainingSet.set_order,
            TrainingSet.reps_encrypted,
            TrainingSet.weight_encrypted,
            TrainingSet.note_encrypted,
        ),
    ).filter_by(user_id=user_id)
    if from_dt:
        q = q.filter(TrainingSession.started_at >= from_dt)
    if to_dt:
        q = q.filter(TrainingSession.started_at <= to_dt)
    if exercise_type:
        q = q.filter(
            exists()
            .where(TrainingSet.training_id == TrainingSession.id)
            .where(TrainingSet.exercise_type_hash == privacy_hash(exercise_type))
        )
    if cursor:
        cursor_started_at = cursor_datetime(cursor.get("started_at"))
        try:
            cursor_id = int(cursor.get("id"))
        except (TypeError, ValueError):
            cursor_id = None
        if cursor_started_at is not None and cursor_id is not None:
            q = q.filter(
                (TrainingSession.started_at < cursor_started_at)
                | ((TrainingSession.started_at == cursor_started_at) & (TrainingSession.id < cursor_id))
            )
    q = q.order_by(TrainingSession.started_at.desc(), TrainingSession.id.desc())

    total = None if cursor else q.count()
    items = q.limit(page_size + 1).all() if cursor else q.offset((page - 1) * page_size).limit(page_size).all()
    has_more = len(items) > page_size
    items = items[:page_size]
    next_cursor = (
        encode_cursor({"started_at": items[-1].started_at.isoformat(), "id": items[-1].id})
        if has_more and items
        else None
    )
    return jsonify(
        {
            "items": [_training_session_summary_public(item) for item in items],
            "page": page,
            "page_size": page_size,
            "total": total,
            "next_cursor": next_cursor,
        }
    )


@bp.get("/trainings/<int:session_id>")
@jwt_required()
def get_training_session(session_id: int):
    user_id = int(get_jwt_identity())
    session = TrainingSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return jsonify({"error": "not found"}), 404
    record_audit(actor_user_id=user_id, action="training.report.read", target_type="training_session", target_id=session.id)
    db.session.commit()
    return jsonify({"session": _training_session_public(session)})


@bp.delete("/trainings/<int:session_id>")
@jwt_required()
def delete_training_session(session_id: int):
    user_id = int(get_jwt_identity())
    session = TrainingSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return jsonify({"error": "not found"}), 404

    record_audit(actor_user_id=user_id, action="training.report.delete", target_type="training_session", target_id=session.id)
    db.session.delete(session)
    db.session.commit()
    return jsonify({"ok": True})


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

    session.report_summary_json = protect_json_payload(_clean_report_preview(report))
    session.report_json = protect_json_payload(report) or {}
    record_audit(actor_user_id=user_id, action="training.report.update", target_type="training_session", target_id=session.id)
    db.session.commit()
    return jsonify({"session": _training_session_public(session)})

