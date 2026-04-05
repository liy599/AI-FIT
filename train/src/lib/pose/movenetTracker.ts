import type { NormalizedLandmark } from './mediapipePose'

export const MOVENET_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
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
] as const

export type MoveNetName = (typeof MOVENET_NAMES)[number]

export type MoveNetKeypoint = {
  name: MoveNetName
  x: number
  y: number
  score: number
}

export type MoveNetFrame = {
  tMs: number
  keypoints: MoveNetKeypoint[]
}

export type StableJoint = {
  name: MoveNetName
  x: number
  y: number
  score: number
}

export type TrackingState = {
  status: 'calibrating' | 'tracking' | 'lost'
  prepProgress: number
  prepRemainingMs: number
  joints2d: StableJoint[]
  history2d: Array<{ tMs: number; joints: StableJoint[] }>
}

const MP_TO_MOVENET_MAP: Record<MoveNetName, number> = {
  nose: 0,
  left_eye: 2,
  right_eye: 5,
  left_ear: 7,
  right_ear: 8,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28
}

type Baseline = {
  shoulderWidth: number
  hipWidth: number
  torsoHeight: number
}

const STICK_BONES: Array<[MoveNetName, MoveNetName]> = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle']
]

export class MoveNetStabilizer {
  private prepDurationMs: number
  private calibrationStartMs: number | null = null
  private baseline: Baseline | null = null
  private prev = new Map<MoveNetName, StableJoint>()
  private history2d: Array<{ tMs: number; joints: StableJoint[] }> = []

  constructor(prepDurationMs = 3500) {
    this.prepDurationMs = prepDurationMs
  }

  reset() {
    this.calibrationStartMs = null
    this.baseline = null
    this.prev.clear()
    this.history2d = []
  }

  ingest(frame: MoveNetFrame): TrackingState {
    if (this.calibrationStartMs === null) this.calibrationStartMs = frame.tMs
    const elapsed = Math.max(0, frame.tMs - this.calibrationStartMs)
    const prepProgress = Math.min(1, elapsed / this.prepDurationMs)
    const prepRemainingMs = Math.max(0, this.prepDurationMs - elapsed)

    if (!this.baseline) {
      this.updateCalibration(frame)
    }

    const stable = this.stabilize(frame)
    this.history2d.push({ tMs: frame.tMs, joints: stable.map((j) => ({ ...j })) })
    if (this.history2d.length > 600) this.history2d.shift()

    const confidence = avgScore(stable)
    const status =
      confidence < 0.2
        ? 'lost'
        : prepProgress < 1 || !this.baseline
          ? 'calibrating'
          : 'tracking'

    return {
      status,
      prepProgress,
      prepRemainingMs,
      joints2d: stable,
      history2d: this.history2d
    }
  }

  private updateCalibration(frame: MoveNetFrame) {
    const map = byName(frame.keypoints)
    const ls = map.get('left_shoulder')
    const rs = map.get('right_shoulder')
    const lh = map.get('left_hip')
    const rh = map.get('right_hip')
    if (!ls || !rs || !lh || !rh) return

    const shoulderWidth = dist2(ls, rs)
    const hipWidth = dist2(lh, rh)
    const torsoHeight = dist2(midpoint(ls, rs), midpoint(lh, rh))
    if (shoulderWidth <= 1e-6 || torsoHeight <= 1e-6) return

    if (!this.baseline) {
      this.baseline = { shoulderWidth, hipWidth, torsoHeight }
      return
    }

    const alpha = 0.08
    this.baseline = {
      shoulderWidth: lerp(this.baseline.shoulderWidth, shoulderWidth, alpha),
      hipWidth: lerp(this.baseline.hipWidth, hipWidth, alpha),
      torsoHeight: lerp(this.baseline.torsoHeight, torsoHeight, alpha)
    }
  }

  private stabilize(frame: MoveNetFrame) {
    const out: StableJoint[] = []
    const map = byName(frame.keypoints)
    const ls = map.get('left_shoulder')
    const rs = map.get('right_shoulder')
    const shoulderWidth = ls && rs ? Math.max(0.03, Math.hypot(ls.x - rs.x, ls.y - rs.y)) : 0.12
    const maxSpeed = shoulderWidth * 0.55

    for (const name of MOVENET_NAMES) {
      const next = map.get(name)
      const prev = this.prev.get(name)
      if (!next && prev) {
        out.push(prev)
        continue
      }
      if (!next) continue

      const alpha = next.score >= 0.6 ? 0.5 : 0.22
      const merged = prev
        ? {
            name,
            x: clampDelta(lerp(prev.x, next.x, alpha), prev.x, maxSpeed),
            y: clampDelta(lerp(prev.y, next.y, alpha), prev.y, maxSpeed),
            score: lerp(prev.score, next.score, 0.5)
          }
        : next
      this.prev.set(name, merged)
      out.push(merged)
    }
    return out
  }
}

export function mediapipeToMoveNetFrame(landmarks: NormalizedLandmark[], tMs: number): MoveNetFrame {
  const keypoints: MoveNetKeypoint[] = MOVENET_NAMES.map((name) => {
    const idx = MP_TO_MOVENET_MAP[name]
    const src = landmarks[idx]
    return {
      name,
      x: src?.x ?? 0,
      y: src?.y ?? 0,
      score: src?.visibility ?? 0
    }
  })
  return { tMs, keypoints }
}

export function getStickBones() {
  return STICK_BONES
}

function byName(keypoints: MoveNetKeypoint[]) {
  const map = new Map<MoveNetName, MoveNetKeypoint>()
  for (const p of keypoints) map.set(p.name, p)
  return map
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clampDelta(next: number, base: number, maxDelta: number) {
  const d = next - base
  if (Math.abs(d) <= maxDelta) return next
  return base + Math.sign(d) * maxDelta
}

function avgScore(joints: StableJoint[]) {
  if (joints.length === 0) return 0
  return joints.reduce((acc, j) => acc + j.score, 0) / joints.length
}
