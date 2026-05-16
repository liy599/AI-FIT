# AI-FIT Project Governance Plan

This document records the cleanup goals, target files, and staged execution plan for keeping the project structure clear, maintainable, and predictable.

## Goals

- Keep source directories focused on source code, not generated files or runtime cache.
- Use one clear static asset strategy for the frontend.
- Keep pages thin and move reusable UI, data loading, and business logic into feature modules.
- Keep CSS ownership explicit and avoid growing global styles indefinitely.
- Keep backend domains easy to locate, test, and extend.
- Preserve existing user-facing behavior while restructuring.

## Progress

- Phase 1 completed: pytest temporary cache folders are ignored and local leaked cache folders were removed.
- Phase 1 completed: obsolete empty realtime/live runtime directory was removed.
- Phase 2 completed: frontend public assets were moved from `frontend/src/static` to `frontend/public`.
- Phase 2 completed: `frontend/vite.config.ts` now uses Vite's default `public` directory instead of overriding `publicDir`.
- Phase 2 completed: pose tutorial images and videos were renamed to kebab-case filenames.
- Phase 3 completed for the current scope: Profile, Blog list, and Food meal editor pages were reduced into route composition plus domain components/helpers.
- Phase 4 completed for the current scope: Blog/Profile/Pose page styles now live in owned stylesheets, Food meal editor styles live in `food-module.css`, and `layout.css` no longer owns those page-specific blocks.
- Phase 5 completed for the current scope: backend route files now delegate image uploads, account data lifecycle deletion, and food meal serialization/normalization to domain services/utilities.

Latest verification:

- `npm.cmd run build` passed from `frontend`.
- `.\.venv\Scripts\python.exe -m pytest` passed from `backend` with 32 tests.

## Current Findings

### Runtime and Generated Artifacts

Target paths:

- `pytest-cache-files-*/`
- `frontend/dist/`
- `frontend/node_modules/`
- `backend/.venv/`
- `backend/.pytest_cache/`
- `backend/__pycache__/`
- `backend/instance/`
- `instance/`

Actions:

- Keep generated/runtime artifacts out of Git.
- Add missing ignore rules where needed.
- Remove local cache folders when they leak into the repo root.

### Frontend Static Assets

Original target paths:

- `frontend/src/static/assets/**`
- Current target: `frontend/public/assets/**`

Original issue:

- Static assets used to live under `src/static` while code referenced them as `/assets/...` public URLs.
- `frontend/vite.config.ts` used to set `publicDir: 'src/static'` to make this work.
- That created Vite ambiguity: assets treated as public files should not be imported from JavaScript.

Current state:

- Public assets now live under `frontend/public`.
- Code continues to use `/assets/...`, `/figma/...`, and `/favicon.png` URLs.
- `frontend/src/static` has been removed.

Actions:

- Move public-only assets to `frontend/public/assets`.
- Remove the custom `publicDir: 'src/static'` override after the move.
- Use `/assets/...` URLs consistently for public assets.
- Avoid spaces in asset filenames.
- Keep importable source-owned assets under `frontend/src/assets` only when bundling is intended.

Important references:

- `frontend/src/pages/user/ProfilePage.tsx`
- `frontend/src/pages/pose/PoseSelectPage.tsx`
- `frontend/src/modules/pose/runtime/toolUi.ts`
- `frontend/src/modules/pose/vision/movenetPose.ts`
- `frontend/src/styles/base.css`
- `frontend/src/styles/vendor/vendor-main.css`

Migration checklist:

- Completed: move `frontend/src/static/assets` to `frontend/public/assets`.
- Completed: keep `/favicon.png` available from `frontend/public/favicon.png`.
- Completed: keep `/figma/*` available from `frontend/public/figma`.
- Completed: confirm `/assets/images/bg/default.jpg` still resolves for profile fallback avatars through build.
- Completed: confirm `/assets/models/movenet/singlepose-*/model.json` remains under `/assets/models/...`.
- Completed: rename pose tutorial media to kebab-case and update code references.
- Completed: scan for remaining source-code `src/static` references after migration.

### Frontend Large Pages

Target files:

- `frontend/src/pages/user/ProfilePage.tsx`
- `frontend/src/pages/food/FoodMealPage.tsx`
- `frontend/src/pages/blog/BlogListPage.tsx`
- `frontend/src/components/user/**`
- `frontend/src/components/food/**`
- `frontend/src/components/blog/**`
- `frontend/src/modules/food/mealEditor.ts`

Actions:

- Keep page files as route-level composition.
- Move reusable UI into `frontend/src/components/<domain>/`.
- Move data loading and state coordination into `frontend/src/modules/<domain>/hooks/`.
- Move pure business logic into `frontend/src/modules/<domain>/helpers/` or `services/`.

### Pose Module

Target paths:

- `frontend/src/modules/pose/analyzer/**`
- `frontend/src/modules/pose/helpers/**`
- `frontend/src/modules/pose/reporting/**`
- `frontend/src/modules/pose/runtime/**`
- `frontend/src/modules/pose/vision/**`

Actions:

- Keep the video analysis chain behavior equivalent while cleaning naming and boundaries.
- Remove any empty or obsolete realtime/live directories after live coaching removal.
- Keep analyzer math and report generation covered by build/tests before and after structure changes.

### Frontend Styles

Target files:

- `frontend/src/styles/vendor/vendor-main.css`
- `frontend/src/styles/app.css`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/food-module.css`
- `frontend/src/styles/blog.css`
- `frontend/src/styles/profile.css`
- `frontend/src/styles/pose.css`

Actions:

- Treat `vendor-main.css` as legacy vendor CSS and avoid manual feature edits there.
- Split global app styles by page/domain when touched.
- Keep `layout.css` focused on layout primitives.
- Keep tokens and shared UI primitives in `tokens.css`, `base.css`, and `ui-components.css`.

### Backend Structure

Target paths:

- `backend/app/routes/**`
- `backend/app/services/**`
- `backend/app/utils/**`
- `backend/app/models.py`
- `backend/tests/**`

Actions:

- Keep the current structure until a domain grows enough to justify moving.
- Prefer domain-level modules for future growth: routes, services, schemas, and query helpers.
- Keep tests close to behavioral surfaces.

### Documentation

Target paths:

- `README.md`
- `DEPLOYMENT_SERVER_GUIDE_2026-05-02.md`
- `frontend/doc/`
- `backend/doc/`
- `info/`
- Future target: `docs/`

Actions:

- Consolidate scattered docs into `docs/` when documentation is next edited.
- Keep root-level docs limited to entry points and active plans.

## Execution Plan

### Phase 1: Low-Risk Hygiene

- Add missing ignore rules for leaked pytest temporary cache folders.
- Remove root pytest temporary cache folders.
- Remove empty obsolete realtime/live directories.
- Verify frontend build and backend focused tests.

Acceptance:

- Completed: `pytest-cache-files-*` is ignored.
- Completed: no empty `frontend/src/modules/pose/runtime/live` directory remains.
- Completed: `npm.cmd run build` passes in `frontend`.
- Completed: focused backend tests pass from `backend`.

### Phase 2: Static Asset Strategy

- Completed: move `frontend/src/static/assets` to `frontend/public/assets`.
- Completed: move root public files from `frontend/src/static` to `frontend/public`.
- Completed: update references to use stable `/assets/...` URLs.
- Completed: rename pose demo media files to kebab-case names and update references.
- Completed: verify production build.

Acceptance:

- No `frontend/src/static` public asset dependency remains.
- No JS/TS import points to public static assets.
- Pose tutorial images/videos and MoveNet model files load correctly.

### Phase 3: Large Page Decomposition

- Completed: split `ProfilePage.tsx` into route composition plus user dashboard/profile/diet/community components.
- Completed: split `FoodMealPage.tsx` by moving pure meal editor helpers into `modules/food/mealEditor.ts`, image recognition UI into `components/food/FoodRecognitionPanel.tsx`, food picker UI into `components/food/FoodPickerPanel.tsx`, and draft summary UI into `components/food/MealDraftPanel.tsx`.
- Completed: split `BlogListPage.tsx` into route composition plus `components/blog/BlogListParts.tsx`.

Acceptance:

- Completed for profile and blog: route files are materially smaller and mostly compose components/hooks.
- Completed for food: route file delegates helper logic, recognition UI, picker UI, and draft summary UI to domain modules/components.
- No user-facing behavior changes.
- Build passes after each page split.

### Phase 4: CSS Ownership

- Completed for touched domains: move Blog/Profile/Pose/Food meal page-specific blocks out of `layout.css`; move Pose-specific rules out of `app.css`.
- Completed: keep vendor CSS isolated through documented snapshot ownership.
- Completed: add CSS ownership notes to `frontend/src/styles/README.md`.
- Remaining future cleanup: `app.css` now mainly contains broader legacy shared/page styling and should be split further only when those pages are next edited.

Acceptance:

- New feature styles have a clear owner file.
- Global CSS files stop growing with page-specific rules.

### Phase 5: Backend Domain Cleanup

- Completed: moved shared public image upload validation/saving into `backend/app/utils/image_upload.py`.
- Completed: moved account data lifecycle deletion orchestration into `backend/app/services/account/data_lifecycle.py`.
- Completed: moved food meal item normalization, date parsing, serialization, and nutrition totals into `backend/app/services/food/meals.py`.
- Completed: kept `models.py` intact because splitting SQLAlchemy relationships now would add churn without reducing current runtime risk.
- Completed: fixed `tests/test_admin_seed.py` to use a Windows-safe temporary SQLite database lifecycle.

Acceptance:

- Completed: backend file moves are incremental and test-backed.
- Completed: no route contract changes were introduced.
- Completed: full backend pytest suite passes.

## Verification Commands

Run from repo root unless noted:

```powershell
Set-Location frontend
npm.cmd run build
```

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests\test_pose.py tests\test_rate_limit.py
```

Use broader tests before major merges:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest
```

## Change Discipline

- Make one structural change at a time.
- Run build/tests after each phase.
- Do not mix behavior changes with file moves unless required.
- Preserve existing URLs, API contracts, and report output unless a change is explicitly requested.
