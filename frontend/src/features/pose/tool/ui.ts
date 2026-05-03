import type { DistanceState } from '../../../lib/pose/distanceTracker'

export function getRangeStatusText(distance: DistanceState | null) {
  if (!distance) return 'Waiting for detection'
  if (distance.status === 'calibrating') return 'Calibrating distance'
  if (distance.status === 'lost') return 'Stable body not detected'
  if (distance.label === 'too_close') return 'Too close'
  if (distance.label === 'too_far') return 'Too far'
  return 'Distance OK'
}

export function buildSideViewIndicator(exerciseSlug: string, offset: number | null | undefined) {
  if (exerciseSlug !== 'squat') return null
  if (typeof offset !== 'number') {
    return {
      ok: false,
      text: 'Align your body sideways (profile) to the camera before counting reps.',
      style: { background: '#fff7ed', border: '2px solid #fb923c', color: '#9a3412' } as const
    }
  }
  if (offset <= 55) {
    return {
      ok: true,
      text: `Side View OK (${offset} deg): valid side profile detected.`,
      style: { background: '#ecfdf5', border: '2px solid #10b981', color: '#065f46' } as const
    }
  }
  return {
    ok: false,
    text: `Not Side View (${offset} deg): turn your body 90 deg to the camera. Reps stay visible but won't be valid.`,
    style: { background: '#fef2f2', border: '2px solid #ef4444', color: '#991b1b' } as const
  }
}

export function buildOfflineTaskUi(input: {
  offlineBusy: boolean
  offlineLocalStatus: 'idle' | 'running' | 'succeeded' | 'failed'
  offlineRunStarted: boolean
  offlineCompletedStep: number
  offlineProgressStage: string | null
  hasOfflineReport: boolean
  offlineArchiveStatus: 'idle' | 'saving' | 'done' | 'failed'
}) {
  const taskStatusText = input.offlineBusy
    ? 'Analyzing video...'
    : input.offlineLocalStatus === 'succeeded'
      ? 'Completed'
      : input.offlineLocalStatus === 'failed'
        ? 'Failed'
        : input.offlineLocalStatus === 'running'
          ? 'Processing'
          : 'Ready to analyze'
  const taskStatusToneClass = input.offlineBusy
    ? 'pose-status-pill-info'
    : input.offlineLocalStatus === 'succeeded'
      ? 'pose-status-pill-success'
      : input.offlineLocalStatus === 'failed'
        ? 'pose-status-pill-danger'
        : input.offlineLocalStatus === 'running'
          ? 'pose-status-pill-info'
          : 'pose-status-pill-muted'

  const analysisStarted = input.offlineRunStarted || input.offlineCompletedStep > 0 || input.offlineBusy || input.hasOfflineReport
  const progressStage = (input.offlineProgressStage ?? '').toLowerCase()
  const progressStep =
    progressStage.includes('preparing local video')
      ? 1
      : progressStage.includes('loading movenet') || progressStage.includes('loading mediapipe') || progressStage.includes('extracting pose keypoints')
        ? 2
        : progressStage.includes('replaying')
          ? 3
          : progressStage.includes('finalizing local report')
            ? 4
            : 0
  const checklist = [
    { label: 'Prepare local video', done: input.offlineCompletedStep >= 1 || progressStep >= 2 },
    { label: 'Extract pose keypoints', done: input.offlineCompletedStep >= 2 || progressStep >= 3 },
    { label: 'Run motion analysis', done: input.offlineCompletedStep >= 3 || progressStep >= 4 },
    { label: 'Finalize local report', done: input.offlineCompletedStep >= 4 || input.hasOfflineReport },
    { label: 'Archive to training history', done: input.offlineArchiveStatus === 'done', failed: input.offlineArchiveStatus === 'failed', saving: input.offlineArchiveStatus === 'saving' }
  ]

  return { taskStatusText, taskStatusToneClass, analysisStarted, checklist }
}

export function getTutorialVideoSrc(exerciseSlug: string, displayName: string) {
  const hasTutorialVideo =
    exerciseSlug === 'squat' || exerciseSlug === 'pushup' || exerciseSlug === 'lateral-raise' || exerciseSlug === 'bent-over-row'
  return hasTutorialVideo ? `/assets/images/videos/${encodeURIComponent(displayName)}.mp4` : null
}

