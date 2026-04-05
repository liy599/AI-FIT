import os

from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .extensions import cors, db, jwt


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
    app.config.setdefault("MAX_CONTENT_LENGTH", 5 * 1024 * 1024)

    from .routes.auth import bp as auth_bp
    from .routes.user import bp as user_bp
    from .routes.workouts import bp as workouts_bp
    from .routes.diets import bp as diets_bp
    from .routes.tags import bp as tags_bp
    from .routes.blogs import bp as blogs_bp
    from .routes.comments import bp as comments_bp
    from .routes.courses import bp as courses_bp
    from .routes.course_comments import bp as course_comments_bp
    from .routes.feedback import bp as feedback_bp
    from .routes.nutrition import bp as nutrition_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(workouts_bp, url_prefix="/api/workouts")
    app.register_blueprint(diets_bp, url_prefix="/api/diets")
    app.register_blueprint(tags_bp, url_prefix="/api/tags")
    app.register_blueprint(blogs_bp, url_prefix="/api/blogs")
    app.register_blueprint(comments_bp, url_prefix="/api")
    app.register_blueprint(courses_bp, url_prefix="/api/courses")
    app.register_blueprint(course_comments_bp, url_prefix="/api")
    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")
    app.register_blueprint(nutrition_bp, url_prefix="/api/nutrition")

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/uploads/<path:filename>")
    def uploads(filename: str):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(_: RequestEntityTooLarge):
        return jsonify({"error": "file too large (max 5MB)"}), 413

    with app.app_context():
        db.create_all()

    return app

