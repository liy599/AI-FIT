from flask import Blueprint, jsonify

from ..models import Tag

bp = Blueprint("tags", __name__)


@bp.get("")
def list_tags():
    tags = Tag.query.order_by(Tag.name.asc()).all()
    return jsonify([{"id": t.id, "name": t.name} for t in tags])

