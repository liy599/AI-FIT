from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from flask import current_app


def _format_ttl(ttl_seconds: int) -> str:
    if ttl_seconds <= 0:
        return "a short time"
    if ttl_seconds % 3600 == 0:
        hours = ttl_seconds // 3600
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    if ttl_seconds % 60 == 0:
        minutes = ttl_seconds // 60
        return f"{minutes} minute" if minutes == 1 else f"{minutes} minutes"
    return f"{ttl_seconds} seconds"


def is_email_delivery_configured() -> bool:
    cfg = current_app.config
    host = str(cfg.get("SMTP_HOST") or "").strip()
    sender = str(cfg.get("SMTP_FROM") or "").strip()
    return bool(host and sender)


def send_text_email(*, to_email: str, subject: str, body: str) -> None:
    cfg = current_app.config
    host = str(cfg.get("SMTP_HOST") or "").strip()
    port = int(cfg.get("SMTP_PORT") or 0)
    username = str(cfg.get("SMTP_USERNAME") or "").strip() or None
    password = str(cfg.get("SMTP_PASSWORD") or "").strip() or None
    use_tls = bool(cfg.get("SMTP_USE_TLS", True))
    use_ssl = bool(cfg.get("SMTP_USE_SSL", False))
    sender = str(cfg.get("SMTP_FROM") or "").strip()

    if not host or not sender:
        raise RuntimeError("email delivery is not configured")
    if port <= 0:
        raise RuntimeError("invalid SMTP_PORT")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender if "<" in sender else f"AI Fit Guard <{sender}>"
    msg["To"] = to_email
    msg.set_content(body)

    context = ssl.create_default_context()
    if use_ssl:
        server = smtplib.SMTP_SSL(host=host, port=port, context=context, timeout=15)
    else:
        server = smtplib.SMTP(host=host, port=port, timeout=15)

    with server:
        if (not use_ssl) and use_tls:
            server.starttls(context=context)
        if username and password:
            server.login(username, password)
        server.send_message(msg)


def send_password_reset_email(*, to_email: str, reset_code: str) -> None:
    ttl_seconds = int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 60 * 60))
    ttl = _format_ttl(ttl_seconds)
    subject = str(current_app.config.get("PASSWORD_RESET_EMAIL_SUBJECT") or "[AI Fit Guard] Password reset code")
    site = str(current_app.config.get("FRONTEND_BASE_URL") or "").strip()
    body_lines = [
        "Hello,",
        "",
        "We received a request to reset the password for your AI Fit Guard account.",
        "",
        "Your password reset code is:",
        reset_code,
        "",
        f"This code will expire in {ttl}.",
    ]
    if site:
        body_lines.extend(["", f"Website: {site}"])
    body_lines.extend(
        [
            "",
            "If you did not request this, you can safely ignore this email.",
            "",
            "AI Fit Guard",
        ]
    )
    body = "\n".join(body_lines)
    send_text_email(to_email=to_email, subject=subject, body=body)


def send_email_verification_email(*, to_email: str, verification_code: str) -> None:
    ttl_seconds = int(current_app.config.get("EMAIL_VERIFY_TOKEN_TTL_SECONDS", 60 * 60))
    ttl = _format_ttl(ttl_seconds)
    subject = str(current_app.config.get("EMAIL_VERIFY_EMAIL_SUBJECT") or "[AI Fit Guard] Email verification code")
    site = str(current_app.config.get("FRONTEND_BASE_URL") or "").strip()
    body_lines = [
        "Hello,",
        "",
        "We received a request to verify this email address for your AI Fit Guard account.",
        "",
        "Your email verification code is:",
        verification_code,
        "",
        f"This code will expire in {ttl}.",
    ]
    if site:
        body_lines.extend(["", f"Website: {site}"])
    body_lines.extend(
        [
            "",
            "If you did not request this, you can safely ignore this email.",
            "",
            "AI Fit Guard",
        ]
    )
    body = "\n".join(body_lines)
    send_text_email(to_email=to_email, subject=subject, body=body)
