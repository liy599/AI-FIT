from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...extensions import db
from ...models import WorkoutRecord
from ...utils.pagination import decode_cursor, encode_cursor, parse_pagination
from ...utils.privacy import privacy_hash

bp = Blueprint("workouts", __name__)


@bp.get("")
@jwt_required()
def list_workouts():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=12)
    cursor = decode_cursor(request.args.get("cursor"))

    q = WorkoutRecord.query.filter_by(user_id=user_id)
    if request.args.get("exercise_type"):
        q = q.filter(WorkoutRecord.exercise_type_hash == privacy_hash(request.args["exercise_type"]))
    if request.args.get("from"):
        q = q.filter(WorkoutRecord.workout_date >= date.fromisoformat(request.args["from"]))
    if request.args.get("to"):
        q = q.filter(WorkoutRecord.workout_date <= date.fromisoformat(request.args["to"]))

    if cursor:
        try:
            cursor_date = date.fromisoformat(str(cursor.get("workout_date")))
            cursor_id = int(cursor.get("id"))
        except (TypeError, ValueError):
            cursor_date = None
            cursor_id = None
        if cursor_date is not None and cursor_id is not None:
            q = q.filter(
                (WorkoutRecord.workout_date < cursor_date)
                | ((WorkoutRecord.workout_date == cursor_date) & (WorkoutRecord.id < cursor_id))
            )

    q = q.order_by(WorkoutRecord.workout_date.desc(), WorkoutRecord.id.desc())
    total = None if cursor else q.count()
    items = q.limit(page_size + 1).all() if cursor else q.offset((page - 1) * page_size).limit(page_size).all()
    has_more = len(items) > page_size
    items = items[:page_size]
    next_cursor = (
        encode_cursor({"workout_date": items[-1].workout_date.isoformat(), "id": items[-1].id})
        if has_more and items
        else None
    )

    return jsonify(
        {
            "items": [
                {
                    "id": w.id,
                    "exercise_type": w.exercise_type,
                    "duration": w.duration,
                    "calories_burned": float(w.calories_burned) if w.calories_burned is not None else None,
                    "form_score": float(w.form_score) if w.form_score is not None else None,
                    "notes": w.notes,
                    "workout_date": w.workout_date.isoformat(),
                    "created_at": w.created_at.isoformat(),
                }
                for w in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
            "next_cursor": next_cursor,
        }
    )


@bp.post("")
@jwt_required()
def create_workout():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    exercise_type = (data.get("exercise_type") or "").strip()
    workout_date = data.get("workout_date") or ""
    if not exercise_type or not workout_date:
        return jsonify({"error": "exercise_type/workout_date required"}), 400

    w = WorkoutRecord(
        user_id=user_id,
        exercise_type=exercise_type,
        duration=data.get("duration"),
        calories_burned=data.get("calories_burned"),
        form_score=data.get("form_score"),
        notes=data.get("notes"),
        workout_date=date.fromisoformat(workout_date),
    )
    db.session.add(w)
    db.session.commit()

    return jsonify({"id": w.id}), 201

