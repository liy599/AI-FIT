import type { MoveNetName } from '../vision/movenetTracker'

export type PoseAnalyzerFeedback = {
  phase: 'up' | 'descent' | 'bottom' | 'ascent'
  state: 's1' | 's2' | 's3' | null
  mode: 'beginner' | 'pro'
  kneeAngle: number | null
  hipAngle: number | null
  torsoAngle: number | null
  kneeVerticalAngle: number | null
  offsetAngle: number | null
  trackingQuality: number
  isCountingPaused: boolean
  warnings: string[]
  issues: Array<{ message: string; joints: MoveNetName[] }>
  stateSequence: Array<'s2' | 's3'>
  lastRepResult: 'correct' | 'incorrect' | null
  lastRepMessage: string | null
  lastRepReasonCodes: string[]
  lastRepReasonLabels: string[]
  lastRepCorrections: string[]
  correctCount: number
  incorrectCount: number
  repCount: number
  lastRepFrameCount: number | null
  inactiveSeconds: number
  session: {
    totalReps: number
    correctReps: number
    incorrectReps: number
    accuracyPct: number
    unassessedReps?: number
    depthInsufficientCount: number
    kneeOverToeCount: number
    forwardLeanCount: number
    backwardLeanCount: number
    sideViewWarningCount: number
    avgRepDurationSec?: number | null
    fastRepCount?: number
    slowRepCount?: number
  }
}

