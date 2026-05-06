from __future__ import annotations

from datetime import datetime, time

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import exists

from ...extensions import db
from ...models import TrainingSession, TrainingSet
from ...services.pose.policy import get_pose_policy as build_pose_policy, normalize_pose_exercise_type
from ...utils.pagination import parse_pagination
from ...utils.privacy import protect_json_payload, reveal_json_payload

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
            exercise_type=normalize_pose_exercise_type(raw.get("exercise_type") or data.get("exercise_type")),
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

