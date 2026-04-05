import type { PoseFrame } from './poseFrame'

export type MotionMetricName = keyof PoseFrame['metrics']
export type MotionRule =
  | { op: 'between'; metric: MotionMetricName; min: number; max: number }
  | { op: 'gte'; metric: MotionMetricName; value: number }
  | { op: 'lte'; metric: MotionMetricName; value: number }

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
  scoring?: { distanceScale: number }
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
    for (const target of current.targets) {
      const result = evalRule(frame, target.rule, scale)
      const score = scoreOf(result)
      totalWeight += target.weight
      weightedScore += score * target.weight
      const direction = result.direction
      const cue =
        direction === 'increase'
          ? target.cueIncrease
          : direction === 'decrease'
            ? target.cueDecrease
            : direction === 'ok'
              ? 'Looks good, keep going.'
              : 'Low keypoint confidence. Adjust the camera and try again.'
      targets.push({
        targetId: target.id,
        label: target.label,
        score,
        direction,
        cue,
        value: result.value,
        rule: target.rule
      })
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : this.lastScore
    this.lastScore = overallScore
    const errorCount = targets.reduce((count, target) => (target.direction === 'ok' ? count : count + 1), 0)

    return {
      standardId: this.standard.id,
      phaseId: current.id,
      phaseLabel: current.label,
      overallScore,
      errorCount,
      targets,
      highlights: targets.slice().sort((a, b) => a.score - b.score).slice(0, 3)
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

function scoreOf(result: { ok: boolean; distance: number }) {
  if (result.ok) return 100
  return Math.round((1 - Math.max(0, Math.min(1, result.distance))) * 100)
}
