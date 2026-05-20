from __future__ import annotations

from flask import request

from ..extensions import db
from ..models import AuditLog
from .privacy import privacy_hash, protect_json_payload
from .rate_limit import get_client_ip


def record_audit(
    *,
    actor_user_id: int | None,
    action: str,
    target_type: str,
    target_id: int | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        ip = get_client_ip() if request else ""
    except Exception:
        ip = ""
    row = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        ip_hash=privacy_hash(ip) if ip else None,
        metadata_json=protect_json_payload(metadata) if metadata else None,
    )
    db.session.add(row)
