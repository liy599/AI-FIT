import os


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    APP_ENV = os.environ.get("APP_ENV", "development").strip().lower() or "development"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").strip()
    DB_AUTO_INIT = _env_bool("DB_AUTO_INIT", True)
    REDIS_URL = os.environ.get("REDIS_URL", "").strip()
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
    POSE_SERVER_INFERENCE_ENABLED = _env_bool("POSE_SERVER_INFERENCE_ENABLED", False)
    POSE_SERVER_INFERENCE_POLL_INTERVAL_SECONDS = _env_int("POSE_SERVER_INFERENCE_POLL_INTERVAL_SECONDS", 2)
    POSE_POLICY_LIVE_TARGET_FPS = _env_int("POSE_POLICY_LIVE_TARGET_FPS", 40)
    POSE_POLICY_LIVE_SESSION_LIMIT_SECONDS = _env_int("POSE_POLICY_LIVE_SESSION_LIMIT_SECONDS", 120)
    POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES = _env_int("POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES", 50 * 1024 * 1024)
    POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS = _env_int("POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS", 120)
    POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS = _env_int("POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS", 40)
    POSE_POLICY_OFFLINE_ALLOWED_ACTIONS = os.environ.get(
        "POSE_POLICY_OFFLINE_ALLOWED_ACTIONS", "squat,pushup,pullup,lateral-raise,bent-over-row"
    )

    DATA_ENCRYPTION_KEY = os.environ.get("DATA_ENCRYPTION_KEY", "")
    PASSWORD_RESET_TOKEN_TTL_SECONDS = _env_int("PASSWORD_RESET_TOKEN_TTL_SECONDS", 60 * 60)
    PASSWORD_RESET_DEBUG_RETURN_LINK = _env_bool("PASSWORD_RESET_DEBUG_RETURN_LINK", False)
    UPLOAD_PUBLIC_PREFIXES = os.environ.get("UPLOAD_PUBLIC_PREFIXES", "avatars,blog_covers")
    UPLOAD_SIGNED_URL_TTL_SECONDS = _env_int("UPLOAD_SIGNED_URL_TTL_SECONDS", 300)

    RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", True)
    AUTH_LOGIN_RATE_LIMIT_PER_IP = _env_int("AUTH_LOGIN_RATE_LIMIT_PER_IP", 20)
    AUTH_LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS = _env_int("AUTH_LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS", 300)
    AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT = _env_int("AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT", 8)
    AUTH_LOGIN_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS = _env_int("AUTH_LOGIN_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 900)
    AUTH_FORGOT_RATE_LIMIT_PER_IP = _env_int("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)
    AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS = _env_int("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)
    AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT = _env_int("AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT", 5)
    AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS = _env_int("AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 1800)
    FEEDBACK_RATE_LIMIT_PER_IP = _env_int("FEEDBACK_RATE_LIMIT_PER_IP", 20)
    FEEDBACK_RATE_LIMIT_IP_WINDOW_SECONDS = _env_int("FEEDBACK_RATE_LIMIT_IP_WINDOW_SECONDS", 600)
    FEEDBACK_RATE_LIMIT_PER_SUBJECT = _env_int("FEEDBACK_RATE_LIMIT_PER_SUBJECT", 10)
    FEEDBACK_RATE_LIMIT_SUBJECT_WINDOW_SECONDS = _env_int("FEEDBACK_RATE_LIMIT_SUBJECT_WINDOW_SECONDS", 600)
