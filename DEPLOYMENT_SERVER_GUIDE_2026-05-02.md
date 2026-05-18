# AI-FIT VM HTTP Deployment Guide

Last updated: 2026-05-18

This guide deploys the current `main` branch to a VM with Docker Compose. The public entry is plain HTTP:

- Frontend/API origin: `http://137.43.49.50/`
- Public port: `80`
- No Caddy, Certbot, HTTPS redirect, or certificate renewal workflow

## Important Limitation

Browser camera APIs require a secure context. With public HTTP, live camera permission may be blocked by browsers. The HTTP-only deployment is suitable for API, account, blog, food, and non-camera checks. Restore an HTTPS reverse proxy later if live camera mode must work on the public IP.

## Prerequisites

- Docker installed
- Legacy `docker-compose` command available
- Firewall allows port `80`
- Repository cloned on the VM

## Prepare Environment Files

Create root `.env` next to `docker-compose.yml`:

```env
DB_PORT=5432
POSTGRES_USER=app_user
POSTGRES_PASSWORD=replace-with-a-strong-password
POSTGRES_DB=aifitguard
HTTP_PORT=80
VITE_API_BASE=/api
```

Create `backend/.env`:

```env
APP_ENV=production
DB_AUTO_INIT=0
SECRET_KEY=replace-with-at-least-32-random-characters
JWT_SECRET_KEY=replace-with-at-least-32-random-characters
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql+psycopg://app_user:replace-with-a-strong-password@db:5432/aifitguard
FRONTEND_BASE_URL=http://137.43.49.50
CORS_ORIGINS=http://137.43.49.50
ADMIN_EMAIL=admin@example.com
PASSWORD_RESET_DEBUG_RETURN_LINK=0
UPLOAD_PUBLIC_PREFIXES=avatars,blog_covers
UPLOAD_SIGNED_URL_TTL_SECONDS=300
RATE_LIMIT_ENABLED=1
STEPFUN_API_URL=https://api.stepfun.com/v1/chat/completions
STEPFUN_API_KEY=
STEPFUN_MODEL=step-1v-8k
AI_REPORT_API_URL=https://api.stepfun.com/v1/chat/completions
AI_REPORT_API_KEY=
AI_REPORT_MODEL=step-1v-8k
AI_REPORT_TIMEOUT_SECONDS=20
```

Use real secret values before starting production.

## First Deployment

```bash
cd ~/AI-FIT

git fetch origin main
git checkout main
git pull --ff-only origin main

docker-compose build backend web
docker-compose up -d db redis

docker-compose run --rm backend flask --app run.py db upgrade
docker-compose run --rm backend python seed.py

docker-compose up -d db redis backend web
```

## Update Deployment

```bash
cd ~/AI-FIT

git fetch origin main
git checkout main
git pull --ff-only origin main

docker-compose build backend web
docker-compose up -d db redis
docker-compose run --rm backend flask --app run.py db upgrade
docker-compose run --rm backend python seed.py
docker-compose up -d db redis backend web
```

## Checks

```bash
docker-compose ps
curl -fsS http://137.43.49.50/api/health
```

Expected response:

```json
{"ok":true}
```

The `web` service should expose `0.0.0.0:80->80/tcp`.

## Troubleshooting

### Port 80 Is Already Allocated

Find the owner:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep ':80' || true
sudo ss -ltnp | grep ':80' || true
```

Stop the old container or host service that owns port `80`, then run:

```bash
docker-compose up -d web
```

### `web` Exits With `host not found in upstream "backend"`

Recreate the Compose network and containers without deleting volumes:

```bash
docker-compose down --remove-orphans
docker-compose up -d db redis
docker-compose run --rm backend flask --app run.py db upgrade
docker-compose up -d backend web
```

### CORS Errors

Make sure `backend/.env` uses the exact HTTP origin:

```env
FRONTEND_BASE_URL=http://137.43.49.50
CORS_ORIGINS=http://137.43.49.50
```

### Production Secret Guard Fails

Production startup requires:

- `APP_ENV=production`
- `DB_AUTO_INIT=0`
- non-default `SECRET_KEY`
- non-default `JWT_SECRET_KEY`
- explicit `CORS_ORIGINS`
- `REDIS_URL=redis://redis:6379/0`
