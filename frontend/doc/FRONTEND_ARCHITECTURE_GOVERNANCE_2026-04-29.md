# Frontend Architecture Governance (2026-04-29)

## 1. Target Architecture

- `pages/*`: route-level composition only.
- `features/*`: domain facades and domain modules.
- `components/*`: reusable presentational components.
- `state/*`: cross-page app state (auth/session only).
- `lib/*`: low-level infrastructure and engine implementations.

## 2. Dependency Direction (Must Follow)

- `pages -> features/components/state`
- `features -> lib` (allowed)
- `components -> features/state` (avoid direct `lib`)
- `state -> lib` (only for persistence/auth helpers)
- `lib -> no upper layer`

## 3. Current Governance Result

- Route pages no longer import `../lib/*` directly.
- Shared UI components no longer import `../lib/*` directly.
- Pose domain accesses are centralized through `features/pose`.
- User/account and backend URL helpers are centralized through `features/user`.
- Feedback drawer API calls are centralized through `features/app`.

## 4. Module Boundaries

- `features/pose`: pose paths, inference helpers, training APIs, report shaping.
- `features/food`: nutrition and meal APIs.
- `features/user`: auth/profile/workout/meal/blog-owning user APIs.
- `features/blog`: blog list/detail/edit/comment APIs.
- `features/app`: cross-domain app-level concerns (feedback).

## 5. Hard Rules for Future Changes

- Do not import `lib/*` from `pages/*` directly.
- Add a feature facade export before exposing any new domain capability.
- Keep page files focused on UI flow and interaction orchestration.
- Keep low-level API/request details in `lib/*` and export typed functions via `features/*`.
- Add concise English comments only for non-obvious logic.

## 6. Next Refactor Priorities

- Split oversized `PoseToolPage.tsx` into feature submodules (controller/hooks/view parts).
- Continue dynamic imports for heavy visual modules.
- Introduce lint rule to block `pages/* -> lib/*` direct imports.

## 7. Latest Governance Update

- Pose tool logic is further decomposed into `features/pose/tool/*` modules and hooks.
- Added boundary guard script: `npm run lint:boundaries` to block direct `pages/components -> lib` imports.
- PoseToolPage.tsx is now orchestration-first; heavy workflow logic moved to feature hooks.

## 8. 2026-05-02 Consolidation Update

- Frontend no longer hardcodes pose runtime policy constants; it consumes backend policy from `GET /api/pose/policy`.
- Pose runtime boundaries are clearer:
  - frontend owns local inference execution and consent UX,
  - backend owns policy publication, persistence, and optional server queue processing.
- This keeps privacy-first behavior by default while enabling centrally managed production policy.

