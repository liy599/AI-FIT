import type { NormalizedLandmark } from '../mediapipePose'
import type { CoachMode, RealtimeFeedback } from '../realtimeSquat'

export type AnalyzerFrameInput = {
  landmarks: NormalizedLandmark[]
  gatePaused: boolean
}

export type RealtimeAnalyzer = {
  analyzeFrame: (input: AnalyzerFrameInput) => RealtimeFeedback
  resetSession: () => void
  setMode?: (mode: CoachMode) => void
}

