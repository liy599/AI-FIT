# AI-FIT Runbook

## 1. Environments
- Local dev: Windows PowerShell + Docker Desktop + Python + Node
- Container stack: `db`, `redis`, `backend`, `web` via docker compose

## 2. Local Startup (Recommended)
From repo root:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```
Expected:
- Backend health: `http://127.0.0.1:5000/api/health`
- Frontend: `http://localhost:5173`

## 3. Manual Startup (Fallback)
### 3.1 Start DB
```powershell
docker compose up -d db
```

### 3.2 Start Backend
```powershell
cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

### 3.3 Start Frontend
```powershell
cd .\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
npm.cmd install
npm.cmd run dev
```

## 4. Build / Checks
### Frontend
```powershell
cd .\frontend
npm.cmd run typecheck
npm.cmd run build
```

### Backend (using venv python to avoid PATH issue)
```powershell
cd .\backend
.\.venv\Scripts\python.exe -m pytest -q
```

## 5. Containerized Stack
```powershell
docker compose up -d --build
```
Services:
- HTTP entry: web nginx container (`80`)
- API and uploads proxied from web nginx to backend
- Static frontend served from web container

## 6. Basic Smoke Checklist
- `GET /api/health` returns `{ ok: true }`
- Register/Login works
- `/food` list + meal create/delete works
- `/tools/pose` video upload + task create + report path works
- Upload protected path returns `403` without token

## 7. Incident Handling (Minimum)
1. Capture failing route and payload.
2. Check backend logs and web logs.
3. Verify DB connectivity and migration state.
4. Roll back to previous stable image/tag if user-facing outage persists.

## 8. Release Procedure (Current Minimal)
1. Merge to release branch after checks pass.
2. Build images in CI (to be enforced).
3. Deploy to staging.
4. Run smoke checklist.
5. Deploy production with rollback point.

## 9. Known Gaps
- No formal migration workflow yet.
- No enforced CI quality gate in repo yet.
- Observability baseline (metrics/alerting) still incomplete.

