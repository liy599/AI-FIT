# Production DoD (Definition of Done)

This checklist defines the minimum bar for production-grade delivery in AI-FIT.

## P0: Must Pass Before Release
- [ ] No real secrets in repo (`.env.example`, docs, scripts, commit history).
- [ ] Database migrations are versioned and reviewed; no runtime `create_all` for schema changes.
- [ ] Auth critical paths pass (register/login/reset/logout/me).
- [ ] Core business paths pass (food + pose + blog).
- [ ] Security checks pass for upload/access control and permission boundaries.
- [ ] Release includes rollback plan and verified rollback target.

## P1: Must Pass for Stable Operations
- [ ] CI gate exists and blocks merge on failure.
- [ ] Frontend checks: typecheck + build.
- [ ] Backend checks: tests + lint (and type checks if enabled).
- [ ] API contract diff reviewed for every endpoint change.
- [ ] Structured logging is enabled for backend and gateway.
- [ ] Rate limit strategy is compatible with multi-instance deployment.

## P2: Must Pass for Production Maturity
- [ ] Observability baseline: error tracking + metrics + alert rules.
- [ ] Performance baseline documented (key API latency + frontend load metrics).
- [ ] Backup and restore drill documented and validated.
- [ ] Runbook, user manual, test report, and release note are updated.

## Evidence Required Per Release
- [ ] Commit/tag and release note
- [ ] Test report snapshot
- [ ] Smoke test result
- [ ] Security checklist result
- [ ] Rollback verification record
