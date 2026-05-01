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
}

export class MoveNetStabilizer {
  private prepDurationMs: number
  private calibrationStartMs: number | null = null
  private prev = new Map<MoveNetName, StableJoint>()

  constructor(prepDurationMs = 3500) {
    this.prepDurationMs = prepDurationMs
  }

  reset() {
    this.calibrationStartMs = null
    this.prev.clear()
  }

  ingest(frame: MoveNetFrame): TrackingState {
    if (this.calibrationStartMs === null) this.calibrationStartMs = frame.tMs
    const elapsed = Math.max(0, frame.tMs - this.calibrationStartMs)
    const prepProgress = Math.min(1, elapsed / this.prepDurationMs)
    const prepRemainingMs = Math.max(0, this.prepDurationMs - elapsed)

    const stable = this.stabilize(frame)
    const confidence = avgScore(stable)
    const status = confidence < 0.2 ? 'lost' : prepProgress < 1 ? 'calibrating' : 'tracking'

    return {
      status,
      prepProgress,
      prepRemainingMs,
      joints2d: stable
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

function byName(keypoints: MoveNetKeypoint[]) {
  const map = new Map<MoveNetName, MoveNetKeypoint>()
  for (const p of keypoints) map.set(p.name, p)
  return map
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

