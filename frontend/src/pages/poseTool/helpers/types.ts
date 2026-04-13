import type { NormalizedLandmark } from '../../../lib/pose/mediapipePose'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import type { Squat17Tempo, Squat17Tuning } from '../../../lib/pose/realtimeSquat17'
import type { MoveNetKeypoint } from '../../../lib/pose/movenetTracker'

export type ExerciseSlug = 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press'

export type SquatTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
}

export type SquatRepFinding = {
  repNumber: number
  result: 'correct' | 'incorrect' | 'invalid'
  primaryIssue: string
  reasons: string[]
  atFrame: number
  tMs: number
}

export type BenchPressTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  elbowAngleDeg: number | null
  bodyLineAngleDeg: number | null
  torsoFromHorizontalDeg: number | null
}

export type RealtimeAnalyzer = {
  analyze: (landmarks: NormalizedLandmark[]) => RealtimeFeedback
  analyzeNative?: (keypoints: MoveNetKeypoint[]) => RealtimeFeedback
  setTuning?: (next: Partial<Squat17Tuning>) => void
  setTempo?: (next: Partial<Squat17Tempo>) => void
  setAnalyzerFps?: (fps: number) => void
  resetSession: () => void
}

export type { Squat17Tuning, Squat17Tempo }

export const VIDEO_DEFAULT_SQUAT17_TUNING: Squat17Tuning = {
  kneeForwardWarnRatio: 0.05,
  kneeForwardFailRatio: 0.065,
  kneeForwardFailMinFrames: 2,
  forwardLeanWarnDeg: 40,
  forwardLeanFailDeg: 53,
  forwardLeanFailMinFrames: 2,
  trackingQualityMin: 0.28
}

