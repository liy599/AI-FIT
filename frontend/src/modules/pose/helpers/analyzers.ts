import { SquatVideoAnalyzer, DEFAULT_SQUAT_TUNING, DEFAULT_SQUAT_TEMPO } from '../analyzer/squat'
import { LateralRaiseVideoAnalyzer, DEFAULT_LATERAL_RAISE_TEMPO } from '../analyzer/lateralRaise'
import { PushupVideoAnalyzer } from '../analyzer/pushup'
import { BentOverRowVideoAnalyzer, DEFAULT_BENT_OVER_ROW_TEMPO } from '../analyzer/bentOverRow'
import type { ExerciseSlug, PoseVideoAnalyzer, SquatTempo, SquatTuning } from './types'

type AnalyzerDefaults = {
  tuning?: Partial<SquatTuning>
  tempo?: Partial<SquatTempo>
}

const ANALYZER_DEFAULTS: Partial<Record<ExerciseSlug, AnalyzerDefaults>> = {
  squat: { tuning: DEFAULT_SQUAT_TUNING, tempo: DEFAULT_SQUAT_TEMPO },
  'lateral-raise': { tempo: DEFAULT_LATERAL_RAISE_TEMPO },
  'bent-over-row': { tempo: DEFAULT_BENT_OVER_ROW_TEMPO }
}

export function getAnalyzerDefaults(exerciseSlug: ExerciseSlug): AnalyzerDefaults {
  return ANALYZER_DEFAULTS[exerciseSlug] ?? {}
}

export function configureAnalyzer(
  analyzer: PoseVideoAnalyzer,
  exerciseSlug: ExerciseSlug,
  options: {
    tuningOverride?: Record<string, number>
    analyzerFps?: number
  } = {}
) {
  const defaults = getAnalyzerDefaults(exerciseSlug)
  const tuning = options.tuningOverride ?? (defaults.tuning as Record<string, number> | undefined)
  if (tuning) analyzer.setTuning?.(tuning)
  if (defaults.tempo) analyzer.setTempo?.(defaults.tempo)
  if (typeof options.analyzerFps === 'number') analyzer.setAnalyzerFps?.(options.analyzerFps)
  return analyzer
}

export function createAnalyzer(exerciseSlug: ExerciseSlug): PoseVideoAnalyzer {
  if (exerciseSlug === 'squat') return new SquatVideoAnalyzer()
  if (exerciseSlug === 'lateral-raise') return new LateralRaiseVideoAnalyzer()
  if (exerciseSlug === 'pushup') return new PushupVideoAnalyzer()
  if (exerciseSlug === 'bent-over-row') return new BentOverRowVideoAnalyzer()
  return new SquatVideoAnalyzer()
}
