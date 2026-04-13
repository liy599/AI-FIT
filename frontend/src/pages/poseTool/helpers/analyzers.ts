import { RealtimeSquat17Analyzer } from '../../../lib/pose/realtimeSquat17'
import { RealtimeLateralRaiseAnalyzer } from '../../../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../../../lib/pose/realtimePushup'
import { RealtimePullupAnalyzer } from '../../../lib/pose/realtimePullup'
import { RealtimeBenchPressAnalyzer } from '../../../lib/pose/realtimeBenchPress'
import type { ExerciseSlug, RealtimeAnalyzer } from './types'

export function createAnalyzer(exerciseSlug: ExerciseSlug): RealtimeAnalyzer {
  if (exerciseSlug === 'squat') return new RealtimeSquat17Analyzer()
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullupAnalyzer()
  if (exerciseSlug === 'bench-press') return new RealtimeBenchPressAnalyzer()
  return new RealtimeSquat17Analyzer()
}

