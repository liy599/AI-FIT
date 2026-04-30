import { RealtimeSquatAnalyzer } from '../../../lib/pose/realtimeSquatAnalyzer'
import { RealtimeLateralRaiseAnalyzer } from '../../../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../../../lib/pose/realtimePushup'
import { RealtimePullupAnalyzer } from '../../../lib/pose/realtimePullup'
import type { ExerciseSlug, RealtimeAnalyzer } from './types'

export function createAnalyzer(exerciseSlug: ExerciseSlug): RealtimeAnalyzer {
  if (exerciseSlug === 'squat') return new RealtimeSquatAnalyzer()
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullupAnalyzer()
  return new RealtimeSquatAnalyzer()
}

