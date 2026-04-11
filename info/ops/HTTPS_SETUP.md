# HTTPS Setup (Docker Compose)

This project now supports HTTPS directly in the `web` container:

- `:80` redirects to `:443`
- `:443` serves the app and proxies `/api/*` + `/uploads/*`
- If no cert exists, container auto-generates a self-signed cert

## 1) Environment

Copy `.env.docker.example` to `.env` and set:

- `WEB_PORT=80`
- `WEB_HTTPS_PORT=443`
- `FRONTEND_BASE_URL=https://your-domain-or-ip`
- `TLS_CERT_CN=your-domain-or-ip`

For AI provider config, set one pair only:

- `STEPFUN_API_URL`
- `STEPFUN_API_KEY`

`AI_REPORT_*` can stay empty, backend will reuse `STEPFUN_*` automatically.

## 2) Certificates

Place cert files in repo-root `certs/`:

- `certs/fullchain.pem`
- `certs/privkey.pem`

If missing, startup auto-generates a self-signed certificate.

## 3) Start

```powershell
docker compose up -d --build
```

Then open:

- `https://<your-domain-or-ip>`

## 4) Camera Access Note

Browser camera APIs require a secure context. For stable production behavior,
use a trusted CA-issued certificate (not self-signed).

