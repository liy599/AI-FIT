# Pose Components

Pose components are presentation-only building blocks for the Pose pages.

Boundary rules:
- Components receive prepared state and callbacks through props.
- Components do not call Pose APIs directly.
- Pose business orchestration stays in `modules/pose`.
- MoveNet, drawing, and analyzer primitives stay in `lib/pose`.
