import type { NormalizedLandmark } from './mediapipePose'

export type BoxNorm = { x: number; y: number; w: number; h: number }
export type DistanceLabel = 'too_close' | 'ok' | 'too_far' | 'unknown'
export type DistanceMethod = 'world_landmarks' | 'landmark_z' | 'scale_2d' | 'none'

export type DistanceState = {
  status: 'calibrating' | 'ready' | 'lost'
  prepProgress: number
  prepRemainingMs: number
  label: DistanceLabel
  method: DistanceMethod
  ratio: number | null
  accuracyHint: string | null
  targetBox: BoxNorm | null
  currentBox: BoxNorm | null
}

type Baseline = {
  ratio: number
  box: BoxNorm
  method: Exclude<DistanceMethod, 'none'>
}

export class DistanceTracker {
  private prepDurationMs: number
  private startMs: number | null = null
  private baseline: Baseline | null = null
  private lastMethod: DistanceMethod = 'none'

  constructor(prepDurationMs = 4000) {
    this.prepDurationMs = prepDurationMs
  }

  reset() {
    this.startMs = null
    this.baseline = null
    this.lastMethod = 'none'
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
        method: this.lastMethod,
        ratio: null,
        accuracyHint: accuracyHint(this.lastMethod),
        targetBox: this.baseline?.box ?? null,
        currentBox
      }
    }

    const measures = computeMeasures(input.landmarks, input.worldLandmarks)
    this.lastMethod = measures.method

    const ratio = measures.ratio
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) {
      return {
        status: prepProgress < 1 || !this.baseline ? 'calibrating' : 'ready',
        prepProgress,
        prepRemainingMs,
        label: 'unknown',
        method: measures.method,
        ratio: null,
        accuracyHint: accuracyHint(measures.method),
        targetBox: this.baseline?.box ?? null,
        currentBox
      }
    }

    if (!this.baseline) {
      this.baseline = { ratio, box: currentBox, method: measures.method === 'none' ? 'scale_2d' : measures.method }
    } else if (prepProgress < 1) {
      const alpha = 0.08
      this.baseline = {
        ratio: lerp(this.baseline.ratio, ratio, alpha),
        box: lerpBox(this.baseline.box, currentBox, alpha),
        method: this.baseline.method
      }
    }

    const ready = prepProgress >= 1 && !!this.baseline
    const status = ready ? 'ready' : 'calibrating'

    const rel = this.baseline ? ratio / Math.max(1e-6, this.baseline.ratio) : 1
    const label: DistanceLabel = ready ? (rel > 1.18 ? 'too_close' : rel < 0.85 ? 'too_far' : 'ok') : 'unknown'

    return {
      status,
      prepProgress,
      prepRemainingMs,
      label,
      method: measures.method,
      ratio,
      accuracyHint: accuracyHint(measures.method),
      targetBox: this.baseline?.box ?? null,
      currentBox
    }
  }
}

function computeMeasures(landmarks: NormalizedLandmark[], worldLandmarks: NormalizedLandmark[] | null) {
  const ls = landmarks[11]
  const rs = landmarks[12]
  const lh = landmarks[23]
  const rh = landmarks[24]

  const shoulder2d = dist2(ls, rs)
  const box = bboxFromLandmarks(landmarks)
  const boxH = box ? box.h : null

  const wl = worldLandmarks?.[11]
  const wr = worldLandmarks?.[12]
  const shoulderWorld = dist3(wl, wr)
  if (typeof shoulderWorld === 'number' && Number.isFinite(shoulderWorld) && shoulderWorld > 1e-6 && typeof shoulder2d === 'number' && shoulder2d > 1e-6) {
    return { method: 'world_landmarks' as const, ratio: shoulder2d / shoulderWorld }
  }

  const torsoZ = avgFinite([ls?.z, rs?.z, lh?.z, rh?.z].filter((x): x is number => typeof x === 'number'))
  if (typeof torsoZ === 'number' && Number.isFinite(torsoZ) && torsoZ !== 0) {
    return { method: 'landmark_z' as const, ratio: Math.max(1e-6, -torsoZ) }
  }

  const scale2d = Math.max(shoulder2d ?? 0, boxH ?? 0)
  if (Number.isFinite(scale2d) && scale2d > 1e-6) return { method: 'scale_2d' as const, ratio: scale2d }

  return { method: 'none' as const, ratio: null as number | null }
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
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
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

function accuracyHint(method: DistanceMethod) {
  if (method === 'world_landmarks') return 'Distance is estimated using world landmarks + 2D scale (generally more stable).'
  if (method === 'landmark_z') return 'Distance is estimated from relative keypoint Z changes (sensitive to camera placement and pose).'
  if (method === 'scale_2d') return 'Distance is estimated using a 2D scale heuristic (shoulder width / box ratio; sensitive to camera and cropping).'
  return null
}

function dist2(a?: { x: number; y: number }, b?: { x: number; y: number }) {
  if (!a || !b) return null
  if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return null
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function dist3(a?: { x: number; y: number; z: number }, b?: { x: number; y: number; z: number }) {
  if (!a || !b) return null
  if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z) || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z))
    return null
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
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

function avgFinite(values: number[]) {
  const xs = values.filter((x) => Number.isFinite(x))
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
