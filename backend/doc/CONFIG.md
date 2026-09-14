# Backend Configuration

## Database

- `DATABASE_URL`: SQLAlchemy connection URL. Local host development usually uses `postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard`.
- `DB_POOL_RECYCLE_SECONDS`: SQLAlchemy pool recycle interval. Default: `1800`.
- `DB_AUTO_INIT`: legacy compatibility flag. The application does not create production schema at runtime; schema must be managed by Alembic migrations. Production must set `DB_AUTO_INIT=0`.

Run migrations before starting or releasing the backend:

```powershell
flask --app run.py db upgrade
```

Check migration drift:

```powershell
flask --app run.py db check
flask --app run.py db current
flask --app run.py db heads
```

## Required Production Settings

- `APP_ENV=production`
- `SECRET_KEY`: at least 32 random characters.
- `JWT_SECRET_KEY`: at least 32 random characters.
- `DATA_ENCRYPTION_KEY`: Fernet key for private user data encryption.
- `DATABASE_URL`: production PostgreSQL URL.
- `CORS_ORIGINS`: explicit frontend origin list.
- `FRONTEND_BASE_URL`: public frontend origin.
- `REDIS_URL`: required for distributed rate limiting.
- `DB_AUTO_INIT=0`
- `PASSWORD_RESET_DEBUG_RETURN_LINK=0`
- `EMAIL_VERIFY_DEBUG_RETURN_LINK=0`

If `EMAIL_VERIFY_REQUIRED=1`, production must also configure:

- `SMTP_HOST`
- `SMTP_FROM`

## Local Development

Use `backend/.env.example` as a template. It intentionally contains only local defaults and placeholders. Do not put production secrets in example files.

`scripts/dev.ps1` creates a minimal local `.env` if one is missing, starts PostgreSQL/Redis through Docker Compose, runs `flask db upgrade`, and starts the backend.

## Private Data Encryption

Generate `DATA_ENCRYPTION_KEY` with:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Private account, profile, workout, and training fields are encrypted at rest. Lookup fields such as email and exercise type use keyed hashes for equality queries. Production refuses to start without `DATA_ENCRYPTION_KEY`, and encryption failures fail closed instead of storing plaintext.

## Email

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `SMTP_FROM`

For local development, use debug-return flags instead of real SMTP credentials.

## Uploads

- `UPLOAD_PUBLIC_PREFIXES`: comma-separated upload prefixes that can be served publicly, default `avatars,blog_covers`.
- `UPLOAD_SIGNED_URL_TTL_SECONDS`: signed upload URL TTL for non-public files.

## Food and Courses

Food catalog and meal records are available at `/api/foods` and `/api/meals`.
Meal records are authenticated and scoped to the current user. Courses and
course comments are available at `/api/courses` and require authentication.
Run the Alembic upgrade before first use so the food and course tables exist.

Image recognition is optional. Set `STEPFUN_API_URL`, `STEPFUN_API_KEY`, and
`STEPFUN_MODEL` to enable `/api/recognize`; when unset, the endpoint returns
`503` without accepting or storing an image.

## Rate Limits

- `RATE_LIMIT_ENABLED`
- `AUTH_LOGIN_*`
- `AUTH_FORGOT_*`
- `AUTH_EMAIL_REQUEST_*`
- `BLOG_CREATE_DAILY_LIMIT_PER_USER`

## Pose Policy

Pose policy values are read from environment variables and returned through `GET /api/pose/policy`. The frontend should consume this endpoint instead of hardcoding policy values in pages.
