import type { PoseAnalyzerFeedback } from '../analyzer/types'
import type { SquatTempo, SquatTuning } from '../analyzer/squat'
import type { MoveNetKeypoint } from '../vision/movenetTracker'

export type ExerciseSlug = 'squat' | 'lateral-raise' | 'pushup' | 'bent-over-row'

export type SquatTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
  frontAlignmentDeg?: number | null
}

export type SquatRepFinding = {
  repNumber: number
  result: 'correct' | 'incorrect' | 'invalid'
  tier?: 'gate' | 'warning' | 'issue' | 'rep_fail'
  primaryIssue: string
  reasons: string[]
  atFrame: number
  tMs: number
}

export type PoseVideoAnalyzer = {
  analyzeNative: (keypoints: MoveNetKeypoint[]) => PoseAnalyzerFeedback
  setTuning?: (next: Record<string, number>) => void
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


