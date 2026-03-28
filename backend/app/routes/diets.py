from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import DietRecord
from ..utils.pagination import parse_pagination

bp = Blueprint("diets", __name__)


@bp.get("")
@jwt_required()
def list_diets():
    user_id = int(get_jwt_identity())
    page, page_size = parse_pagination(request.args, default_page_size=12)

    q = DietRecord.query.filter_by(user_id=user_id)
    if request.args.get("meal_type"):
        q = q.filter(DietRecord.meal_type == request.args["meal_type"])
    if request.args.get("from"):
        q = q.filter(DietRecord.meal_date >= date.fromisoformat(request.args["from"]))
    if request.args.get("to"):
        q = q.filter(DietRecord.meal_date <= date.fromisoformat(request.args["to"]))

    q = q.order_by(DietRecord.meal_date.desc(), DietRecord.id.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        {
            "items": [
                {
                    "id": d.id,
                    "food_name": d.food_name,
                    "quantity": float(d.quantity) if d.quantity is not None else None,
                    "calories": float(d.calories) if d.calories is not None else None,
                    "protein": float(d.protein) if d.protein is not None else None,
                    "fat": float(d.fat) if d.fat is not None else None,
                    "carbohydrates": float(d.carbohydrates) if d.carbohydrates is not None else None,
                    "fiber": float(d.fiber) if d.fiber is not None else None,
                    "sugar": float(d.sugar) if d.sugar is not None else None,
                    "meal_type": d.meal_type,
                    "meal_date": d.meal_date.isoformat(),
                    "created_at": d.created_at.isoformat(),
                }
                for d in items
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    )


@bp.post("")
@jwt_required()
def create_diet():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    food_name = (data.get("food_name") or "").strip()
    meal_date = data.get("meal_date") or ""
    if not food_name or not meal_date:
        return jsonify({"error": "food_name/meal_date required"}), 400

    d = DietRecord(
        user_id=user_id,
        food_name=food_name,
        quantity=data.get("quantity"),
        calories=data.get("calories"),
        protein=data.get("protein"),
        fat=data.get("fat"),
        carbohydrates=data.get("carbohydrates"),
        fiber=data.get("fiber"),
        sugar=data.get("sugar"),
        meal_type=data.get("meal_type"),
        meal_date=date.fromisoformat(meal_date),
    )
    db.session.add(d)
    db.session.commit()

    return jsonify({"id": d.id}), 201

