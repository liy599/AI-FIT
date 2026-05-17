# Frontend Modules

`modules` contains product-domain code: API facades, feature hooks, policy adapters, report builders, and payload mappers.

Boundary rules:
- Pages import business capabilities from `modules/*`.
- UI components live in `components/*`, not in `modules/*`.
- Low-level math, model inference, drawing, and generic utilities live in `lib/*`.
- A module facade (`modules/<name>/index.ts`) should be the public entry unless a page needs a clearly named tool hook.
