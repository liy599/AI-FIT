import type { DistanceState } from '../vision/distanceTracker'
import type { PoseToolMode } from './types'

export const LIVE_TARGET_FPS = 40
export const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const OFFLINE_ANALYSIS_LIMIT_SEC = 2 * 60
export const OFFLINE_ANALYSIS_TARGET_FPS = 40
export const OFFLINE_ANALYSIS_MAX_FRAMES = OFFLINE_ANALYSIS_LIMIT_SEC * OFFLINE_ANALYSIS_TARGET_FPS
export const LIVE_SESSION_LIMIT_MS = 2 * 60 * 1000
export const OFFLINE_DEDICATED_REPLAY_ACTIONS = new Set(['squat', 'pushup', 'lateral-raise', 'bent-over-row'])

export const POSE_TOOL_MESSAGES = {
  loginRequiredForLiveSave: 'Please log in to save training records.',
  loginRequiredForOfflineArchive: 'Please log in if you want to save this local report to training history.',
  noLiveRepsToSave: 'No reps to save yet.',
  liveTrainingSaveFailed: 'Failed to save training record',
  offlineArchiveSaved: 'Local video analysis completed and archived. You can open the detailed report or training history.',
  offlineArchiveSaveFailed: 'Local video analysis completed. Report is ready; training archive save failed this time.'
} as const

export type PoseTeachingCopy = {
  cameraAngle: string
  tipsLines: string[]
}

const TEACHING_COPY_BY_SLUG: Record<string, PoseTeachingCopy> = {
  pushup: {
    cameraAngle: 'Place your camera at a true side view (about 90°) so your whole body stays in frame.',
    tipsLines: [
      'Start in a straight line from head to heels.',
      'Hands under shoulders, core tight.',
      'Lower with control until elbows reach about 90°.',
      'Keep elbows slightly tucked (not flared).',
      'Press up by pushing the floor away; avoid hips sagging or piking; keep neck neutral.'
    ]
  },
  'bent-over-row': {
    cameraAngle: 'Use a side view (about 60°-90°) to clearly see your hip hinge and dumbbell path.',
    tipsLines: [
      'Hinge at the hips with a flat back; knees softly bent; chest proud.',
      'Keep your torso angle stable.',
      'Pull dumbbells toward lower ribs/waist by driving elbows back close to your body.',
      'Pause briefly at the top.',
      'Lower slowly without swinging; avoid shrugging; avoid using momentum.'
    ]
  },
  'lateral-raise': {
    cameraAngle: 'Set the camera directly in front (0°) so both arms are equally visible.',
    tipsLines: [
      'Stand tall with a slight bend in the elbows.',
      'Raise dumbbells to about shoulder height.',
      "Keep shoulders down (don't shrug) and wrists neutral.",
      'Lead with elbows slightly higher than wrists.',
      "Control the lowering phase; avoid rocking your torso to 'cheat' the weight up."
    ]
  },
  squat: {
    cameraAngle: 'Use a 30°-45° front angle (or a true side view at 90°) to capture hips, knees, and ankles clearly.',
    tipsLines: [
      'Feet about shoulder-width; toes slightly out; brace core before descending.',
      'Sit hips down and back; let knees track over toes.',
      'Keep heels planted and chest up.',
      'Aim for depth you can control.',
      'Stand by pushing the floor away and driving hips up.',
      'Avoid knees collapsing inward; avoid bouncing at the bottom.'
    ]
  }
}

/**
 * Keeps route mode resolution deterministic while preserving legacy query support.
 */
export function resolvePoseToolMode(pathname: string, search: string): PoseToolMode {
  const lowerPath = pathname.toLowerCase()
  if (lowerPath.endsWith('/video')) return 'offline'
  if (lowerPath.endsWith('/live')) return 'live'
  const raw = new URLSearchParams(search).get('mode')
  return raw === 'offline' ? 'offline' : 'live'
}

export function poseToolErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getRangeStatusText(distance: DistanceState | null) {
  if (!distance) return 'Waiting for detection'
  if (distance.status === 'calibrating') return 'Calibrating distance'
  if (distance.status === 'lost') return 'Stable body not detected'
  if (distance.label === 'too_close') return 'Too close'
  if (distance.label === 'too_far') return 'Too far'
  return 'Distance OK'
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

export function getPoseTeachingCopy(exerciseSlug: string): PoseTeachingCopy | null {
  return TEACHING_COPY_BY_SLUG[exerciseSlug] ?? null
}
