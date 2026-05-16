# Styles Governance

## Purpose
- This folder is the single style entry domain for frontend runtime.
- Human-maintained styles and generated/vendor snapshots are separated.

## Editable Files
- `app.css`
  - Editable shared application styles and legacy page rules that have not been split yet.
- `base.css`
  - Editable element defaults and root-level base behavior.
- `layout.css`
  - Editable layout primitives only. Do not add page-specific feature styles here.
- `tokens.css`
  - Editable design tokens.
- `ui-components.css`
  - Editable shared UI primitives.
- `food-module.css`
  - Editable Food module styles.
- `blog.css`
  - Editable Blog page styles.
- `profile.css`
  - Editable Profile page styles.
- `pose.css`
  - Editable Pose page, video analysis, and report styles.
- `legacy-vendor.css` (import wiring only)

## Non-Editable Snapshot Files
- `generated/utilities-compat.css`
  - Tailwind utility compatibility snapshot.
  - Replace by regeneration; do not hand-edit.
- `vendor/vendor-icons.css`
  - Icon library stylesheet snapshot.
  - Replace from source vendor package; do not hand-edit.
- `vendor/vendor-main.css`
  - Legacy theme stylesheet snapshot.
  - Replace from source legacy package; do not hand-edit.

## Update Rules
1. Business/UI styling changes must go to editable files only.
2. Snapshot files can only be replaced as a whole.
3. Keep imports centralized in `src/main.tsx` and `styles/legacy-vendor.css`.
4. Any new style file must declare whether it is `editable` or `snapshot`.
5. New page-specific styles should go into a page/domain file such as `food-module.css` or a new `pages/<domain>.css`, not into `layout.css`.
6. When touching old page rules in `app.css`, prefer moving the edited block into an owned page/domain stylesheet instead of growing `app.css`.
