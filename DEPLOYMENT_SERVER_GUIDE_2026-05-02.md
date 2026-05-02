# AI-FIT Server Deployment Guide

Last updated: 2026-05-02
Project root: `E:\trae_project\AI-FIT`

## 1. Deployment Target

This guide targets production deployment with:
- privacy-first defaults (local MoveNet inference)
- strong secret management
- explicit database migration workflow
- hardened compose startup checks

## 2. Prerequisites

- Docker + Docker Compose plugin installed
- Public domain prepared (recommended)
- PostgreSQL and Redis reachable (or compose local services)
- Firewall allows 80/443

## 3. Prepare Environment Files

### 3.1 Backend runtime env

1. Copy template:

```bash
cp backend/.env.production.example backend/.env
```

2. Edit `backend/.env` and replace placeholders:
- `SECRET_KEY` (>=32 chars)
- `JWT_SECRET_KEY` (>=32 chars)
- `DATABASE_URL`
- `FRONTEND_BASE_URL`
- `CORS_ORIGINS`
- `ADMIN_EMAIL`
- `STEPFUN_API_KEY` / `AI_REPORT_API_KEY` if AI features enabled

3. Keep privacy-first defaults unless needed:
- `POSE_SERVER_INFERENCE_ENABLED=0`
- `POSE_REPORT_AI_ENABLED=0` (if you do not need cloud AI)

### 3.2 Root compose env (required for production compose startup)

Create root `.env` (same folder as `docker-compose.yml`) to provide compose interpolation values:

```env
APP_ENV=production
DB_AUTO_INIT=0
SECRET_KEY=replace-with-strong-secret
JWT_SECRET_KEY=replace-with-strong-jwt-secret
DATABASE_URL=postgresql+psycopg://app_user:strongpass@db:5432/aifitguard
FRONTEND_BASE_URL=https://your-domain
CORS_ORIGINS=https://your-domain
ADMIN_EMAIL=admin@your-domain
PASSWORD_RESET_DEBUG_RETURN_LINK=0
SITE_ADDRESS=your-domain
REDIS_URL=redis://redis:6379/0
```

## 4. Database Migration Workflow (Production)

Do not rely on app startup table creation in production.

Run migrations explicitly:

```bash
cd backend
flask --app run.py db upgrade
cd ..
```

If migration repo is not initialized yet (first-time setup):

```bash
cd backend
flask --app run.py db init
flask --app run.py db migrate -m "initial schema"
flask --app run.py db upgrade
cd ..
```

## 5. Start Services

From project root:

```bash
docker compose up -d --build
```

## 6. Post-Deployment Checks

### 6.1 Health endpoint

```bash
curl -fsS https://your-domain/api/health
```

Expected response:

```json
{"ok": true}
```

### 6.2 Security checks

- Confirm no default secrets in runtime env.
- Confirm `APP_ENV=production` and `DB_AUTO_INIT=0`.
- Confirm HTTPS certificate issued and valid.
- Confirm CORS only allows your frontend domain.

### 6.3 Privacy checks

- Confirm local mode works with camera and no server upload by default.
- If enabling server inference, verify consent UX is visible before upload.

## 7. Operations and Rotation

- Rotate all secrets periodically.
- If a key was ever committed/exposed, rotate immediately.
- Backup database regularly and test restore path.
- Monitor:
  - auth failures
  - rate-limit spikes
  - pose task failure ratio

## 8. Troubleshooting

### 8.1 Compose exits with SECRET_KEY/JWT_SECRET_KEY required

Cause: production hardening guard is working.
Fix: set real values in root `.env` or shell env before `docker compose up`.

### 8.2 502/stepfun_failed on recognition/report

Cause: AI key missing/invalid or provider unavailable.
Fix: check `STEPFUN_API_KEY`/`AI_REPORT_API_KEY`, or disable AI with `POSE_REPORT_AI_ENABLED=0`.

### 8.3 CORS error on frontend

Cause: `CORS_ORIGINS`/`FRONTEND_BASE_URL` mismatch.
Fix: set exact scheme+domain used by frontend.
