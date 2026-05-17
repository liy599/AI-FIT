from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from flask import current_app


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
    msg["From"] = sender
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


def send_password_reset_email(*, to_email: str, reset_link: str) -> None:
    subject = str(current_app.config.get("PASSWORD_RESET_EMAIL_SUBJECT") or "Reset your password")
    body = "\n".join(
        [
            "We received a request to reset your password.",
            "",
            "Open this link to set a new password:",
            reset_link,
            "",
            "If you did not request a password reset, you can ignore this email.",
        ]
    )
    send_text_email(to_email=to_email, subject=subject, body=body)
