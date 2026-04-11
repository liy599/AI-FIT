from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from flask import current_app

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # pragma: no cover - optional dependency fallback
    Fernet = None  # type: ignore[assignment]
    InvalidToken = Exception  # type: ignore[assignment]


_ENC_PREFIX = "enc:v1:"
_SECURE_JSON_MARKER = "_secure_payload"


def _get_key_bytes() -> bytes:
    configured = (current_app.config.get("DATA_ENCRYPTION_KEY") or "").strip()
    if configured:
        try:
            key = configured.encode("utf-8")
            if len(base64.urlsafe_b64decode(key)) == 32:
                return key
        except Exception:
            pass

    # Fallback: derive an app-local key from SECRET_KEY so production can encrypt
    # without extra setup. Teams can override with DATA_ENCRYPTION_KEY.
    secret = (current_app.config.get("SECRET_KEY") or "").encode("utf-8")
    digest = hashlib.sha256(secret + b":data-encryption:v1").digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet | None:
    if Fernet is None:
        return None
    return Fernet(_get_key_bytes())


def encrypt_text(value: str | None) -> str | None:
    if value is None:
        return None
    f = _get_fernet()
    if f is None:
        return value
    token = f.encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{_ENC_PREFIX}{token}"


def decrypt_text(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.startswith(_ENC_PREFIX):
        return value
    f = _get_fernet()
    if f is None:
        return None
    token = value[len(_ENC_PREFIX) :]
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError):
        return None


def mask_email(email: str | None) -> str | None:
    if not email:
        return None
    text = email.strip().lower()
    if "@" not in text:
        return "***"
    local, domain = text.split("@", 1)
    if not local:
        masked_local = "***"
    elif len(local) == 1:
        masked_local = f"{local[0]}***"
    else:
        masked_local = f"{local[0]}***{local[-1]}"
    return f"{masked_local}@{domain}"


def _sanitize_json(value: Any) -> Any:
    if isinstance(value, dict):
        blocked = {"email", "phone", "address", "id_number", "real_name", "full_name"}
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            if str(key).lower() in blocked:
                continue
            sanitized[key] = _sanitize_json(item)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    return value


def protect_json_payload(value: dict | None) -> dict | None:
    if value is None:
        return None
    cleaned = _sanitize_json(value)
    serialized = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
    encrypted = encrypt_text(serialized)
    if encrypted is None:
        return None
    if encrypted == serialized:
        return cleaned
    return {_SECURE_JSON_MARKER: encrypted}


def reveal_json_payload(value: dict | None) -> dict | None:
    if value is None:
        return None
    if _SECURE_JSON_MARKER not in value:
        return value
    encrypted = value.get(_SECURE_JSON_MARKER)
    if not isinstance(encrypted, str):
        return {}
    raw = decrypt_text(encrypted)
    if not raw:
        return {}
    try:
        loaded = json.loads(raw)
        return loaded if isinstance(loaded, dict) else {}
    except Exception:
        return {}
