# Backend Operations

## Local Run
1. Prepare database and env from `.env.example`.
2. Run migrations/init as project requires.
3. Start backend service.

## Production Runbook
- Health checks: API process, DB connectivity, queue backlog (`AnalysisTask` in `uploaded/running`).
- Incident triage order: auth -> DB -> uploads -> worker -> AI provider.
- Recovery: failed task can be retried by re-submission (current flow).
- Use `backend/.env.production.example` as deployment template and inject real secrets out-of-repo.
- Migration baseline exists under `backend/migrations`; apply upgrades on each release before app rollout.

## Observability Recommendations
- Add structured logs with request id and user id hash.
- Track metrics:
  - auth failures and rate-limit hits
  - pose task throughput and failure ratio
  - average analysis duration
  - upload size distribution

## Data Lifecycle
- Retention policy should define TTL for uploaded videos and analysis tasks.
- Periodic cleanup job should purge expired media payloads and orphan files.

## Release Gate
- `npm run typecheck` and frontend build green.
- backend import/startup smoke green.
- no hardcoded secrets in tracked files.
- run `flask --app run.py db upgrade` before backend rollout (no runtime auto-create).
