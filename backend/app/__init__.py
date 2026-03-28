from flask import Flask, jsonify

from .config import Config
from .extensions import cors, db, jwt


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    jwt.init_app(app)

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

    with app.app_context():
        db.create_all()

    return app

