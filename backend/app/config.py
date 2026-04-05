import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
    STEPFUN_API_URL = os.environ.get("STEPFUN_API_URL", "")
    STEPFUN_API_KEY = os.environ.get("STEPFUN_API_KEY", "")
    STEPFUN_MODEL = os.environ.get("STEPFUN_MODEL", "step-1v-8k")

