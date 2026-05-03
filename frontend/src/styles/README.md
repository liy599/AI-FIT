# Styles Governance

## Purpose
- This folder is the single style entry domain for frontend runtime.
- Human-maintained styles and generated/vendor snapshots are separated.

## Editable Files
- `app.css`
- `base.css`
- `layout.css`
- `tokens.css`
- `ui-components.css`
- `food-module.css`
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
