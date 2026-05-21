export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const OFFLINE_ANALYSIS_LIMIT_SEC = 2 * 60
export const OFFLINE_ANALYSIS_TARGET_FPS = 40
export const OFFLINE_ANALYSIS_MAX_FRAMES = OFFLINE_ANALYSIS_LIMIT_SEC * OFFLINE_ANALYSIS_TARGET_FPS
export const OFFLINE_DEDICATED_REPLAY_ACTIONS = new Set(['squat', 'pushup', 'lateral-raise', 'bent-over-row'])

export const POSE_TOOL_MESSAGES = {
  loginRequiredForOfflineArchive: 'Please log in if you want to save this local report to training history.',
  offlineArchiveSaved: 'Local video analysis completed and archived. You can open the detailed report or training history.',
  offlineArchiveSaveFailed: 'Local video analysis completed. Report is ready; training archive save failed this time.'
} as const

export type PoseTeachingCopy = {
  cameraAngle: string
  tipsLines: string[]
}

const TEACHING_COPY_BY_SLUG: Record<string, PoseTeachingCopy> = {
  pushup: {
    cameraAngle: 'Use a true side view (about 90°). Place the camera around hip height, step back 2–3 meters, and keep your full body (shoulders to ankles) visible.',
    tipsLines: [
      'Start in a straight line from head to heels — squeeze glutes and brace your core.',
      'Hands under shoulders; keep wrists stacked and neck neutral.',
      'Lower with control until elbows bend clearly (around 90°) while keeping the body line.',
      'Keep elbows slightly tucked (do not flare wide).',
      'Press back up to the top position before starting the next rep.',
      'Avoid hips sagging or piking — shoulders, hips, and ankles should rise together.'
    ]
  },
  'bent-over-row': {
    cameraAngle: 'Use a side view (about 60°–90°) at hip height. Keep the torso, elbows, and dumbbells visible so the pull path and torso stability can be evaluated.',
    tipsLines: [
      'Hinge at the hips with a flat back; knees softly bent; chest proud.',
      'Lock in your torso angle and keep it steady throughout the rep.',
      'Drive elbows back close to the body and pull toward lower ribs/waist.',
      'Pull all the way back until dumbbells are close to the hips/lower ribs, then squeeze briefly.',
      'Lower slowly and stay controlled — do not swing or use momentum.',
      'Keep shoulders down (no shrugging) and keep wrists neutral.'
    ]
  },
  'lateral-raise': {
    cameraAngle: 'Set the camera directly in front (0°). Place it around chest-to-hip height and ensure both arms (shoulders to wrists) stay fully visible the whole time.',
    tipsLines: [
      'Stand tall with a slight bend in the elbows and wrists neutral.',
      'Raise both arms together to about shoulder height (upper arms roughly parallel to the floor).',
      "Keep shoulders down (don't shrug) and keep the neck relaxed.",
      'Lead slightly with the elbows and keep wrists under control (do not curl).',
      'Lower slowly and smoothly — the lowering phase matters.',
      "Avoid rocking the torso or using momentum to 'cheat' the weight up."
    ]
  },
  squat: {
    cameraAngle: 'Use a 30°–45° front angle (or a true side view at 90°). Place the camera at hip height and keep hips, knees, and ankles visible throughout.',
    tipsLines: [
      'Feet about shoulder-width; toes slightly out; brace core before descending.',
      'Sit hips down and back; let knees track over toes (do not cave inward).',
      'Keep heels planted and chest up; stay balanced over mid-foot.',
      'Go to a depth you can control (hips around knee height or deeper if comfortable).',
      'Stand up by pushing the floor away and driving hips up smoothly.',
      'Avoid bouncing at the bottom — stay controlled through the full range.'
    ]
  }
}

const TUTORIAL_VIDEO_BY_SLUG: Record<string, string> = {
  squat: '/assets/images/videos/deep-squat.mp4',
  pushup: '/assets/images/videos/push-up.mp4',
  'lateral-raise': '/assets/images/videos/lateral-raise.mp4',
  'bent-over-row': '/assets/images/videos/bent-over-row.mp4'
}

export function poseToolErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
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
  void displayName
  return TUTORIAL_VIDEO_BY_SLUG[exerciseSlug] ?? null
}

export function getPoseTeachingCopy(exerciseSlug: string): PoseTeachingCopy | null {
  return TEACHING_COPY_BY_SLUG[exerciseSlug] ?? null
}
