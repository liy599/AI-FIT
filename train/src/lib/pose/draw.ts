import { NormalizedLandmark } from './mediapipePose'
import type { DistanceState } from './distanceTracker'
import type { MoveNetName, StableJoint } from './movenetTracker'

const POSE_CONNECTIONS = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [24, 26], [26, 28], [28, 30], [28, 32], [32, 30],
  [23, 25], [25, 27], [27, 29], [27, 31], [31, 29],
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10]
]

export function drawPose(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  errorJoints: number[] = []
) {
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)'

  for (const [i, j] of POSE_CONNECTIONS) {
    const a = landmarks[i]
    const b = landmarks[j]
    if (!a || !b) continue
    if ((a.visibility ?? 1) < 0.3 || (b.visibility ?? 1) < 0.3) continue

    ctx.beginPath()
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke()
  }
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]
    if ((lm.visibility ?? 1) < 0.3) continue

    const isError = errorJoints.includes(i)
    ctx.fillStyle = isError ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 255, 0, 0.9)'
    ctx.beginPath()
    ctx.arc(lm.x * width, lm.y * height, isError ? 8 : 5, 0, 2 * Math.PI)
    ctx.fill()
  }
}

export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  joints: StableJoint[],
  width: number,
  height: number,
  bones: Array<[MoveNetName, MoveNetName]>,
  errorJoints: MoveNetName[] = [],
  errorBones: Array<[MoveNetName, MoveNetName]> = []
) {
  const byName = new Map<MoveNetName, StableJoint>()
  for (const j of joints) byName.set(j.name, j)

  ctx.lineWidth = 4
  const okStroke = 'rgba(34, 197, 94, 0.8)'
  const badStroke = 'rgba(239, 68, 68, 0.9)'
  const badKeys = new Set<string>()
  for (const [a, b] of errorBones) {
    badKeys.add(a < b ? `${a}-${b}` : `${b}-${a}`)
  }

  for (const [aName, bName] of bones) {
    const a = byName.get(aName)
    const b = byName.get(bName)
    if (!a || !b) continue
    if (a.score < 0.2 || b.score < 0.2) continue
    const k = aName < bName ? `${aName}-${bName}` : `${bName}-${aName}`
    ctx.strokeStyle = badKeys.has(k) ? badStroke : okStroke
    ctx.beginPath()
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke()
  }

  for (const j of joints) {
    if (j.score < 0.2) continue
    const isError = errorJoints.includes(j.name)
    ctx.fillStyle = isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)'
    ctx.beginPath()
    ctx.arc(j.x * width, j.y * height, isError ? 7 : 5, 0, 2 * Math.PI)
    ctx.fill()
  }
}

export function drawMidpointSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: StableJoint[],
  width: number,
  height: number,
  color: 'ok' | 'bad' = 'ok'
) {
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

  const midShoulder = getMidpoint('left_shoulder', 'right_shoulder')
  const midHip = getMidpoint('left_hip', 'right_hip')
  const midKnee = getMidpoint('left_knee', 'right_knee')
  const midAnkle = getMidpoint('left_ankle', 'right_ankle')

  const pts = [midShoulder, midHip, midKnee, midAnkle]
  if (!pts.some(Boolean)) return

  ctx.save()
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const stroke = color === 'ok' ? 'rgba(34, 197, 94, 0.92)' : 'rgba(239, 68, 68, 0.92)'
  ctx.strokeStyle = stroke
  ctx.beginPath()
  let started = false
  for (const p of pts) {
    if (!p) continue
    const x = p.x * width
    const y = p.y * height
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
    ctx.arc(p.x * width, p.y * height, 7, 0, 2 * Math.PI)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
  ctx.restore()
}

export function drawDistanceGuide(ctx: CanvasRenderingContext2D, state: DistanceState, width: number, height: number) {
  const target = state.targetBox
  const current = state.currentBox

  if (target) {
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    ctx.strokeRect(target.x * width, target.y * height, target.w * width, target.h * height)
    ctx.restore()
  }

  if (current) {
    const c =
      state.label === 'too_close'
        ? 'rgba(239, 68, 68, 0.95)'
        : state.label === 'too_far'
          ? 'rgba(245, 158, 11, 0.95)'
          : state.label === 'ok'
            ? 'rgba(34, 197, 94, 0.95)'
            : 'rgba(148, 163, 184, 0.95)'
    ctx.save()
    ctx.strokeStyle = c
    ctx.lineWidth = 4
    ctx.setLineDash([])
    ctx.strokeRect(current.x * width, current.y * height, current.w * width, current.h * height)
    ctx.restore()
  }

  const label =
    state.status === 'calibrating'
      ? `Distance calibrating ${Math.round(state.prepProgress * 100)}%`
      : state.status === 'lost'
        ? 'Distance: no stable person detected'
        : state.label === 'too_close'
          ? 'Distance: too close'
          : state.label === 'too_far'
            ? 'Distance: too far'
            : state.label === 'ok'
              ? 'Distance: OK'
              : 'Distance: unknown'

  ctx.save()
  ctx.font = '14px system-ui, -apple-system, Segoe UI, Arial'
  const padX = 10
  const padY = 7
  const textW = Math.ceil(ctx.measureText(label).width)
  const boxW = textW + padX * 2
  const boxH = 30
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
  ctx.fillRect(12, 12, boxW, boxH)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, 12 + padX, 12 + padY + 14)
  ctx.restore()
}
