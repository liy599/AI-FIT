"""baseline

Revision ID: cb3b82bfb8ed
Revises: 
Create Date: 2026-05-02 19:35:44.110673

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'cb3b82bfb8ed'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    from app.models import db

    bind = op.get_bind()
    db.metadata.create_all(bind=bind, checkfirst=True)


def downgrade():
    from app.models import db

    bind = op.get_bind()
    db.metadata.drop_all(bind=bind, checkfirst=True)
