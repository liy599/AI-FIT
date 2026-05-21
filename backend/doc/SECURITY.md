# Backend Security Baseline

## 1. Identity and Access
- JWT-protected endpoints enforce user scoping on all pose/video/training reads and writes.
- Admin operations are gated by `User.is_admin` and disabled accounts are blocked.
- Private training reports are owner-scoped; the admin console does not browse training report content.

## 2. Data Protection
- Private account, profile, workout, and training fields are encrypted at rest.
- Queryable private values use keyed hashes, for example `email_hash`, instead of plaintext lookups.
- Training report JSON, including required video snapshots, is stored as a single encrypted report payload.
- Production requires a dedicated Fernet `DATA_ENCRYPTION_KEY`; encryption failure must fail closed.
- Upload access uses short-lived signed token URLs.

## 3. Abuse Prevention
- Endpoint-level rate limits for auth flows.
- Input validation on required fields, types, and bounds.

## 4. Media Privacy
- Local inference remains default flow to keep camera/video on-device.
- Original training videos are analyzed in the browser and are not uploaded or stored by the backend.
- Required report snapshots are saved only inside encrypted training reports.

## 5. Deployment Hardening Checklist
- Use HTTPS for public production when browser camera APIs are required; HTTP-only VM deployment is a temporary/simple mode.
- Keep `http.sslverify` enabled in git/system config.
- Store secrets in vault/CI secret manager, not repo.
- Enforce non-default `SECRET_KEY` and `JWT_SECRET_KEY` in production.
- Enforce a valid `DATA_ENCRYPTION_KEY` in production.
- Enforce `PASSWORD_RESET_DEBUG_RETURN_LINK=0` in production.
- Enable database backups and least-privilege DB user.
- Use Redis-backed distributed rate limiting via `REDIS_URL`.
- Add centralized logs and anomaly alerts.
