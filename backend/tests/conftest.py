import os

import pytest

from app import create_app
from app.config import Config
from app.extensions import db


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite+pysqlite:///:memory:"
    JWT_SECRET_KEY = "test-jwt"
    SECRET_KEY = "test-secret"


@pytest.fixture()
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()

