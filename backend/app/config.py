import os


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except Exception:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}

def _is_local_url(url: str) -> bool:
    normalized = (url or "").strip().lower()
    return normalized.startswith("http://localhost") or normalized.startswith("http://127.0.0.1")


class Config:
    APP_ENV = os.environ.get("APP_ENV", "development").strip().lower() or "development"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": _env_int("DB_POOL_RECYCLE_SECONDS", 1800),
    }

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
    POSE_POLICY_VERSION = os.environ.get("POSE_POLICY_VERSION", "2026-05-04.v1")
    POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES = _env_int("POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES", 50 * 1024 * 1024)
    POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS = _env_int("POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS", 120)
    POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS = _env_int("POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS", 40)
    POSE_POLICY_OFFLINE_ALLOWED_ACTIONS = os.environ.get(
        "POSE_POLICY_OFFLINE_ALLOWED_ACTIONS", "squat,pushup,lateral-raise,bent-over-row"
    )
    POSE_POLICY_TRACKING_QUALITY_MIN = _env_float("POSE_POLICY_TRACKING_QUALITY_MIN", 0.28)
    POSE_POLICY_TEMPO_FAST_THRESHOLD_SECONDS = _env_float("POSE_POLICY_TEMPO_FAST_THRESHOLD_SECONDS", 0.4)
    POSE_POLICY_SQUAT_KNEE_FORWARD_WARN_RATIO = _env_float("POSE_POLICY_SQUAT_KNEE_FORWARD_WARN_RATIO", 0.045)
    POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_RATIO = _env_float("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_RATIO", 0.058)
    POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_MIN_FRAMES = _env_int("POSE_POLICY_SQUAT_KNEE_FORWARD_FAIL_MIN_FRAMES", 2)
    POSE_POLICY_SQUAT_FORWARD_LEAN_WARN_DEG = _env_int("POSE_POLICY_SQUAT_FORWARD_LEAN_WARN_DEG", 40)
    POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_DEG = _env_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_DEG", 55)
    POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_MIN_FRAMES = _env_int("POSE_POLICY_SQUAT_FORWARD_LEAN_FAIL_MIN_FRAMES", 5)
    POSE_POLICY_PUSHUP_BODY_LINE_WARN_RATIO = _env_float("POSE_POLICY_PUSHUP_BODY_LINE_WARN_RATIO", 0.20)
    POSE_POLICY_PUSHUP_BODY_LINE_FAIL_RATIO = _env_float("POSE_POLICY_PUSHUP_BODY_LINE_FAIL_RATIO", 0.45)
    POSE_POLICY_PUSHUP_DEPTH_WARN_RATIO = _env_float("POSE_POLICY_PUSHUP_DEPTH_WARN_RATIO", 0.20)
    POSE_POLICY_PUSHUP_DEPTH_FAIL_RATIO = _env_float("POSE_POLICY_PUSHUP_DEPTH_FAIL_RATIO", 0.45)
    POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_RATIO = _env_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_WARN_RATIO", 0.12)
    POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_RATIO = _env_float("POSE_POLICY_LATERAL_RAISE_TORSO_SWAY_FAIL_RATIO", 0.35)
    POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_RATIO = _env_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_WARN_RATIO", 0.12)
    POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_RATIO = _env_float("POSE_POLICY_LATERAL_RAISE_SYMMETRY_FAIL_RATIO", 0.35)
    POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG = _env_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_WARN_DEG", 35)
    POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG = _env_int("POSE_POLICY_BENT_OVER_ROW_BACK_ANGLE_FAIL_DEG", 50)
    POSE_POLICY_BENT_OVER_ROW_RANGE_WARN_RATIO = _env_float("POSE_POLICY_BENT_OVER_ROW_RANGE_WARN_RATIO", 0.12)
    POSE_POLICY_BENT_OVER_ROW_RANGE_FAIL_RATIO = _env_float("POSE_POLICY_BENT_OVER_ROW_RANGE_FAIL_RATIO", 0.35)

    DATA_ENCRYPTION_KEY = os.environ.get("DATA_ENCRYPTION_KEY", "")
    PASSWORD_RESET_TOKEN_TTL_SECONDS = _env_int("PASSWORD_RESET_TOKEN_TTL_SECONDS", 60 * 60)
    PASSWORD_RESET_DEBUG_RETURN_LINK = _env_bool("PASSWORD_RESET_DEBUG_RETURN_LINK", False)
    PASSWORD_RESET_EMAIL_SUBJECT = os.environ.get("PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")

    EMAIL_VERIFY_REQUIRED = _env_bool("EMAIL_VERIFY_REQUIRED", True)
    EMAIL_VERIFY_TOKEN_TTL_SECONDS = _env_int("EMAIL_VERIFY_TOKEN_TTL_SECONDS", 60 * 60)
    EMAIL_VERIFY_DEBUG_RETURN_LINK = _env_bool("EMAIL_VERIFY_DEBUG_RETURN_LINK", False)
    EMAIL_VERIFY_EMAIL_SUBJECT = os.environ.get("EMAIL_VERIFY_EMAIL_SUBJECT", "Verify your email")

    SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
    SMTP_PORT = _env_int("SMTP_PORT", 587)
    SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
    SMTP_USE_TLS = _env_bool("SMTP_USE_TLS", True)
    SMTP_USE_SSL = _env_bool("SMTP_USE_SSL", False)
    SMTP_FROM = os.environ.get("SMTP_FROM", "").strip()
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
    AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT = _env_int("AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT", 5)
    AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS = _env_int("AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 3600)
    BLOG_CREATE_DAILY_LIMIT_PER_USER = _env_int("BLOG_CREATE_DAILY_LIMIT_PER_USER", 10)
    # JWT in HttpOnly cookies (preferred for browser-based clients)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = _env_bool("JWT_COOKIE_SECURE", APP_ENV == "production" and not _is_local_url(FRONTEND_BASE_URL))
    JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax")
    JWT_COOKIE_CSRF_PROTECT = _env_bool("JWT_COOKIE_CSRF_PROTECT", True)
    JWT_ACCESS_COOKIE_PATH = "/"

