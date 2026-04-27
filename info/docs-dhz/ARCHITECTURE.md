# AI-FIT Architecture Map

## 1. Scope
This document defines the current real architecture of AI-FIT and the boundaries between modules. It is the baseline for refactor and production hardening.

## 2. Tech Stack (Current)
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Flask + Flask-JWT-Extended + Flask-SQLAlchemy
- Database: PostgreSQL 16
- Reverse Proxy / Edge: Caddy (container), Nginx (frontend static container)
- Runtime: Docker Compose (db, backend, web, caddy)

## 3. Runtime Topology
- `caddy` (public entry) -> `web` (frontend static) and `/api` -> `backend`
- `backend` -> `db` (PostgreSQL)
- `backend` file storage -> container volume `aifitguard_uploads` (`/app/instance/uploads`)

Reference: `docker-compose.yml`, `Caddyfile`, `frontend/Dockerfile`, `backend/app/__init__.py`

## 4. Frontend Architecture
- Entry: `frontend/src/main.tsx`
- Router: `frontend/src/App.tsx`
- Feature pages:
  - Auth/Profile: `frontend/src/pages/LoginPage.tsx`, `ProfilePage.tsx`
  - Blog: `BlogListPage.tsx`, `BlogDetailPage.tsx`
  - Food: `FoodModulePage.tsx`, `FoodMealPage.tsx`
  - Pose: `PoseToolPage.tsx`, `PoseTrainingHistoryPage.tsx`, `PoseTrainingReportPage.tsx`
- API client layer: `frontend/src/lib/api.ts`, `poseApi.ts`, `food/api.ts`
- Auth state: `frontend/src/state/auth-context.tsx`, `frontend/src/lib/auth.ts`

## 5. Backend Architecture
- App factory: `backend/app/__init__.py`
- Config: `backend/app/config.py`
- Extensions: `backend/app/extensions.py`
- Blueprints (registered in app factory):
  - `/api/auth`
  - `/api/user`
  - `/api/workouts`
  - `/api/tags`
  - `/api/blogs`
  - `/api` (comments routes)
  - `/api/feedback`
  - `/api/food`
  - `/api/foods`
  - `/api/meals`
  - `/api/pose`
  - `/api/recognize`
  - `/api/admin`
- Service layer:
  - Food services: `backend/app/services/food/*`
  - Pose AI report service: `backend/app/services/pose/ai_report.py`
- Utility layer:
  - Security / password: `backend/app/utils/security.py`
  - Rate limit: `backend/app/utils/rate_limit.py`
  - Upload access token: `backend/app/utils/upload_access.py`
  - Privacy encryption helpers: `backend/app/utils/privacy.py`

## 6. Domain Modules
- Identity/Auth: registration, login, password reset, profile
- Content: blogs, comments, tags
- Training basics: workouts
- Food: catalog, meals, image recognition pipeline
- Pose: video upload, analysis task lifecycle, training session/report
- Admin: data lifecycle policy and cleanup

## 7. Data Boundaries
- Core entities: users, blogs/comments, courses, workouts, foods/meals, pose assets/tasks/results/trainings
- Upload paths:
  - Public prefixes: `avatars`, `blog_covers`
  - Private files: signed token required for `/uploads/*`

## 8. Current Architecture Risks (Must Track)
- DB schema lifecycle still relies on `db.create_all()` in startup path.
- Rate limiting is in-memory (single-process oriented).
- JWT lifecycle lacks refresh/blacklist strategy.
- Secrets management not production-hardened yet.

## 9. Next Architecture Targets
- Introduce DB migrations (Alembic/Flask-Migrate)
- Externalize distributed rate limit store (Redis)
- Add observability baseline (structured logs, metrics, alerts)
- Harden auth lifecycle (refresh token + token revocation model)
