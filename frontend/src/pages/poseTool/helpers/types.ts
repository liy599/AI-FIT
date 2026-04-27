import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import type { SquatTempo, SquatTuning } from '../../../lib/pose/realtimeSquatAnalyzer'
import type { MoveNetKeypoint } from '../../../lib/pose/movenetTracker'

export type ExerciseSlug = 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bent-over-row'

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

export type RealtimeAnalyzer = {
  analyzeNative: (keypoints: MoveNetKeypoint[]) => RealtimeFeedback
  setTuning?: (next: Partial<SquatTuning>) => void
  setTempo?: (next: Partial<SquatTempo>) => void
  setAnalyzerFps?: (fps: number) => void
  resetSession: () => void
}

export type { SquatTuning, SquatTempo }

export const VIDEO_DEFAULT_SQUAT_TUNING: SquatTuning = {
  kneeForwardWarnRatio: 0.05,
  kneeForwardFailRatio: 0.065,
  kneeForwardFailMinFrames: 2,
  forwardLeanWarnDeg: 40,
  forwardLeanFailDeg: 53,
  forwardLeanFailMinFrames: 2,
  trackingQualityMin: 0.28
}

