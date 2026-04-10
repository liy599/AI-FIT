import os


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except Exception:
        return default


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

    AI_REPORT_API_URL = os.environ.get("AI_REPORT_API_URL", "")
    AI_REPORT_API_KEY = os.environ.get("AI_REPORT_API_KEY", "")
    AI_REPORT_MODEL = os.environ.get("AI_REPORT_MODEL", "")
    AI_REPORT_TIMEOUT_SECONDS = _env_int("AI_REPORT_TIMEOUT_SECONDS", 20)

    POSE_REPORT_AI_ENABLED = os.environ.get("POSE_REPORT_AI_ENABLED", "1")
    POSE_REPORT_AI_MODEL = os.environ.get("POSE_REPORT_AI_MODEL", "")
    POSE_REPORT_AI_TIMEOUT_SECONDS = _env_int("POSE_REPORT_AI_TIMEOUT_SECONDS", 20)
    POSE_REPORT_AI_MAX_INPUT_CHARS = _env_int("POSE_REPORT_AI_MAX_INPUT_CHARS", 12000)
