from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from ..extensions import db
from ..models import User
from ..utils.rate_limit import consume_rate_limit, get_client_ip, subject_fingerprint
from ..utils.security import hash_password, verify_password

bp = Blueprint("auth", __name__)


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="password-reset")

def _auth_user(u: User):
    return {"id": u.id, "email": u.email, "username": u.username, "avatar_url": u.avatar_url}


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not email or not username or not password:
        return jsonify({"error": "email/username/password required"}), 400

    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "email already exists"}), 409
    if User.query.filter_by(username=username).first() is not None:
        return jsonify({"error": "username already exists"}), 409

    user = User(email=email, username=username, password_hash=hash_password(password))
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))
    return jsonify({"access_token": access_token, "user": _auth_user(user)})


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

    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))
    return jsonify({"access_token": access_token, "user": _auth_user(user)})


@bp.post("/logout")
@jwt_required()
def logout():
    return jsonify({"ok": True})


@bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400

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
            limit=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_PER_ACCOUNT", 5)),
            window_seconds=int(current_app.config.get("AUTH_FORGOT_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 1800)),
        )
        if not account_result.allowed:
            return jsonify({"error": "too many requests", "retry_after": account_result.retry_after_seconds}), 429

    user = User.query.filter_by(email=email).first()
    if user is None:
        return jsonify({"error": "email not found"}), 404

    token = _serializer().dumps({"user_id": user.id, "email": user.email})
    reset_link = f'{current_app.config["FRONTEND_BASE_URL"].rstrip("/")}/reset-password?token={token}'
    return jsonify({"ok": True, "reset_link": reset_link})


@bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""
    if not token or not new_password:
        return jsonify({"error": "token/new_password required"}), 400

    try:
        payload = _serializer().loads(token, max_age=current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 60 * 60))
    except SignatureExpired:
        return jsonify({"error": "token expired"}), 400
    except BadSignature:
        return jsonify({"error": "invalid token"}), 400

    user = db.session.get(User, int(payload["user_id"]))
    if user is None or user.email != payload.get("email"):
        return jsonify({"error": "invalid token"}), 400

    user.password_hash = hash_password(new_password)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(_auth_user(user))

