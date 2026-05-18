# AI-FIT Architecture Map

## Scope

This document describes the current runtime architecture and module boundaries for AI-FIT.

## Technology Stack

- Frontend: React 18 + TypeScript + Vite.
- Backend: Flask + Flask-JWT-Extended + Flask-SQLAlchemy.
- Database: PostgreSQL 16.
- Cache/rate limit support: Redis.
- Public HTTP entry: Nginx inside the `web` container.
- Runtime: Docker Compose (`db`, `redis`, `backend`, `web`).

## Runtime Topology

- `web` binds the VM HTTP port `80`.
- `web` serves the built frontend assets.
- `web` proxies `/api/*`, `/uploads/*`, and `/api/uploads/*` to `backend:5000`.
- `backend` connects to `db` and `redis` inside the Compose network.
- Uploaded files are stored in the `aifitguard_uploads` volume at `/app/instance/uploads`.

Reference files:

- `docker-compose.yml`
- `frontend/nginx.conf`
- `frontend/Dockerfile`
- `backend/Dockerfile`
- `backend/app/__init__.py`

## Frontend Structure

- Entry: `frontend/src/main.tsx`
- Routes: `frontend/src/App.tsx`
- API client: `frontend/src/lib/api.ts`
- Auth state: `frontend/src/state/auth-context.tsx`, `frontend/src/lib/auth.ts`
- Feature modules: `frontend/src/modules/*`
- Pages: `frontend/src/pages/*`

## Backend Structure

- App factory: `backend/app/__init__.py`
- Config: `backend/app/config.py`
- Extensions: `backend/app/extensions.py`
- Models: `backend/app/models.py`
- Routes: `backend/app/routes/*`
- Services: `backend/app/services/*`
- Utilities: `backend/app/utils/*`

Registered API prefixes include:

- `/api/auth`
- `/api/user`
- `/api/workouts`
- `/api/tags`
- `/api/blogs`
- `/api/feedback`
- `/api/food`
- `/api/foods`
- `/api/meals`
- `/api/pose`
- `/api/recognize`
- `/api/admin`

## Domain Boundaries

- Identity/Auth: register, login, password reset, profile.
- Content: blogs, comments, tags.
- Training basics: workout records.
- Food: catalog, meals, image recognition flow.
- Pose: browser-local inference, backend policy, session/report persistence.
- Admin: user and data lifecycle operations.

## Current Risks

- Production schema changes must go through migrations; do not rely on runtime table creation.
- Redis is required for distributed rate limiting in production.
- Secrets must be non-default and kept out of the repository.
- Public HTTP is a simplified deployment mode; browser camera APIs may require HTTPS.
