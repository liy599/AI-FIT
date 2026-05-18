# Backend Security Baseline

## 1. Identity and Access
- JWT-protected endpoints enforce user scoping on all pose/video/training reads and writes.
- Admin operations are gated by `ADMIN_EMAIL` identity checks.

## 2. Data Protection
- Sensitive structured payloads use privacy helpers (`protect_json_payload` / `reveal_json_payload`).
- Contact email stored in feedback is masked for privacy-by-default.
- Upload access uses short-lived signed token URLs.

## 3. Abuse Prevention
- Endpoint-level rate limits for auth and feedback.
- Input validation on required fields, types, and bounds (for example feedback rating 1..5).

## 4. Media Privacy
- Local inference remains default flow to keep camera/video on-device.
- Server inference is opt-in and requires explicit consent marker.
- Cancel endpoint supports purging uploaded media payload.

## 5. Deployment Hardening Checklist
- Use HTTPS for public production when browser camera APIs are required; HTTP-only VM deployment is a temporary/simple mode.
- Keep `http.sslverify` enabled in git/system config.
- Store secrets in vault/CI secret manager, not repo.
- Enforce non-default `SECRET_KEY` and `JWT_SECRET_KEY` in production.
- Enforce `PASSWORD_RESET_DEBUG_RETURN_LINK=0` in production.
- Enforce non-empty `ADMIN_EMAIL` for admin-gated operations.
- Enable database backups and least-privilege DB user.
- Use Redis-backed distributed rate limiting via `REDIS_URL`.
- Add centralized logs and anomaly alerts.
