import os
import sys

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .extensions import cors, db, jwt, migrate
from .services.food.catalog_runtime import ensure_food_seed_data
try:
    from .services.pose.server_inference_worker import start_server_inference_worker
except Exception:
    def start_server_inference_worker(*args, **kwargs):
        return None
from .utils.upload_access import normalize_upload_path, verify_upload_access_token

def _is_cli_migration() -> bool:
    argv = [str(a) for a in sys.argv]
    argv_lower = [a.lower() for a in argv]
    has_flask = any("flask" in a for a in argv_lower)
    return has_flask and ("db" in argv_lower)


def _ensure_admin_seed(app: Flask) -> None:
    admin_email = str(app.config.get("ADMIN_EMAIL", "")).strip().lower()
    if not admin_email:
        return
    try:
        from .models import User

        user = User.query.filter_by(email=admin_email).first()
        if user is None or user.is_admin:
            return
        user.is_admin = True
        db.session.commit()
    except Exception:
        try:
            db.session.rollback()
        except Exception:
            pass

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

    from .routes.account.auth import bp as auth_bp
    from .routes.account.user import bp as user_bp
    from .routes.account.workouts import bp as workouts_bp
    from .routes.account.feedback import bp as feedback_bp
    from .routes.admin.lifecycle import bp as admin_bp
    from .routes.admin.users import bp as admin_users_bp
    from .routes.blog.blogs import bp as blogs_bp
    from .routes.blog.comments import bp as comments_bp
    from .routes.blog.tags import bp as tags_bp
    from .routes.food.foods import bp as foods_bp
    from .routes.food.meals import bp as meals_bp
    from .routes.food.meta import bp as food_bp
    from .routes.food.recognize import bp as recognize_bp
    from .routes.pose.api import bp as pose_bp

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
    app.register_blueprint(admin_users_bp, url_prefix="/api/admin")

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

        response = send_from_directory(app.config["UPLOAD_FOLDER"], normalized)
        if is_public:
            response.cache_control.public = True
            response.cache_control.max_age = 60 * 60 * 24 * 30
        return response

    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(_: RequestEntityTooLarge):
        return jsonify({"error": "file too large (max 80MB)"}), 413

    with app.app_context():
        if (not _is_cli_migration()) and bool(app.config.get("DB_AUTO_INIT", True)):
            ensure_food_seed_data()
        if not _is_cli_migration():
            _ensure_admin_seed(app)
        if not _is_cli_migration():
            start_server_inference_worker(app)

    return app


def _validate_production_config(app: Flask) -> None:
    if str(app.config.get("APP_ENV", "")).lower() != "production":
        return

    secret_key = str(app.config.get("SECRET_KEY", "")).strip()
    jwt_secret_key = str(app.config.get("JWT_SECRET_KEY", "")).strip()
    password_reset_debug = bool(app.config.get("PASSWORD_RESET_DEBUG_RETURN_LINK", False))
    email_verify_debug = bool(app.config.get("EMAIL_VERIFY_DEBUG_RETURN_LINK", False))
    if not secret_key or secret_key == "dev-secret-change-me":
        raise RuntimeError("production requires non-default SECRET_KEY")
    if not jwt_secret_key or jwt_secret_key == "dev-jwt-secret-change-me":
        raise RuntimeError("production requires non-default JWT_SECRET_KEY")
    if len(secret_key) < 32 or len(jwt_secret_key) < 32:
        raise RuntimeError("production secrets must be at least 32 chars")
    if password_reset_debug:
        raise RuntimeError("production requires PASSWORD_RESET_DEBUG_RETURN_LINK=0")
    if email_verify_debug:
        raise RuntimeError("production requires EMAIL_VERIFY_DEBUG_RETURN_LINK=0")
    cors_origins = str(app.config.get("CORS_ORIGINS", "")).strip()
    redis_url = str(app.config.get("REDIS_URL", "")).strip()
    smtp_host = str(app.config.get("SMTP_HOST", "")).strip()
    smtp_from = str(app.config.get("SMTP_FROM", "")).strip()
    if not cors_origins:
        raise RuntimeError("production requires explicit CORS_ORIGINS")
    if not redis_url:
        raise RuntimeError("production requires REDIS_URL for distributed rate limiting")
    if bool(app.config.get("EMAIL_VERIFY_REQUIRED", True)) and (not smtp_host or not smtp_from):
        raise RuntimeError("production requires SMTP_HOST and SMTP_FROM when EMAIL_VERIFY_REQUIRED=1")
    if bool(app.config.get("DB_AUTO_INIT", True)):
        raise RuntimeError("production requires DB_AUTO_INIT=0; run migrations explicitly")
