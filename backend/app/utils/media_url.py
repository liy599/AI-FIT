from __future__ import annotations

import os
from typing import Iterable

from flask import current_app, g, has_request_context

from .upload_access import normalize_upload_path


def _relative_upload_path(url: str) -> str | None:
    if url.startswith("/api/uploads/"):
        return url.removeprefix("/api/uploads/")
    if url.startswith("/uploads/"):
        return url.removeprefix("/uploads/")
    if url.startswith("api/uploads/"):
        return url.removeprefix("api/uploads/")
    if url.startswith("uploads/"):
        return url.removeprefix("uploads/")
    return None


def _upload_file_exists(relative_path: str) -> bool:
    upload_root = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
    normalized = normalize_upload_path(relative_path)
    candidate = os.path.realpath(os.path.join(upload_root, normalized))
    try:
        if os.path.commonpath([upload_root, candidate]) != upload_root:
            return False
    except ValueError:
        return False
    return os.path.isfile(candidate)


def public_media_url_or_none(url: str | None) -> str | None:
    text = (url or "").strip()
    if not text:
        return None
    cache = getattr(g, "_public_media_url_cache", None) if has_request_context() else None
    if cache is None:
        cache = {}
        if has_request_context():
            g._public_media_url_cache = cache
    if text in cache:
        return cache[text]

    if text.startswith("http://") or text.startswith("https://") or text.startswith("data:") or text.startswith("blob:"):
        cache[text] = text
        return text

    relative_upload = _relative_upload_path(text)
    if relative_upload is None:
        cache[text] = text
        return text
    result = text if _upload_file_exists(relative_upload) else None
    cache[text] = result
    return result


def public_media_variant_url_or_none(url: str | None, variant: str) -> str | None:
    text = (url or "").strip()
    if not text or not variant:
        return public_media_url_or_none(text)
    relative_upload = _relative_upload_path(text)
    if relative_upload is None:
        return public_media_url_or_none(text)

    folder, filename = os.path.split(relative_upload)
    stem, _ext = os.path.splitext(filename)
    variant_url = f"/uploads/{folder}/{stem}_{variant}.webp" if folder else f"/uploads/{stem}_{variant}.webp"
    return public_media_url_or_none(variant_url) or public_media_url_or_none(text)


def available_public_media_urls(urls: Iterable[str]) -> list[str]:
    return [url for url in (public_media_url_or_none(item) for item in urls) if url]
