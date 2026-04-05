import type { NormalizedLandmark } from './mediapipePose'

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

  constructor(prepDurationMs = 4000) {
    this.prepDurationMs = prepDurationMs
  }

  ingest(input: { tMs: number; landmarks: NormalizedLandmark[]; worldLandmarks: NormalizedLandmark[] | null }): DistanceState {
    if (this.startMs === null) this.startMs = input.tMs
    const elapsed = Math.max(0, input.tMs - this.startMs)
    const prepProgress = Math.min(1, elapsed / this.prepDurationMs)
    const prepRemainingMs = Math.max(0, this.prepDurationMs - elapsed)

    const q = avgKeyJointVisibility(input.landmarks)
    const currentBox = bboxFromLandmarks(input.landmarks)
    if (q < 0.2 || !currentBox) {
      return {
        status: 'lost',
        prepProgress,
        prepRemainingMs,
        label: 'unknown',
        ratio: null,
        targetBox: this.baseline?.box ?? null,
        currentBox
      }
    }

    const ratio = Math.max(currentBox.w, currentBox.h)
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
    const rel = this.baseline ? ratio / Math.max(1e-6, this.baseline.ratio) : 1
    const label: DistanceLabel = ready ? (rel > 1.18 ? 'too_close' : rel < 0.85 ? 'too_far' : 'ok') : 'unknown'

    return {
      status: ready ? 'ready' : 'calibrating',
      prepProgress,
      prepRemainingMs,
      label,
      ratio,
      targetBox: this.baseline?.box ?? null,
      currentBox
    }
  }
}

function bboxFromLandmarks(lm: NormalizedLandmark[]): BoxNorm | null {
  const idx = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let n = 0

  for (const i of idx) {
    const p = lm[i]
    if (!p) continue
    const v = typeof p.visibility === 'number' ? p.visibility : 1
    if (!Number.isFinite(v) || v < 0.2) continue
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

function avgKeyJointVisibility(landmarks: NormalizedLandmark[]) {
  const keys = [11, 12, 23, 24, 25, 26, 27, 28]
  let sum = 0
  for (const idx of keys) {
    const v = landmarks[idx]?.visibility ?? 0
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

