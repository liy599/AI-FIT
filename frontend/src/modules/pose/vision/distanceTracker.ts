import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'

export type BoxNorm = { x: number; y: number; w: number; h: number }
export type DistanceLabel = 'too_close' | 'ok' | 'too_far' | 'unknown'

export type DistanceState = {
  status: 'calibrating' | 'ready' | 'lost'
  prepProgress: number
  prepRemainingMs: number
  label: DistanceLabel
  ratio: number | null
  targetBox: BoxNorm | null
  currentBox: BoxNorm | null
}

type Baseline = {
  ratio: number
  box: BoxNorm
}

export class DistanceTracker {
  private prepDurationMs: number
  private startMs: number | null = null
  private baseline: Baseline | null = null
  private ratioEma: number | null = null
  private lastLabel: DistanceLabel = 'unknown'
  private targetRatioFactor = 0.75

  constructor(prepDurationMs = 4000) {
    this.prepDurationMs = prepDurationMs
  }

  recalibrate(tMs?: number) {
    this.startMs = typeof tMs === 'number' && Number.isFinite(tMs) ? tMs : null
    this.baseline = null
    this.ratioEma = null
    this.lastLabel = 'unknown'
  }

  ingest(input: { tMs: number; keypoints: MoveNetKeypoint[] }): DistanceState {
    if (this.startMs === null) this.startMs = input.tMs
    const elapsed = Math.max(0, input.tMs - this.startMs)
    const prepProgress = Math.min(1, elapsed / this.prepDurationMs)
    const prepRemainingMs = Math.max(0, this.prepDurationMs - elapsed)

    const q = avgKeyJointScore(input.keypoints)
    const currentBox = bboxFromKeypoints(input.keypoints)
    if (q < 0.18 || !currentBox) {
      this.lastLabel = 'unknown'
      return {
        status: 'lost',
        prepProgress,
        prepRemainingMs,
        label: 'unknown',
        ratio: null,
        targetBox: this.baseline ? centerBox(this.baseline.box) : null,
        currentBox
      }
    }

    // Use skeleton-chain scale first (shoulder-hip-knee-ankle), fallback to area-based scale.
    // This is more robust to front/side orientation and squat up/down posture changes.
    const rawRatio = bodyScaleFromKeypoints(input.keypoints) ?? Math.sqrt(Math.max(1e-6, currentBox.w * currentBox.h))
    const emaAlpha = 0.2
    this.ratioEma = this.ratioEma === null ? rawRatio : lerp(this.ratioEma, rawRatio, emaAlpha)
    const ratio = this.ratioEma
    if (!this.baseline) {
      this.baseline = { ratio, box: currentBox }
    } else if (prepProgress < 1) {
      const alpha = 0.08
      this.baseline = {
        ratio: lerp(this.baseline.ratio, ratio, alpha),
        box: lerpBox(this.baseline.box, currentBox, alpha)
      }
    }

    const ready = prepProgress >= 1 && !!this.baseline
    const targetRatio = this.baseline ? this.baseline.ratio * this.targetRatioFactor : ratio
    const rel = ratio / Math.max(1e-6, targetRatio)
    const label = ready ? classifyDistanceWithHysteresis(rel, this.lastLabel) : 'unknown'
    this.lastLabel = label

    return {
      status: ready ? 'ready' : 'calibrating',
      prepProgress,
      prepRemainingMs,
      label,
      ratio,
      targetBox: this.baseline ? centerBox(this.baseline.box) : null,
      currentBox
    }
  }
}

function classifyDistanceWithHysteresis(rel: number, prev: DistanceLabel): DistanceLabel {
  // Enter thresholds are wider than recover thresholds to reduce red/orange flicker during reps.
  const TOO_CLOSE_ENTER = 1.55
  const TOO_CLOSE_EXIT = 1.4
  const TOO_FAR_ENTER = 0.45
  const TOO_FAR_EXIT = 0.55

  if (prev === 'too_close') return rel >= TOO_CLOSE_EXIT ? 'too_close' : 'ok'
  if (prev === 'too_far') return rel <= TOO_FAR_EXIT ? 'too_far' : 'ok'
  if (rel > TOO_CLOSE_ENTER) return 'too_close'
  if (rel < TOO_FAR_ENTER) return 'too_far'
  return 'ok'
}

function centerBox(box: BoxNorm): BoxNorm {
  // Keep target guide centered but avoid becoming a too-thin vertical strip.
  const w = Math.min(0.92, Math.max(box.w, 0.28))
  const h = Math.min(0.96, Math.max(box.h, 0.64))
  const x = clamp01(0.5 - w / 2)
  const y = clamp01(0.5 - h / 2)
  const maxX = Math.max(0, 1 - w)
  const maxY = Math.max(0, 1 - h)
  return {
    x: Math.min(x, maxX),
    y: Math.min(y, maxY),
    w,
    h
  }
}

function bboxFromKeypoints(keypoints: MoveNetKeypoint[]): BoxNorm | null {
  const map = byName(keypoints)
  const names: MoveNetName[] = [
    'nose',
    'left_shoulder',
    'right_shoulder',
    'left_elbow',
    'right_elbow',
    'left_wrist',
    'right_wrist',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle'
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let n = 0

  for (const name of names) {
    const p = map.get(name)
    if (!p) continue
    const v = typeof p.score === 'number' ? p.score : 0
    if (!Number.isFinite(v) || v < 0.18) continue
    const x = clamp01(p.x)
    const y = clamp01(p.y)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    n += 1
  }

  if (n < 4) return null
  const w = Math.max(0, maxX - minX)
  const h = Math.max(0, maxY - minY)
  if (w < 0.05 || h < 0.08) return null
  return { x: minX, y: minY, w, h }
}

function bodyScaleFromKeypoints(keypoints: MoveNetKeypoint[]): number | null {
  const map = byName(keypoints)
  const left = chainScale(map, ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'])
  const right = chainScale(map, ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'])
  if (left !== null && right !== null) return (left + right) / 2
  if (left !== null) return left
  if (right !== null) return right
  return null
}

function chainScale(map: Map<MoveNetName, MoveNetKeypoint>, names: [MoveNetName, MoveNetName, MoveNetName, MoveNetName]): number | null {
  const [a, b, c, d] = names.map((name) => map.get(name))
  if (!isVisible(a) || !isVisible(b) || !isVisible(c) || !isVisible(d)) return null
  const ab = dist2d(a, b)
  const bc = dist2d(b, c)
  const cd = dist2d(c, d)
  const total = ab + bc + cd
  return Number.isFinite(total) && total > 1e-6 ? total : null
}

function isVisible(p: MoveNetKeypoint | undefined): p is MoveNetKeypoint {
  if (!p) return false
  const v = typeof p.score === 'number' ? p.score : 0
  return Number.isFinite(v) && v >= 0.18
}

function dist2d(a: MoveNetKeypoint, b: MoveNetKeypoint) {
  const ax = clamp01(a.x)
  const ay = clamp01(a.y)
  const bx = clamp01(b.x)
  const by = clamp01(b.y)
  return Math.hypot(ax - bx, ay - by)
}

function avgKeyJointScore(keypoints: MoveNetKeypoint[]) {
  const map = byName(keypoints)
  const keys: MoveNetName[] = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
  let sum = 0
  for (const name of keys) {
    const v = map.get(name)?.score ?? 0
    sum += Number.isFinite(v) ? clamp01(v) : 0
  }
  return sum / keys.length
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpBox(a: BoxNorm, b: BoxNorm, t: number): BoxNorm {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t)
  }
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function byName(keypoints: MoveNetKeypoint[]) {
  const map = new Map<MoveNetName, MoveNetKeypoint>()
  for (const p of keypoints) map.set(p.name, p)
  return map
}


