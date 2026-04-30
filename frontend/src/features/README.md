# Features Layer

- `features/pose`: Pose domain entry (training, analysis, visualization).
- `features/food`: Food and nutrition domain entry.
- `features/user`: User account and profile domain entry.
- `features/blog`: Blog domain entry.
- `features/app`: Cross-domain app capabilities (for example feedback drawer APIs).

Goals:
- Converge import paths at feature boundaries.
- Keep module responsibilities explicit and stable.
- Reduce page/component coupling to low-level libraries.
