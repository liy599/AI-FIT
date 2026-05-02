# FRONTEND Refactor Full Trace

Date: 2026-04-29
Branch: `refactor/a-grade-hardening`
Scope: frontend governance, modularization, stack convergence, privacy-first pose pipeline UX integration.

## A. Objectives (Original Intent)

- Make architecture clear, clean, and traceable.
- Converge technology stack and reduce cross-layer coupling.
- Enforce industrial-grade modular boundaries and maintainability.
- Preserve privacy-first local inference while supporting explicit-consent server mode.

## B. High-Level Milestones

1. Feature facade architecture introduced and expanded.
2. Route/page import boundaries converged to feature layer.
3. Pose module relocation from `pages/poseTool/*` to `features/pose/*`.
4. Build/performance optimizations (lazy routes, heavy module lazy-loading, TFJS chunk split, model prewarm/cache).
5. Privacy and server inference switch integration (frontend + backend capability handshake).
6. PoseToolPage progressive decomposition to tool modules/hooks.
7. Boundary guard automation added (`lint:boundaries`).

## C. File/Module-Level Trace

### C1. Architectural Convergence

- Added/expanded:
  - `src/features/pose/index.ts`
  - `src/features/food/index.ts`
  - `src/features/user/index.ts`
  - `src/features/blog/index.ts`
  - `src/features/app/index.ts`
  - `src/features/README.md`
- Purpose:
  - Centralize domain API/capabilities through facades.
  - Prevent direct page/component access to low-level `lib/*`.

### C2. Page/Component Boundary Refactor

- Refactored imports to feature layer in pages/components, including:
  - `src/pages/PoseGuidePage.tsx`
  - `src/pages/PoseSelectPage.tsx`
  - `src/pages/PoseTrainingHistoryPage.tsx`
  - `src/pages/ProfilePage.tsx`
  - `src/pages/PoseToolPage.tsx`
  - `src/components/FeedbackDrawer.tsx`
  - `src/components/Navbar.tsx`
- Result:
  - `pages/*` and `components/*` no longer directly import `../lib/*`.

### C3. PoseTool Domain Relocation

- Migrated old `pages/poseTool/*` domain logic into `features/pose/*`.
- Removed legacy duplicates under `src/pages/poseTool/`.

### C4. PoseToolPage Decomposition (Progressive)

New tool modules:

- `src/features/pose/tool/constants.ts`
- `src/features/pose/tool/types.ts`
- `src/features/pose/tool/mode.ts`
- `src/features/pose/tool/replay.ts`
- `src/features/pose/tool/ui.ts`
- `src/features/pose/tool/tutorial.ts`
- `src/features/pose/tool/useOfflineFileHandler.ts`
- `src/features/pose/tool/useOfflinePoseAnalysis.ts`
- `src/features/pose/tool/useRealtimePoseProvider.ts`
- `src/features/pose/tool/useThrottledMainTip.ts`

Extracted concerns:

- Constants and mode resolution
- Replay overlay computation/drawing
- UI status/text derivation
- Teaching copy configuration
- Offline file lifecycle and validation
- Offline analysis orchestration (local + server submit path)
- Realtime provider preload/cache lifecycle
- Main tip update throttling

### C5. Performance and Build Optimizations

- Lazy route strategy via `src/App.tsx`.
- Heavy visual component lazy-loaded in blog list page.
- TFJS manual chunking in `vite.config.ts`.
- MoveNet prewarm and local detector tuning for faster first-use experience.
- Nginx model cache behavior updated in `nginx.conf`.

### C6. Privacy UX and Server Toggle Integration

Frontend updates:

- `src/lib/poseApi.ts` expanded capabilities and server-analysis APIs.
- `src/pages/PoseToolPage.tsx` supports:
  - local/server processing mode switch,
  - explicit-consent requirement for server mode,
  - server task submit/cancel UX.

Privacy stance:

- Local mode remains default and keeps video on-device.
- Server mode requires explicit user consent.

### C7. Technical Debt and Cleanup

- Removed unused dependency: `lil-gui`.
- Removed dead file: `src/lib/pose/realtimePullupLegacy.ts`.
- Added boundary enforcement script:
  - `scripts/check-boundaries.mjs`
  - npm script: `lint:boundaries`

## D. Configuration and Governance Artifacts

- Updated architecture/governance docs under `frontend/doc`.
- Added this full trace document for end-to-end auditability.

## E. Verification Evidence

Executed checks repeatedly across refactor stages:

- `npm run lint:boundaries` -> passed
- `npm run typecheck` -> passed
- `npm run build` -> passed

## F. Measurable Outcome

- `PoseToolPage.tsx` reduced from ~2168 lines to ~1621 lines.
- Domain logic shifted out of route component into modular feature-tool units.
- Layer boundaries are now script-guarded to resist architecture regression.

## G. Remaining Optional Next Step (Not Required for Current Completion)

- Split `PoseToolPage` JSX into presentational sections/components (`LivePanel`, `OfflinePanel`, `ReportPanel`) for even stronger visual/logic separation.

## H. Redundant File Cleanup Notes

- Duplicate root documentation copies remain due local permission lock.
- Canonical docs are now in `frontend/doc`.
- Root duplicates should be removed once file lock is released.

## I. 2026-05-02 Hardening Addendum (Cross FE/BE)

### I1. Backend-Driven Pose Policy

- Backend added environment-backed policy keys and policy endpoint response composition.
- Frontend PoseTool now consumes policy from backend and uses fallback defaults only when policy is unavailable.
- Effect:
  - Removes scattered frontend magic numbers.
  - Supports production tuning without frontend redeploy.

### I2. Server Worker Concurrency Safety

- Server inference worker task-claim path updated to atomic status transition (`uploaded -> running`).
- Effect:
  - Prevents duplicate claims in multi-worker deployment scenarios.

### I3. Input Validation and Security Hygiene

- Feedback API rating validation hardened:
  - required for review type,
  - integer-only,
  - bounded to `1..5`.
- `.env.example` secrets replaced with placeholders and pose policy envs documented.

### I4. Backend Documentation Baseline Added

- Added backend docs for production handover:
  - `backend/doc/ARCHITECTURE.md`
  - `backend/doc/CONFIG.md`
  - `backend/doc/SECURITY.md`
  - `backend/doc/OPERATIONS.md`

### I5. Verification Evidence (2026-05-02)

- Frontend:
  - `npm run typecheck` passed
  - `npm run build` passed
- Backend:
  - app factory smoke (`create_app`) passed in `backend/.venv`
  - `pytest -q` passed: `35 passed`

### I6. Known Residuals

- Backend test warnings still include:
  - weak default JWT key length warnings in test config context,
  - SQLAlchemy `Query.get()` legacy warnings in older route code paths.
- Non-blocking, but recommended next cleanup for stricter production baseline.

## J. 2026-05-02 Finalization Addendum

### J1. Further PoseToolPage Decomposition

- Extracted offline replay overlay rendering lifecycle from page into:
  - `src/features/pose/tool/useOfflineReplayOverlay.ts`
- Effect:
  - Page orchestration complexity reduced.
  - Overlay loop, canvas sync, and event wiring are isolated and reusable.

### J2. Production Guard Strengthening (Cross FE/BE context)

- Production backend startup now enforces:
  - explicit `CORS_ORIGINS`
  - `REDIS_URL` present (distributed rate limit baseline)
  - `ADMIN_EMAIL` present
  - `PASSWORD_RESET_DEBUG_RETURN_LINK=0`
- Compose now includes Redis service and backend dependency health checks.

### J3. Migration Baseline Materialized

- Repository now includes `backend/migrations/*` baseline.
- Deployment workflow is migration-first (`db upgrade`) with `DB_AUTO_INIT=0` in production.

## K. 2026-05-02 Final Closure

### K1. Production Raw Output Guard Unified

- `POST /api/pose/reports/ai` now matches recognition endpoint policy:
  - `rawText` is suppressed in production even if `debug=1`.

### K2. No Runtime Auto-Create Path

- Backend app startup no longer performs `db.create_all`.
- Schema lifecycle is migration-only in normal operations.

### K3. PoseToolPage Final UI Split (Offline)

- Extracted offline teaching/report cards into:
  - `src/features/pose/tool/PoseOfflinePanels.tsx`
- Result:
  - route page is further reduced and keeps orchestration focus.
