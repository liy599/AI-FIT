import base64
from datetime import datetime
import json

from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    items: list
    page: int
    page_size: int
    total: int

    @property
    def pages(self) -> int:
        if self.page_size <= 0:
            return 1
        return (self.total + self.page_size - 1) // self.page_size


def parse_pagination(args, default_page=1, default_page_size=12, max_page_size=50):
    try:
        page = int(args.get("page", default_page))
    except Exception:
        page = default_page
    try:
        page_size = int(args.get("page_size", default_page_size))
    except Exception:
        page_size = default_page_size

    page = max(1, page)
    page_size = max(1, min(max_page_size, page_size))
    return page, page_size


def encode_cursor(values: dict) -> str:
    raw = json.dumps(values, separators=(",", ":"), sort_keys=True)
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(value: str | None) -> dict | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        padded = text + ("=" * (-len(text) % 4))
        loaded = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        return None
    return loaded if isinstance(loaded, dict) else None


def cursor_datetime(value) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None

