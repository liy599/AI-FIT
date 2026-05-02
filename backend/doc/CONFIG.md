# Backend Config

## Required Security Config
- `APP_ENV`: set to `production` in production.
- `DB_AUTO_INIT`: must be `0` in production (use migrations). In non-production, this only controls startup seed behavior.
- `SECRET_KEY`: Flask signing secret.
- `JWT_SECRET_KEY`: JWT signing secret.
- `DATABASE_URL`: SQLAlchemy connection string.
- `FRONTEND_BASE_URL`: canonical frontend origin.
- `ADMIN_EMAIL`: admin identity for privileged APIs.
- `REDIS_URL`: required in production for distributed rate limiting.

## Pose Policy Config
- `POSE_POLICY_LIVE_TARGET_FPS`
- `POSE_POLICY_LIVE_SESSION_LIMIT_SECONDS`
- `POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES`
- `POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS`
- `POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS`
- `POSE_POLICY_OFFLINE_ALLOWED_ACTIONS`

All are consumed by backend and returned through `GET /api/pose/policy`, so frontend behavior can be controlled centrally without hardcoded constants.

## Optional Features
- `POSE_SERVER_INFERENCE_ENABLED`: enable server-side inference entrypoints.
- `POSE_SERVER_INFERENCE_POLL_INTERVAL_SECONDS`: worker poll interval.
- `POSE_REPORT_AI_*` / `AI_REPORT_*` / `STEPFUN_*`: AI enhancement integration.

## Rate Limit Controls
- `RATE_LIMIT_ENABLED`
- `AUTH_LOGIN_*`
- `AUTH_FORGOT_*`
- `FEEDBACK_*`

## Operational Rule
- `.env.example` must not contain real production keys.
- Rotate keys immediately if secrets were ever committed.

## Production Deployment Practice
- Do not use `.env.example` directly as runtime config.
- Create a real runtime env file on server (for example `/etc/aifit/backend.env`) or inject through your container/orchestrator secret manager.
- Use strong secrets:
  - `SECRET_KEY`: at least 32 random bytes.
  - `JWT_SECRET_KEY`: at least 32 random bytes.
  - `DATA_ENCRYPTION_KEY`: use a Fernet-compatible key.
- Set production values explicitly:
  - `APP_ENV=production`
  - `DB_AUTO_INIT=0`
  - `FRONTEND_BASE_URL=https://your-frontend-domain`
  - `CORS_ORIGINS=https://your-frontend-domain`
  - `DATABASE_URL=postgresql+psycopg://<user>:<pass>@<db-host>:5432/<db-name>`
  - `REDIS_URL=redis://<redis-host>:6379/0`
  - `POSE_SERVER_INFERENCE_ENABLED=0` (keep privacy-first local mode by default)
- If server inference must be enabled:
  - set `POSE_SERVER_INFERENCE_ENABLED=1`
  - keep explicit consent UX enabled on frontend
  - define retention/cleanup policy in operations schedule

## Migration Workflow
- Install dependencies and set env first.
- Initialize migration repository once:
  - `flask --app run.py db init`
- Create migration on model changes:
  - `flask --app run.py db migrate -m "describe change"`
- Apply migrations:
  - `flask --app run.py db upgrade`
- Production startup should run `db upgrade` before starting application process.
- Application runtime no longer auto-creates tables; schema must be managed by migrations.
