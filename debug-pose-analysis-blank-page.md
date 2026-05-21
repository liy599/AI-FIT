# [OPEN] pose-analysis-blank-page

## Symptom
- After finishing offline video analysis, the page becomes blank (white screen).

## Expected
- Report and overlay should render normally after analysis completes.

## Hypotheses
- A: A runtime exception is thrown during report rendering (e.g., Key Issues card selection / snapshot handling).
- B: A runtime exception is thrown during offline analysis finalization (e.g., attaching snapshots or setting report state).
- C: A React render error is swallowed and the app unmounts / router navigates to an invalid state.
- D: An unhandled Promise rejection occurs (e.g., video seek/capture) and breaks the UI state.
- E: Memory/large data (snapshotDataUrl) triggers browser failure for some videos, causing render failure.

## Evidence to Collect
- Global `window.onerror` + `unhandledrejection` stack traces.
- Key checkpoints: analysis start/end, report set, snapshot generation loop, report visualization entry.

## Runs
- pre-fix: confirmed
  - Evidence: `Uncaught ReferenceError: Cannot access 'exerciseSlug' before initialization` in `ReportVisualization` (PoseToolWidgets.tsx) after analysis completion.
  - Trigger: Key Issues card selection calls `mapPoseFeedbackMessage({ exerciseSlug, ... })` before `exerciseSlug` is initialized.
- post-fix: pending
