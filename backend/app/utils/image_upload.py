from __future__ import annotations

import os
import uuid
from typing import Optional

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


ALLOWED_PUBLIC_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def detect_public_image_extension(file: FileStorage) -> Optional[str]:
    filename = secure_filename(file.filename or "")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mimetype = (getattr(file, "mimetype", "") or "").lower()

    if ext not in ALLOWED_PUBLIC_IMAGE_EXTENSIONS:
        if mimetype in {"image/jpeg", "image/jpg"}:
            ext = "jpg"
        elif mimetype == "image/png":
            ext = "png"
        elif mimetype == "image/webp":
            ext = "webp"
        else:
            ext = sniff_public_image_extension(file) or ""

    if ext == "jpeg":
        ext = "jpg"

    return ext if ext in {"png", "jpg", "webp"} else None


def sniff_public_image_extension(file: FileStorage) -> Optional[str]:
    try:
        head = file.stream.read(16)
        file.stream.seek(0)
    except Exception:
        return None

    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def save_public_image_upload(file: FileStorage, subdir: str, *, filename_prefix: str | None = None) -> str:
    ext = detect_public_image_extension(file)
    if ext is None:
        raise ValueError("unsupported file type")

    upload_root = current_app.config["UPLOAD_FOLDER"]
    folder = os.path.join(upload_root, subdir)
    os.makedirs(folder, exist_ok=True)

    stem = f"{filename_prefix}_{uuid.uuid4().hex}" if filename_prefix else uuid.uuid4().hex
    name = f"{stem}.{ext}"
    file.save(os.path.join(folder, name))
    return f"/uploads/{subdir}/{name}"
