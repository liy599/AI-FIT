# Frontend Documentation Hub

Last updated: 2026-04-29

## 1. Core Documents

- `FRONTEND_ARCHITECTURE_GOVERNANCE_2026-04-29.md`
- `FRONTEND_技术栈收束与模块化治理规范_v1.md`
- `FRONTEND_文件来源_作用_依赖与影响_2026-04-29.md`
- `FRONTEND_目录文件作用与清理建议_2026-04-29.md`
- `FRONTEND_REFACTOR_FULL_TRACE_2026-04-29.md`

## 2. Current Architecture Baseline

- Layering: `pages -> features/components/state -> lib`
- Feature facades: `features/{pose,food,user,blog,app}`
- Boundary guard: `npm run lint:boundaries`
- Build status: typecheck/build passed in current branch

## 3. Redundancy Cleanup Status

- Above documents are now unified under `frontend/doc`.
- Root-level historical copies still exist due local file permission lock and are marked as duplicate copies.
- Recommended manual cleanup (once unlocked):
  - `frontend/FRONTEND_ARCHITECTURE_GOVERNANCE_2026-04-29.md`
  - `frontend/FRONTEND_技术栈收束与模块化治理规范_v1.md`
  - `frontend/FRONTEND_文件来源_作用_依赖与影响_2026-04-29.md`
  - `frontend/FRONTEND_目录文件作用与清理建议_2026-04-29.md`
