from __future__ import annotations

import hashlib
import math
import threading
import time
from collections import deque
from dataclasses import dataclass

from flask import current_app, has_app_context, request

try:
    from redis import Redis
except Exception:  # pragma: no cover
    Redis = None  # type: ignore[assignment]

_LOCK = threading.Lock()
_BUCKETS: dict[str, deque[float]] = {}
_REDIS_CLIENT = None
_REDIS_LOCK = threading.Lock()


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


def reset_rate_limits() -> None:
    with _LOCK:
        _BUCKETS.clear()
    client = _get_redis_client()
    if client is not None:
        try:
            client.flushdb()
        except Exception:
            pass


def _get_redis_client():
    global _REDIS_CLIENT
    if Redis is None:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    redis_url = str(current_app.config.get("REDIS_URL", "")).strip() if has_app_context() else ""
    if not redis_url:
        return None
    with _REDIS_LOCK:
        if _REDIS_CLIENT is not None:
            return _REDIS_CLIENT
        try:
            client = Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            _REDIS_CLIENT = client
            return _REDIS_CLIENT
        except Exception:
            return None


def _consume_rate_limit_redis(bucket: str, *, limit: int, window_seconds: int) -> RateLimitResult | None:
    client = _get_redis_client()
    if client is None:
        return None
    key = f"rl:{bucket}"
    now_ms = int(time.time() * 1000)
    window_ms = window_seconds * 1000
    min_score = now_ms - window_ms
    try:
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, "-inf", min_score)
        pipe.zcard(key)
        _, current_count = pipe.execute()
        if int(current_count) >= limit:
            oldest = client.zrange(key, 0, 0, withscores=True)
            retry_after = 1
            if oldest:
                oldest_ms = int(oldest[0][1])
                retry_after = max(1, int(math.ceil((window_ms - (now_ms - oldest_ms)) / 1000)))
            return RateLimitResult(allowed=False, retry_after_seconds=retry_after)
        member = f"{now_ms}:{hashlib.sha1(f'{bucket}:{now_ms}'.encode('utf-8')).hexdigest()[:8]}"
        pipe = client.pipeline()
        pipe.zadd(key, {member: now_ms})
        pipe.expire(key, window_seconds + 2)
        pipe.execute()
        return RateLimitResult(allowed=True, retry_after_seconds=0)
    except Exception:
        return None


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

    redis_result = _consume_rate_limit_redis(bucket, limit=limit, window_seconds=window_seconds)
    if redis_result is not None:
        return redis_result

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
