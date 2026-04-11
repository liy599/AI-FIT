import type { PoseExerciseSlug } from '../exercises'
import type { RealtimeAnalyzer } from './analyzer'
import { RealtimeBenchPressAnalyzer } from '../realtimeBenchPress'
import { RealtimeLateralRaiseAnalyzer } from '../realtimeLateralRaise'
import { RealtimePullupAnalyzer } from '../realtimePullup'
import { RealtimePushupAnalyzer } from '../realtimePushup'
import { RealtimeSquatAnalyzer } from '../realtimeSquat'

export function createAnalyzer(exerciseSlug: PoseExerciseSlug): RealtimeAnalyzer {
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullupAnalyzer()
  if (exerciseSlug === 'bench-press') return new RealtimeBenchPressAnalyzer()
  return new RealtimeSquatAnalyzer()
}

