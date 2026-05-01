import type { DistanceState } from './distanceTracker'
// LEGACY (MediaPipe 33 landmarks): not used by current PoseTool chain.
// import type { NormalizedLandmark } from './mediapipePose'
import type { MoveNetName, StableJoint } from './movenetTracker'

export function drawUpperLimbSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: StableJoint[],
  width: number,
  height: number,
  color: 'ok' | 'bad' = 'ok',
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false

  const byName = new Map<MoveNetName, StableJoint>()
  for (const j of joints) byName.set(j.name, j)

  const threshold = 0.2
  const resolve = (name: MoveNetName) => {
    const p = byName.get(name)
    if (!p || p.score < threshold) return null
    return { x: p.x, y: p.y }
  }

  const segments: Array<[MoveNetName, MoveNetName]> = [
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'right_shoulder']
  ]

  const stroke = color === 'ok' ? 'rgba(34, 197, 94, 0.92)' : 'rgba(239, 68, 68, 0.92)'
  const jointFill = 'rgba(255, 255, 255, 0.95)'

  ctx.save()
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = stroke

  for (const [aName, bName] of segments) {
    const a = resolve(aName)
    const b = resolve(bName)
    if (!a || !b) continue
    const ax = viewport.x + (mirror ? 1 - a.x : a.x) * viewport.w
    const ay = viewport.y + a.y * viewport.h
    const bx = viewport.x + (mirror ? 1 - b.x : b.x) * viewport.w
    const by = viewport.y + b.y * viewport.h
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }

  const jointNames: MoveNetName[] = [
    'left_shoulder',
    'right_shoulder',
    'left_elbow',
    'right_elbow',
    'left_wrist',
    'right_wrist'
  ]
  for (const name of jointNames) {
    const p = resolve(name)
    if (!p) continue
    const x = viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w
    const y = viewport.y + p.y * viewport.h
    ctx.beginPath()
    ctx.fillStyle = jointFill
    ctx.arc(x, y, 6, 0, 2 * Math.PI)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = stroke
    ctx.stroke()
  }

  ctx.restore()
}

export function drawMidpointSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: StableJoint[],
  width: number,
  height: number,
  color: 'ok' | 'warn' | 'bad' = 'ok',
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false

  const byName = new Map<MoveNetName, StableJoint>()
  for (const j of joints) byName.set(j.name, j)

  const threshold = 0.2
  const getMidpoint = (leftName: MoveNetName, rightName: MoveNetName) => {
    const l = byName.get(leftName)
    const r = byName.get(rightName)
    const lv = !!l && l.score >= threshold
    const rv = !!r && r.score >= threshold
    if (lv && rv) return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 }
    if (lv) return { x: l.x, y: l.y }
    if (rv) return { x: r.x, y: r.y }
    return null
  }

  const pts = [
    getMidpoint('left_shoulder', 'right_shoulder'),
    getMidpoint('left_hip', 'right_hip'),
    getMidpoint('left_knee', 'right_knee'),
    getMidpoint('left_ankle', 'right_ankle')
  ]
  if (!pts.some(Boolean)) return

  ctx.save()
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const stroke = color === 'bad' ? 'rgba(239, 68, 68, 0.92)' : color === 'warn' ? 'rgba(245, 158, 11, 0.92)' : 'rgba(34, 197, 94, 0.92)'
  ctx.strokeStyle = stroke
  ctx.beginPath()
  let started = false
  for (const p of pts) {
    if (!p) continue
    const x = viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w
    const y = viewport.y + p.y * viewport.h
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  for (const p of pts) {
    if (!p) continue
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.arc(viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w, viewport.y + p.y * viewport.h, 7, 0, 2 * Math.PI)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
  ctx.restore()
}

export function drawDistanceGuide(
  ctx: CanvasRenderingContext2D,
  state: DistanceState,
  width: number,
  height: number,
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean; showTarget?: boolean }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false
  const showTarget = opts?.showTarget ?? true
  const current = state.currentBox

  if (showTarget) {
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    // Target guide is the full camera viewport instead of a body-sized box.
    ctx.strokeRect(viewport.x, viewport.y, viewport.w, viewport.h)
    ctx.restore()
  }

  if (current) {
    const c =
      state.label === 'too_close'
        ? 'rgba(245, 158, 11, 0.95)'
        : state.label === 'too_far'
          ? 'rgba(239, 68, 68, 0.95)'
          : state.label === 'ok'
            ? 'rgba(34, 197, 94, 0.95)'
            : 'rgba(148, 163, 184, 0.95)'
    ctx.save()
    ctx.strokeStyle = c
    ctx.lineWidth = 4
    ctx.setLineDash([])
    const x = mirror ? 1 - current.x - current.w : current.x
    ctx.strokeRect(viewport.x + x * viewport.w, viewport.y + current.y * viewport.h, current.w * viewport.w, current.h * viewport.h)
    ctx.restore()
  }
}

/*
const POSE_CONNECTIONS_33: Array<[number, number]> = [
  [0, 2],
  [0, 5],
  [2, 7],
  [5, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32]
]

export function drawPoseLandmarks33(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  color: 'ok' | 'warn' | 'bad' = 'ok',
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean; minVisibility?: number }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false
  const minVisibility = opts?.minVisibility ?? 0.12
  const stroke = color === 'bad' ? 'rgba(239, 68, 68, 0.9)' : color === 'warn' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(34, 197, 94, 0.85)'

  const toCanvas = (p: NormalizedLandmark) => ({
    x: viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w,
    y: viewport.y + p.y * viewport.h
  })

  ctx.save()
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = stroke

  for (const [a, b] of POSE_CONNECTIONS_33) {
    const p1 = landmarks[a]
    const p2 = landmarks[b]
    const v1 = p1?.visibility ?? 0
    const v2 = p2?.visibility ?? 0
    if (!p1 || !p2 || v1 < minVisibility || v2 < minVisibility) continue
    const c1 = toCanvas(p1)
    const c2 = toCanvas(p2)
    ctx.beginPath()
    ctx.moveTo(c1.x, c1.y)
    ctx.lineTo(c2.x, c2.y)
    ctx.stroke()
  }

  for (const p of landmarks) {
    const v = p?.visibility ?? 0
    if (!p || v < minVisibility) continue
    const c = toCanvas(p)
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.arc(c.x, c.y, 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = stroke
    ctx.stroke()
  }

  ctx.restore()
}
*/

const POSE_CONNECTIONS_17: Array<[MoveNetName, MoveNetName]> = [
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
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

export function drawPoseJoints17(
  ctx: CanvasRenderingContext2D,
  joints: StableJoint[],
  width: number,
  height: number,
  color: 'ok' | 'warn' | 'bad' = 'ok',
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean; minScore?: number }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false
  const minScore = opts?.minScore ?? 0.12
  const stroke = color === 'bad' ? 'rgba(239, 68, 68, 0.9)' : color === 'warn' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(34, 197, 94, 0.85)'

  const byName = new Map<MoveNetName, StableJoint>()
  for (const j of joints) byName.set(j.name, j)

  ctx.save()
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = stroke

  for (const [a, b] of POSE_CONNECTIONS_17) {
    const p1 = byName.get(a)
    const p2 = byName.get(b)
    if (!p1 || !p2 || p1.score < minScore || p2.score < minScore) continue
    const x1 = viewport.x + (mirror ? 1 - p1.x : p1.x) * viewport.w
    const y1 = viewport.y + p1.y * viewport.h
    const x2 = viewport.x + (mirror ? 1 - p2.x : p2.x) * viewport.w
    const y2 = viewport.y + p2.y * viewport.h
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  for (const p of joints) {
    if (p.score < minScore) continue
    const x = viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w
    const y = viewport.y + p.y * viewport.h
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = stroke
    ctx.stroke()
  }

  ctx.restore()
}
