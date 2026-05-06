# AI-FIT VM IP HTTPS Deployment Guide

Last updated: 2026-05-06
Project root: `E:\trae_project\AI-FIT`

## 1. Deployment Target

This guide targets VM deployment at:

- Frontend/API origin: `https://137.43.49.50/`
- No domain proxy

It keeps:
- privacy-first defaults (local MoveNet inference)
- strong secret management
- explicit database migration workflow
- hardened compose startup checks

### Camera permission

Browser camera APIs require a secure context. This deployment uses a publicly trusted IP address certificate for `https://137.43.49.50/` so the browser can show the camera permission prompt without using the old domain proxy.

## 2. Prerequisites

- Docker + Docker Compose plugin installed
- PostgreSQL and Redis reachable (or compose local services)
- Firewall allows 80 and 443
- Certbot image supports Let's Encrypt IP address certificates. Use `certbot/certbot:latest`, or any Certbot version that supports `--ip-address` and `--preferred-profile shortlived`.

## 3. Prepare Environment Files

### 3.1 Backend runtime env

1. Copy template:

```bash
cp backend/.env.example backend/.env
```

2. Edit `backend/.env` and replace placeholders:
- `SECRET_KEY` (>=32 chars)
- `JWT_SECRET_KEY` (>=32 chars)
- `DATABASE_URL`
- `FRONTEND_BASE_URL=https://137.43.49.50`
- `CORS_ORIGINS=https://137.43.49.50`
- `ADMIN_EMAIL`
- `STEPFUN_API_KEY` / `AI_REPORT_API_KEY` if AI features enabled

3. Keep privacy-first defaults unless needed:
- `POSE_SERVER_INFERENCE_ENABLED=0`
- `POSE_REPORT_AI_ENABLED=0` (if you do not need cloud AI)

### 3.2 Root compose env

Create root `.env` (same folder as `docker-compose.yml`) to provide compose interpolation values:

```env
DB_PORT=5432
POSTGRES_USER=app_user
POSTGRES_PASSWORD=strongpass
POSTGRES_DB=aifitguard

HTTP_PORT=80
HTTPS_PORT=443

ORIGIN_IP=137.43.49.50
ACME_EMAIL=admin@example.com
VITE_API_BASE=/api
```

## 4. Database Migration Workflow

Do not rely on app startup table creation in production.

Run migrations explicitly:

```bash
cd backend
flask --app run.py db upgrade
cd ..
```

If migration repo is not initialized yet:

```bash
cd backend
flask --app run.py db init
flask --app run.py db migrate -m "initial schema"
flask --app run.py db upgrade
cd ..
```

## 5. First-Time IP HTTPS Bootstrap

Use the bootstrap Caddyfile first. It serves HTTP and the ACME challenge path so Certbot can request the trusted IP certificate. After the certificate is issued, the script restarts Caddy with the normal HTTPS Caddyfile.

From project root on the VM:

```bash
ACME_EMAIL=admin@example.com ORIGIN_IP=137.43.49.50 sh scripts/vm-bootstrap-ip-https.sh
```

Expected result:

- Certbot stores the certificate in the `letsencrypt` Docker volume.
- Caddy serves `https://137.43.49.50/`.
- `http://137.43.49.50/` redirects to HTTPS, except ACME challenge files.

## 6. Certificate Renewal

IP address certificates are short-lived. Run renewal at least daily; every 4-12 hours is safer.

Manual renewal:

```bash
ORIGIN_IP=137.43.49.50 sh scripts/vm-renew-ip-cert.sh
```

Cron example:

```cron
17 */6 * * * cd /path/to/AI-FIT && ORIGIN_IP=137.43.49.50 sh scripts/vm-renew-ip-cert.sh >> /var/log/aifit-certbot.log 2>&1
```

## 7. Normal Start

Use this normal start command after the first certificate has already been issued:

```bash
docker compose up -d --build
```

## 8. Post-Deployment Checks

### 8.1 Health endpoint

```bash
curl -fsS https://137.43.49.50/api/health
```

Expected response:

```json
{"ok": true}
```

### 8.2 Security checks

- Confirm no default secrets in runtime env.
- Confirm `APP_ENV=production` and `DB_AUTO_INIT=0`.
- Confirm CORS only allows `https://137.43.49.50`.
- Confirm the browser shows a valid certificate for `https://137.43.49.50/`.

### 8.3 Privacy checks

- Confirm local MoveNet inference stays in-browser and no server upload is enabled by default.
- Confirm live camera mode can trigger the browser permission prompt on `https://137.43.49.50/`.
- If enabling server inference, verify consent UX is visible before upload.

## 9. Operations and Rotation

- Rotate all secrets periodically.
- If a key was ever committed/exposed, rotate immediately.
- Backup database regularly and test restore path.
- Monitor:
  - auth failures
  - rate-limit spikes
  - pose task failure ratio

## 10. Troubleshooting

### 10.1 Compose exits with SECRET_KEY/JWT_SECRET_KEY required

Cause: production hardening guard is working.
Fix: set real values in root `.env` or shell env before `docker compose up`.

### 10.2 502/stepfun_failed on recognition/report

Cause: AI key missing/invalid or provider unavailable.
Fix: check `STEPFUN_API_KEY`/`AI_REPORT_API_KEY`, or disable AI with `POSE_REPORT_AI_ENABLED=0`.

### 10.3 CORS error on frontend

Cause: `CORS_ORIGINS`/`FRONTEND_BASE_URL` mismatch.
Fix: set exact scheme+host used by frontend, for this VM normally `https://137.43.49.50`.

### 10.4 Camera permission does not appear on the IP site

Cause: the browser does not trust the certificate or the page was opened over HTTP.
Fix: open `https://137.43.49.50/`, confirm the certificate is valid, and confirm the site is not loaded through a mixed-content or captive-portal page.

### 10.5 Caddy fails before the certificate exists

Cause: the normal `Caddyfile` loads certificate files from `/etc/letsencrypt/live/137.43.49.50/`.
Fix: run `scripts/vm-bootstrap-ip-https.sh` first. It uses `deploy/Caddyfile.bootstrap` to complete ACME validation before switching to HTTPS.

### 10.6 TLS alert internal error on the IP address

Cause: Caddy could not present a certificate during the TLS handshake, often because the certificate files are missing, unreadable, or the server was still using an older host-specific `https://IP` site block.
Fix: use the current `:443` Caddyfile, confirm `/etc/letsencrypt/live/137.43.49.50/fullchain.pem` exists in the container, then restart Caddy.
