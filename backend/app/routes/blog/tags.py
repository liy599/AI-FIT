from flask import Blueprint, jsonify

from ...extensions import db
from ...models import Tag

bp = Blueprint("tags", __name__)

BLOG_TAGS = ("Diet", "Training", "Other")


@bp.get("")
def list_tags():
    existing = {tag.name: tag for tag in Tag.query.filter(Tag.name.in_(BLOG_TAGS)).all()}
    for name in BLOG_TAGS:
        if name not in existing:
            tag = Tag(name=name)
            db.session.add(tag)
            existing[name] = tag
    db.session.commit()

    tags = [existing[name] for name in BLOG_TAGS]
    return jsonify([{"id": t.id, "name": t.name} for t in tags])

