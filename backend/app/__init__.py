import os

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .extensions import cors, db, jwt, migrate
from .services.food.catalog_runtime import ensure_food_seed_data
from .services.pose.server_inference_worker import start_server_inference_worker
from .utils.upload_access import normalize_upload_path, verify_upload_access_token

def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)
    _validate_production_config(app)

    cors_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
    if cors_origins_env:
        cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    else:
        cors_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            app.config.get("FRONTEND_BASE_URL", "http://localhost:5173"),
            r"^http://localhost:\d+$",
            r"^http://127\.0\.0\.1:\d+$",
        ]

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": cors_origins}, r"/uploads/*": {"origins": cors_origins}},
        intercept_exceptions=True,
        supports_credentials=True,
    )
    db.init_app(app)
    migrate.init_app(app, db)
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
        if bool(app.config.get("DB_AUTO_INIT", True)):
            ensure_food_seed_data()
        start_server_inference_worker(app)

    return app


def _validate_production_config(app: Flask) -> None:
    if str(app.config.get("APP_ENV", "")).lower() != "production":
        return

    secret_key = str(app.config.get("SECRET_KEY", "")).strip()
    jwt_secret_key = str(app.config.get("JWT_SECRET_KEY", "")).strip()
    admin_email = str(app.config.get("ADMIN_EMAIL", "")).strip()
    password_reset_debug = bool(app.config.get("PASSWORD_RESET_DEBUG_RETURN_LINK", False))
    if not secret_key or secret_key == "dev-secret-change-me":
        raise RuntimeError("production requires non-default SECRET_KEY")
    if not jwt_secret_key or jwt_secret_key == "dev-jwt-secret-change-me":
        raise RuntimeError("production requires non-default JWT_SECRET_KEY")
    if len(secret_key) < 32 or len(jwt_secret_key) < 32:
        raise RuntimeError("production secrets must be at least 32 chars")
    if not admin_email:
        raise RuntimeError("production requires ADMIN_EMAIL")
    if password_reset_debug:
        raise RuntimeError("production requires PASSWORD_RESET_DEBUG_RETURN_LINK=0")
    cors_origins = str(app.config.get("CORS_ORIGINS", "")).strip()
    redis_url = str(app.config.get("REDIS_URL", "")).strip()
    if not cors_origins:
        raise RuntimeError("production requires explicit CORS_ORIGINS")
    if not redis_url:
        raise RuntimeError("production requires REDIS_URL for distributed rate limiting")
    if bool(app.config.get("DB_AUTO_INIT", True)):
        raise RuntimeError("production requires DB_AUTO_INIT=0; run migrations explicitly")
