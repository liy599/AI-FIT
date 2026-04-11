from __future__ import annotations

import hashlib
import math
import threading
import time
from collections import deque
from dataclasses import dataclass

from flask import request

_LOCK = threading.Lock()
_BUCKETS: dict[str, deque[float]] = {}


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


def reset_rate_limits() -> None:
    with _LOCK:
        _BUCKETS.clear()


def get_client_ip() -> str:
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = (request.headers.get("X-Real-IP") or "").strip()
    if real_ip:
        return real_ip
    return (request.remote_addr or "unknown").strip() or "unknown"


def subject_fingerprint(value: str | None) -> str:
    text = (value or "").strip().lower()
    if not text:
        return "none"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def consume_rate_limit(bucket: str, *, limit: int, window_seconds: int) -> RateLimitResult:
    if limit <= 0 or window_seconds <= 0:
        return RateLimitResult(allowed=True, retry_after_seconds=0)

    now = time.time()
    cutoff = now - window_seconds
    with _LOCK:
        q = _BUCKETS.get(bucket)
        if q is None:
            q = deque()
            _BUCKETS[bucket] = q

        while q and q[0] <= cutoff:
            q.popleft()

        if len(q) >= limit:
            retry_after = max(1, int(math.ceil(window_seconds - (now - q[0]))))
            return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

        q.append(now)
        return RateLimitResult(allowed=True, retry_after_seconds=0)

