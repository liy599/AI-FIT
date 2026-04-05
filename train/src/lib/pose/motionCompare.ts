import type { PoseFrame } from './poseFrame'

export type MotionMetricName = keyof PoseFrame['metrics']
export type MotionRule =
  | { op: 'between'; metric: MotionMetricName; min: number; max: number }
  | { op: 'gte'; metric: MotionMetricName; value: number }
  | { op: 'lte'; metric: MotionMetricName; value: number }

export type MotionScoring = {
  distanceScale: number
}

export type MotionTarget = {
  id: string
  label: string
  weight: number
  rule: MotionRule
  cueIncrease: string
  cueDecrease: string
}

export type MotionPhase = {
  id: string
  label: string
  entry: MotionRule
  exit: MotionRule
  targets: MotionTarget[]
}

export type MotionStandard = {
  id: string
  name: string
  minQuality: number
  scoring?: MotionScoring
  phases: MotionPhase[]
}

export type MotionTargetResult = {
  targetId: string
  label: string
  score: number
  direction: 'increase' | 'decrease' | 'ok' | 'unknown'
  cue: string
  value: number | null
  rule: MotionRule
}

export type MotionCompareOutput = {
  standardId: string
  phaseId: string
  phaseLabel: string
  overallScore: number
  errorCount: number
  targets: MotionTargetResult[]
  highlights: MotionTargetResult[]
}

export class MotionComparator {
  private standard: MotionStandard
  private phaseIndex = 0
  private lastScore = 100

  constructor(standard: MotionStandard) {
    this.standard = standard
  }

  evaluate(frame: PoseFrame): MotionCompareOutput | null {
    if (frame.quality < this.standard.minQuality) return null
    const scale = Math.max(1, this.standard.scoring?.distanceScale ?? 30)

    const phase = this.standard.phases[this.phaseIndex]
    if (!phase) return null

    if (evalRule(frame, phase.exit, scale).ok) {
      this.phaseIndex = (this.phaseIndex + 1) % this.standard.phases.length
    }
    const current = this.standard.phases[this.phaseIndex]

    let totalWeight = 0
    let weightedScore = 0
    const targets: MotionTargetResult[] = []
    for (const t of current.targets) {
      const r = evalRule(frame, t.rule, scale)
      const s = scoreOf(r)
      totalWeight += t.weight
      weightedScore += s * t.weight
      const direction = r.direction
      const cue =
        direction === 'increase'
          ? t.cueIncrease
          : direction === 'decrease'
            ? t.cueDecrease
            : direction === 'ok'
              ? 'Looks good — keep going.'
              : 'Low keypoint confidence. Adjust the camera and try again.'
      targets.push({
        targetId: t.id,
        label: t.label,
        score: s,
        direction,
        cue,
        value: r.value,
        rule: t.rule
      })
    }
    const overall = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : this.lastScore
    this.lastScore = overall
    const errorCount = targets.reduce((acc, t) => (t.direction === 'ok' ? acc : acc + 1), 0)
    const highlights = targets
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)

    return {
      standardId: this.standard.id,
      phaseId: current.id,
      phaseLabel: current.label,
      overallScore: overall,
      errorCount,
      targets,
      highlights
    }
  }
}

function evalRule(
  frame: PoseFrame,
  rule: MotionRule,
  distanceScale: number
): { ok: boolean; direction: 'increase' | 'decrease' | 'ok' | 'unknown'; value: number | null; distance: number } {
  const raw = frame.metrics[rule.metric]
  if (typeof raw !== 'number') return { ok: false, direction: 'unknown', value: null, distance: 1 }

  if (rule.op === 'between') {
    if (raw < rule.min) return { ok: false, direction: 'increase', value: raw, distance: Math.min(1, (rule.min - raw) / distanceScale) }
    if (raw > rule.max) return { ok: false, direction: 'decrease', value: raw, distance: Math.min(1, (raw - rule.max) / distanceScale) }
    return { ok: true, direction: 'ok', value: raw, distance: 0 }
  }
  if (rule.op === 'gte') {
    if (raw >= rule.value) return { ok: true, direction: 'ok', value: raw, distance: 0 }
    return { ok: false, direction: 'increase', value: raw, distance: Math.min(1, (rule.value - raw) / distanceScale) }
  }
  if (raw <= rule.value) return { ok: true, direction: 'ok', value: raw, distance: 0 }
  return { ok: false, direction: 'decrease', value: raw, distance: Math.min(1, (raw - rule.value) / distanceScale) }
}

function scoreOf(r: { ok: boolean; distance: number }) {
  if (r.ok) return 100
  return Math.round((1 - Math.max(0, Math.min(1, r.distance))) * 100)
}
