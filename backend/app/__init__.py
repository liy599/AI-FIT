import os

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import text
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .extensions import cors, db, jwt
from .services.food.catalog_runtime import ensure_food_seed_data
from .utils.upload_access import normalize_upload_path, verify_upload_access_token

DB_INIT_ADVISORY_LOCK_KEY = 42042420


def _initialize_database() -> None:
    """Run app startup DB initialization safely under multi-worker startup."""
    engine = db.engine
    if engine.dialect.name != "postgresql":
        db.create_all()
        ensure_food_seed_data()
        return

    with engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(:key)"), {"key": DB_INIT_ADVISORY_LOCK_KEY})
        try:
            db.create_all()
            ensure_food_seed_data()
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": DB_INIT_ADVISORY_LOCK_KEY})


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    cors_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
    if cors_origins_env:
        cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    else:
        cors_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            app.config.get("FRONTEND_BASE_URL", "http://localhost:5173"),
        ]

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": cors_origins}, r"/uploads/*": {"origins": cors_origins}},
        intercept_exceptions=True,
    )
    db.init_app(app)
    jwt.init_app(app)

    upload_root = os.path.join(app.instance_path, "uploads")
    os.makedirs(upload_root, exist_ok=True)
    app.config.setdefault("UPLOAD_FOLDER", upload_root)
    app.config.setdefault("MAX_CONTENT_LENGTH", 80 * 1024 * 1024)

    from .routes.auth import bp as auth_bp
    from .routes.user import bp as user_bp
    from .routes.workouts import bp as workouts_bp
    from .routes.tags import bp as tags_bp
    from .routes.blogs import bp as blogs_bp
    from .routes.comments import bp as comments_bp
    from .routes.feedback import bp as feedback_bp
    from .routes.food import bp as food_bp
    from .routes.foods import bp as foods_bp
    from .routes.meals import bp as meals_bp
    from .routes.pose import bp as pose_bp
    from .routes.recognize import bp as recognize_bp
    from .routes.admin import bp as admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(workouts_bp, url_prefix="/api/workouts")
    app.register_blueprint(tags_bp, url_prefix="/api/tags")
    app.register_blueprint(blogs_bp, url_prefix="/api/blogs")
    app.register_blueprint(comments_bp, url_prefix="/api")
    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")
    app.register_blueprint(food_bp, url_prefix="/api/food")
    app.register_blueprint(foods_bp, url_prefix="/api/foods")
    app.register_blueprint(meals_bp, url_prefix="/api/meals")
    app.register_blueprint(pose_bp, url_prefix="/api/pose")
    app.register_blueprint(recognize_bp, url_prefix="/api/recognize")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/uploads/<path:filename>")
    @app.get("/api/uploads/<path:filename>")
    def uploads(filename: str):
        normalized = normalize_upload_path(filename)
        prefixes_raw = app.config.get("UPLOAD_PUBLIC_PREFIXES", "")
        public_prefixes = [p.strip().strip("/") for p in str(prefixes_raw).split(",") if p.strip()]

        is_public = any(
            normalized == prefix or normalized.startswith(f"{prefix}/")
            for prefix in public_prefixes
        )
        if not is_public:
            token = (request.args.get("token") or "").strip()
            max_age = int(app.config.get("UPLOAD_SIGNED_URL_TTL_SECONDS", 300))
            if not verify_upload_access_token(token, normalized, max_age=max_age):
                return jsonify({"error": "forbidden"}), 403

        return send_from_directory(app.config["UPLOAD_FOLDER"], normalized)

    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(_: RequestEntityTooLarge):
        return jsonify({"error": "file too large (max 80MB)"}), 413

    with app.app_context():
        _initialize_database()

    return app
