import type { SquatTuning } from '../../../lib/pose/realtimeSquatAnalyzer'
import { POSE_TOOL_MESSAGES, poseToolErrorMessage } from './shared'

export function validateSquatTuningSave(exerciseSlug: string) {
  if (exerciseSlug !== 'squat') return POSE_TOOL_MESSAGES.squatTuningUnsupported
  return null
}

export function resolveSquatTuningSaveMessage(success: boolean, error?: unknown) {
  if (success) return POSE_TOOL_MESSAGES.squatTuningSaved
  return poseToolErrorMessage(error, POSE_TOOL_MESSAGES.squatTuningSaveFailed)
}

export function buildSquatTuningSavePayload(tuning: SquatTuning) {
  return { ...tuning }
}

