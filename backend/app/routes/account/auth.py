import re
import secrets
from datetime import datetime, timedelta
from typing import Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, set_access_cookies, unset_jwt_cookies

from ...extensions import db
from ...models import EmailVerification, PasswordResetCode, User
from ...utils.mailer import is_email_delivery_configured, send_email_verification_email, send_password_reset_email
from ...utils.media_url import public_media_url_or_none
from ...utils.rate_limit import consume_rate_limit, get_client_ip, subject_fingerprint
from ...utils.security import hash_password, verify_password

bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _is_admin_user(u: User) -> bool:
    return bool(u.is_admin)


def _auth_user(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "avatar_url": public_media_url_or_none(u.avatar_url),
        "is_admin": _is_admin_user(u),
        "is_disabled": bool(u.is_disabled),
    }


def _is_valid_email(email: str) -> bool:
    return bool(email and _EMAIL_RE.match(email))


def _validate_username(username: str) -> Optional[str]:
    text = (username or "").strip()
    if len(text) < 3 or len(text) > 15:
        return "username length must be 3-15"
    if any(ch.isspace() for ch in text):
        return "username cannot contain whitespace"
    return None


def _validate_password(password: str, *, email: str, username: str) -> Optional[str]:
    text = password or ""
    if len(text) < 8 or len(text) > 20:
        return "password length must be 8-20"
    if any(ch.isspace() for ch in text):
        return "password cannot contain whitespace"
    if text.isdigit():
        return "password too weak"
    lower = text.lower()
    if lower in {"12345678", "password", "123456789", "qwerty123"}:
        return "password too weak"
    if email and lower == email.lower():
        return "password too weak"
    if username and lower == username.lower():
        return "password too weak"
    has_letter = any(ch.isalpha() for ch in text)
    has_digit = any(ch.isdigit() for ch in text)
    if not (has_letter and has_digit):
        return "password too weak"
    return None


def _generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _is_email_verified(email: str) -> bool:
    row = EmailVerification.query.filter_by(email=email).first()
    return bool(row and row.verified_at)


def _utcnow_seconds() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


def _is_code_expired(*, sent_at: Optional[datetime], ttl_seconds: int) -> bool:
    if not sent_at:
        return True
    delta = _utcnow_seconds() - sent_at.replace(microsecond=0)
    return delta.total_seconds() > ttl_seconds


def _get_valid_password_reset_row(email: str, code: str) -> tuple[Optional[PasswordResetCode], Optional[str]]:
    row = PasswordResetCode.query.filter_by(email=email).first()
    if row is None:
        return None, "invalid code"
    if row.used_at:
        return None, "invalid code"
    if not row.code_hash:
        return None, "invalid code"
    if _is_code_expired(
        sent_at=row.last_sent_at,
        ttl_seconds=int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 60 * 60)),
    ):
        return None, "code expired"
    if not verify_password(code, row.code_hash):
        return None, "invalid code"

    user = db.session.get(User, int(row.user_id))
    if user is None or user.email != email:
        return None, "invalid code"
    return row, None


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not email or not username or not password:
        return jsonify({"error": "email/username/password required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400
    username_err = _validate_username(username)
    if username_err:
        return jsonify({"error": username_err}), 400
    password_err = _validate_password(password, email=email, username=username)
    if password_err:
        return jsonify({"error": password_err}), 400

    if bool(current_app.config.get("EMAIL_VERIFY_REQUIRED", False)) and not _is_email_verified(email):
        return jsonify({"error": "email not verified"}), 403

    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "email already exists"}), 409
    if User.query.filter_by(username=username).first() is not None:
        return jsonify({"error": "username already exists"}), 409

    user = User(email=email, username=username, password_hash=hash_password(password))
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))
    response = jsonify({"user": _auth_user(user)})
    set_access_cookies(response, access_token)
    return response


@bp.post("/request-email-verification")
def request_email_verification():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:verify:ip:{ip}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:verify:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 3600)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "email already exists"}), 409

    email_enabled = is_email_delivery_configured()
    debug_return_code = bool(current_app.config.get("EMAIL_VERIFY_DEBUG_RETURN_LINK", False))

    row = EmailVerification.query.filter_by(email=email).first()
    sent_at = _utcnow_seconds()
    code = _generate_verification_code()

    if debug_return_code:
        if row is None:
            row = EmailVerification(email=email)
            db.session.add(row)
        row.last_sent_at = sent_at
        row.verified_at = None
        row.code_hash = hash_password(code)
        db.session.commit()
        return jsonify({"ok": True, "email_sent": False, "verification_code": code})

    if not email_enabled:
        return jsonify({"error": "email delivery not configured"}), 500

    try:
        send_email_verification_email(to_email=email, verification_code=code)
    except Exception:
        return jsonify({"error": "email delivery failed"}), 500

    if row is None:
        row = EmailVerification(email=email)
        db.session.add(row)
    row.last_sent_at = sent_at
    row.verified_at = None
    row.code_hash = hash_password(code)
    db.session.commit()
    return jsonify({"ok": True, "email_sent": True})


@bp.post("/verify-email")
def verify_email():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify({"error": "email/code required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:verify-code:ip:{ip}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:verify-code:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 1800)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    now = _utcnow_seconds()
    row = EmailVerification.query.filter_by(email=email).first()
    if row is None:
        return jsonify({"error": "invalid code"}), 400
    if row.verified_at:
        return jsonify({"ok": True, "email": email})
    if not row.code_hash:
        return jsonify({"error": "invalid code"}), 400
    if _is_code_expired(
        sent_at=row.last_sent_at,
        ttl_seconds=int(current_app.config.get("EMAIL_VERIFY_TOKEN_TTL_SECONDS", 60 * 60)),
    ):
        return jsonify({"error": "code expired"}), 400
    if not verify_password(code, row.code_hash):
        return jsonify({"error": "invalid code"}), 400

    row.verified_at = now
    row.code_hash = None
    db.session.commit()
    return jsonify({"ok": True, "email": email})


@bp.get("/email-verification-status")
def email_verification_status():
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400
    return jsonify({"ok": True, "email_verified": _is_email_verified(email)})


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email/password required"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:login:ip:{ip}",
            limit=int(current_app.config.get("AUTH_LOGIN_RATE_LIMIT_PER_IP", 20)),
            window_seconds=int(current_app.config.get("AUTH_LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS", 300)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:login:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT", 8)),
            window_seconds=int(current_app.config.get("AUTH_LOGIN_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 900)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    user = User.query.filter_by(email=email).first()
    if user is None or not verify_password(password, user.password_hash):
        return jsonify({"error": "invalid credentials"}), 401
    if user.is_disabled:
        return jsonify({"error": "account disabled"}), 403

    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))
    response = jsonify({"user": _auth_user(user)})
    set_access_cookies(response, access_token)
    return response


@bp.post("/logout")
@jwt_required()
def logout():
    response = jsonify({"ok": True})
    unset_jwt_cookies(response)
    return response


@bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:forgot:ip:{ip}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:forgot:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 3600)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    user = User.query.filter_by(email=email).first()
    if user is None:
        email_enabled = is_email_delivery_configured()
        debug_return_code = bool(current_app.config.get("PASSWORD_RESET_DEBUG_RETURN_LINK", False))
        if debug_return_code:
            return jsonify({"ok": True, "email_sent": False})
        if not email_enabled:
            return jsonify({"error": "email delivery not configured"}), 500
        return jsonify({"ok": True, "email_sent": True})

    row = PasswordResetCode.query.filter_by(email=email).first()
    sent_at = _utcnow_seconds()
    code = _generate_verification_code()

    debug_return_code = bool(current_app.config.get("PASSWORD_RESET_DEBUG_RETURN_LINK", False))
    if row is None:
        row = PasswordResetCode(user_id=user.id, email=email)
        db.session.add(row)
    row.last_sent_at = sent_at
    row.used_at = None
    row.code_hash = hash_password(code)
    db.session.commit()

    if debug_return_code:
        return jsonify({"ok": True, "email_sent": False, "reset_code": code})

    email_enabled = is_email_delivery_configured()
    if not email_enabled:
        return jsonify({"error": "email delivery not configured"}), 500

    try:
        send_password_reset_email(to_email=user.email, reset_code=code)
    except Exception:
        return jsonify({"error": "email delivery failed"}), 500

    return jsonify({"ok": True, "email_sent": True})


@bp.post("/verify-reset-code")
def verify_reset_code():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify({"error": "email/code required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400
    if not re.fullmatch(r"[0-9]{6}", code):
        return jsonify({"error": "invalid code"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:verify-reset:ip:{ip}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:verify-reset:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 1800)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    _, error = _get_valid_password_reset_row(email, code)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"ok": True, "email": email})


@bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password") or ""
    if not email or not code or not new_password:
        return jsonify({"error": "email/code/new_password required"}), 400
    if not _is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400
    if not re.fullmatch(r"[0-9]{6}", code):
        return jsonify({"error": "invalid code"}), 400

    if current_app.config.get("RATE_LIMIT_ENABLED", True):
        ip = get_client_ip()
        ip_result = consume_rate_limit(
            f"auth:reset:ip:{ip}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_IP", 10)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS", 900)),
        )
        if not ip_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": ip_result.retry_after_seconds}), 429

        account_result = consume_rate_limit(
            f"auth:reset:acct:{subject_fingerprint(email)}",
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 1800)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    password_err = _validate_password(new_password, email=email, username="")
    if password_err:
        return jsonify({"error": password_err}), 400

    row, code_error = _get_valid_password_reset_row(email, code)
    if code_error:
        return jsonify({"error": code_error}), 400

    user = db.session.get(User, int(row.user_id))

    now = _utcnow_seconds()
    user.password_hash = hash_password(new_password)
    row.used_at = now
    row.code_hash = None
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    if user.is_disabled:
        return jsonify({"error": "account disabled"}), 403
    return jsonify(_auth_user(user))

