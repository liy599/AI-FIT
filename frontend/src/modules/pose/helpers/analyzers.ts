import { RealtimeSquatAnalyzer } from '../../../lib/pose/realtimeSquatAnalyzer'
import { RealtimeLateralRaiseAnalyzer } from '../../../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../../../lib/pose/realtimePushup'
import { RealtimeBentOverRowAnalyzer, REALTIME_DEFAULT_BENT_OVER_ROW_TEMPO } from '../../../lib/pose/realtimeBentOverRow'
import { REALTIME_DEFAULT_LATERAL_RAISE_TEMPO } from '../../../lib/pose/realtimeLateralRaise'
import { REALTIME_DEFAULT_SQUAT_TEMPO, REALTIME_DEFAULT_SQUAT_TUNING } from '../../../lib/pose/realtimeSquatAnalyzer'
import type { ExerciseSlug, RealtimeAnalyzer, SquatTempo, SquatTuning } from './types'

export type AnalyzerMode = 'live' | 'video'

type AnalyzerDefaults = {
  tuning?: Partial<SquatTuning>
  tempo?: Partial<SquatTempo>
}

const ANALYZER_DEFAULTS_BASE: Partial<Record<ExerciseSlug, AnalyzerDefaults>> = {
  squat: { tuning: REALTIME_DEFAULT_SQUAT_TUNING, tempo: REALTIME_DEFAULT_SQUAT_TEMPO },
  'lateral-raise': { tempo: REALTIME_DEFAULT_LATERAL_RAISE_TEMPO },
  'bent-over-row': { tempo: REALTIME_DEFAULT_BENT_OVER_ROW_TEMPO }
}

const ANALYZER_DEFAULTS_OVERRIDES: Record<AnalyzerMode, Partial<Record<ExerciseSlug, AnalyzerDefaults>>> = {
  live: {},
  video: {}
}

export function getAnalyzerDefaults(exerciseSlug: ExerciseSlug, mode: AnalyzerMode): AnalyzerDefaults {
  const base = ANALYZER_DEFAULTS_BASE[exerciseSlug] ?? {}
  const override = ANALYZER_DEFAULTS_OVERRIDES[mode]?.[exerciseSlug] ?? {}
  return {
    tuning: base.tuning && override.tuning ? { ...base.tuning, ...override.tuning } : override.tuning ?? base.tuning,
    tempo: base.tempo && override.tempo ? { ...base.tempo, ...override.tempo } : override.tempo ?? base.tempo
  }
}

export function configureAnalyzer(
  analyzer: RealtimeAnalyzer,
  exerciseSlug: ExerciseSlug,
  mode: AnalyzerMode,
  options: {
    tuningOverride?: Record<string, number>
    analyzerFps?: number
  } = {}
) {
  const defaults = getAnalyzerDefaults(exerciseSlug, mode)
  const tuning = options.tuningOverride ?? (defaults.tuning as Record<string, number> | undefined)
  if (tuning) analyzer.setTuning?.(tuning)
  if (defaults.tempo) analyzer.setTempo?.(defaults.tempo)
  if (typeof options.analyzerFps === 'number') analyzer.setAnalyzerFps?.(options.analyzerFps)
  return analyzer
}

export function createAnalyzer(exerciseSlug: ExerciseSlug): RealtimeAnalyzer {
  if (exerciseSlug === 'squat') return new RealtimeSquatAnalyzer()
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'bent-over-row') return new RealtimeBentOverRowAnalyzer()
  return new RealtimeSquatAnalyzer()
}



