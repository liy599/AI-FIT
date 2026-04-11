import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.config import Config
from app.extensions import db
from app.utils.rate_limit import reset_rate_limits


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite+pysqlite:///:memory:"
    JWT_SECRET_KEY = "test-jwt"
    SECRET_KEY = "test-secret"
    PASSWORD_RESET_DEBUG_RETURN_LINK = True
    ADMIN_EMAIL = "admin@example.com"


@pytest.fixture()
def app():
    reset_rate_limits()
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()

