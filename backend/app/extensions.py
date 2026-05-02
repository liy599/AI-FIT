from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

try:
    from flask_migrate import Migrate
except Exception:  # pragma: no cover
    Migrate = None  # type: ignore[assignment]

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
if Migrate is None:
    class _NoopMigrate:
        def init_app(self, *args, **kwargs):
            return None

    migrate = _NoopMigrate()
else:
    migrate = Migrate()

