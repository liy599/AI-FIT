from __future__ import annotations

import os
import uuid
from typing import Optional

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


ALLOWED_PUBLIC_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
PUBLIC_IMAGE_VARIANTS = {
    "cover": 960,
    "list": 480,
    "detail": 1280,
}

try:
    from PIL import Image, ImageOps
except Exception:  # pragma: no cover - deployments install Pillow via requirements.
    Image = None
    ImageOps = None


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
    saved_path = os.path.join(folder, name)
    file.save(saved_path)
    _generate_public_image_variants(saved_path, folder, stem)
    return f"/uploads/{subdir}/{name}"


def _generate_public_image_variants(source_path: str, folder: str, stem: str) -> None:
    if Image is None or ImageOps is None:
        return
    try:
        with Image.open(source_path) as raw:
            image = ImageOps.exif_transpose(raw)
            for variant, max_side in PUBLIC_IMAGE_VARIANTS.items():
                output = image.copy()
                output.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                if output.mode not in {"RGB", "RGBA"}:
                    output = output.convert("RGB")
                variant_path = os.path.join(folder, f"{stem}_{variant}.webp")
                output.save(variant_path, "WEBP", quality=82, method=6)
    except Exception:
        return
