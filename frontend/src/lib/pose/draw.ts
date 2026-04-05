import type { DistanceState } from './distanceTracker'
import type { MoveNetName, StableJoint } from './movenetTracker'

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
}

