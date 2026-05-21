from flask import Blueprint, jsonify

from sqlalchemy.exc import IntegrityError

from ...extensions import db
from ...models import Tag

bp = Blueprint("tags", __name__)

BLOG_TAGS = ("Diet", "Training", "Record", "Experience")


@bp.get("")
def list_tags():
    existing = {tag.name: tag for tag in Tag.query.filter(Tag.name.in_(BLOG_TAGS)).all()}
    changed = False
    for name in BLOG_TAGS:
        if name not in existing:
            tag = Tag(name=name)
            db.session.add(tag)
            existing[name] = tag
            changed = True
    if changed:
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            existing = {tag.name: tag for tag in Tag.query.filter(Tag.name.in_(BLOG_TAGS)).all()}

    tags = [existing[name] for name in BLOG_TAGS]
    response = jsonify([{"id": t.id, "name": t.name} for t in tags])
    response.headers["Cache-Control"] = "public, max-age=30"
    return response

