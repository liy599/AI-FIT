import tempfile
from pathlib import Path

from app import create_app
from app.config import Config
from app.extensions import db
from app.models import User


def test_admin_email_seed_promotes_existing_user():
    with tempfile.TemporaryDirectory() as temp_dir:
        db_url = f"sqlite+pysqlite:///{(Path(temp_dir) / 'admin_seed.db').as_posix()}"

        class Cfg(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = db_url
            DB_AUTO_INIT = False
            JWT_SECRET_KEY = "test-jwt"
            SECRET_KEY = "test-secret"
            ADMIN_EMAIL = "seed-admin@example.com"

        app1 = create_app(Cfg)
        with app1.app_context():
            db.create_all()
            u = User(email=Cfg.ADMIN_EMAIL, username="seed-admin", password_hash="x")
            db.session.add(u)
            db.session.commit()
            db.session.remove()
            db.engine.dispose()

        app2 = create_app(Cfg)
        with app2.app_context():
            u2 = User.query.filter_by(email=Cfg.ADMIN_EMAIL).first()
            assert u2 is not None
            assert u2.is_admin is True
            db.session.remove()
            db.engine.dispose()

