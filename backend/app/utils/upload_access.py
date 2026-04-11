from __future__ import annotations

import os

from .privacy import decrypt_text
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from flask import current_app


def normalize_upload_path(path: str) -> str:
    return (path or "").replace("\\", "/").lstrip("/")


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="upload-access")


def build_upload_access_token(path: str) -> str:
    normalized = normalize_upload_path(path)
    return _serializer().dumps({"path": normalized})


def verify_upload_access_token(token: str, path: str, *, max_age: int) -> bool:
    if not token:
        return False
    normalized = normalize_upload_path(path)
    try:
        payload = _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False
    return isinstance(payload, dict) and payload.get("path") == normalized


def resolve_upload_file_path(stored_path: str) -> str | None:
    decoded = decrypt_text(stored_path) or stored_path
    upload_root = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
    if os.path.isabs(decoded):
        candidate = os.path.realpath(decoded)
    else:
        candidate = os.path.realpath(os.path.join(upload_root, decoded))
    if not candidate.startswith(upload_root):
        return None
    return candidate
