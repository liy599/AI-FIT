import type { DistanceState } from './distanceTracker'
import type { NormalizedLandmark } from './mediapipePose'
import type { MoveNetName, StableJoint } from './movenetTracker'

export function drawMidpointSkeleton(
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
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean }
) {
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false
  const target = state.targetBox
  const current = state.currentBox

  if (target) {
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    const x = mirror ? 1 - target.x - target.w : target.x
    ctx.strokeRect(viewport.x + x * viewport.w, viewport.y + target.y * viewport.h, target.w * viewport.w, target.h * viewport.h)
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
    const x = mirror ? 1 - current.x - current.w : current.x
    ctx.strokeRect(viewport.x + x * viewport.w, viewport.y + current.y * viewport.h, current.w * viewport.w, current.h * viewport.h)
    ctx.restore()
  }
}

type HighlightTone = 'issue' | 'moderate' | 'severe'

export function drawIssueHighlights(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null | undefined,
  highlights: Array<{ joints: number[]; tone: HighlightTone }> | null | undefined,
  width: number,
  height: number,
  opts?: { viewport?: { x: number; y: number; w: number; h: number }; mirror?: boolean }
) {
  if (!landmarks || !highlights || highlights.length === 0) return
  const viewport = opts?.viewport ?? { x: 0, y: 0, w: width, h: height }
  const mirror = opts?.mirror ?? false

  const visThreshold = 0.15
  const pointFor = (idx: number) => {
    const p = landmarks[idx]
    if (!p) return null
    const v = typeof p.visibility === 'number' ? p.visibility : 1
    if (v < visThreshold) return null
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
    return { x: p.x, y: p.y }
  }

  const sevForTone = (tone: HighlightTone) => (tone === 'moderate' ? 2 : 3)
  const colorForSev = (sev: number) => (sev >= 3 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)')

  const EDGES: Array<[number, number]> = [
    [11, 12],
    [23, 24],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
    [27, 29],
    [29, 31],
    [27, 31],
    [28, 30],
    [30, 32],
    [28, 32]
  ]

  const jointSev = new Map<number, number>()
  const segmentSev = new Map<string, { a: number; b: number; sev: number }>()
  const arrowKeys = new Set<string>()

  for (const h of highlights) {
    const sev = sevForTone(h.tone)
    const jointSet = new Set<number>(h.joints.filter((x) => Number.isFinite(x)))

    for (const idx of jointSet) {
      const prev = jointSev.get(idx) ?? 0
      if (sev > prev) jointSev.set(idx, sev)
    }

    const candidates: Array<{ key: string; a: number; b: number; len2: number }> = []
    for (const [a, b] of EDGES) {
      if (!jointSet.has(a) || !jointSet.has(b)) continue
      const pa = pointFor(a)
      const pb = pointFor(b)
      if (!pa || !pb) continue
      const ax = viewport.x + (mirror ? 1 - pa.x : pa.x) * viewport.w
      const ay = viewport.y + pa.y * viewport.h
      const bx = viewport.x + (mirror ? 1 - pb.x : pb.x) * viewport.w
      const by = viewport.y + pb.y * viewport.h
      const len2 = (ax - bx) * (ax - bx) + (ay - by) * (ay - by)
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const prev = segmentSev.get(key)
      if (!prev || sev > prev.sev) segmentSev.set(key, { a, b, sev })
      candidates.push({ key, a, b, len2 })
    }

    if (candidates.length > 0) {
      candidates.sort((x, y) => y.len2 - x.len2)
      arrowKeys.add(candidates[0].key)
      continue
    }

    let first: number | null = null
    let second: number | null = null
    for (const idx of h.joints) {
      if (pointFor(idx)) {
        if (first === null) first = idx
        else {
          second = idx
          break
        }
      }
    }
    if (first !== null && second !== null) {
      const a = first
      const b = second
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const prev = segmentSev.get(key)
      if (!prev || sev > prev.sev) segmentSev.set(key, { a, b, sev })
      arrowKeys.add(key)
    }
  }

  const radius = Math.max(7, Math.min(14, Math.min(viewport.w, viewport.h) * 0.012))
  const drawArrow = (ax: number, ay: number, bx: number, by: number, color: string) => {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len < 1e-3) return
    const ux = dx / len
    const uy = dy / len
    const size = Math.max(10, Math.min(18, radius * 1.6))
    const ox = bx - ux * radius
    const oy = by - uy * radius
    const angle = Math.atan2(dy, dx)
    const wing = Math.PI / 6
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(3, radius * 0.35)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ox - size * Math.cos(angle - wing), oy - size * Math.sin(angle - wing))
    ctx.moveTo(ox, oy)
    ctx.lineTo(ox - size * Math.cos(angle + wing), oy - size * Math.sin(angle + wing))
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (const seg of segmentSev.values()) {
    const pa = pointFor(seg.a)
    const pb = pointFor(seg.b)
    if (!pa || !pb) continue
    const ax = viewport.x + (mirror ? 1 - pa.x : pa.x) * viewport.w
    const ay = viewport.y + pa.y * viewport.h
    const bx = viewport.x + (mirror ? 1 - pb.x : pb.x) * viewport.w
    const by = viewport.y + pb.y * viewport.h
    const color = colorForSev(seg.sev)
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(4, radius * 0.45)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }

  for (const key of arrowKeys) {
    const seg = segmentSev.get(key)
    if (!seg) continue
    const pa = pointFor(seg.a)
    const pb = pointFor(seg.b)
    if (!pa || !pb) continue
    const ax = viewport.x + (mirror ? 1 - pa.x : pa.x) * viewport.w
    const ay = viewport.y + pa.y * viewport.h
    const bx = viewport.x + (mirror ? 1 - pb.x : pb.x) * viewport.w
    const by = viewport.y + pb.y * viewport.h
    drawArrow(ax, ay, bx, by, colorForSev(seg.sev))
  }

  for (const [idx, sev] of jointSev.entries()) {
    const p = pointFor(idx)
    if (!p) continue
    const x = viewport.x + (mirror ? 1 - p.x : p.x) * viewport.w
    const y = viewport.y + p.y * viewport.h
    const color = colorForSev(sev)

    ctx.beginPath()
    ctx.fillStyle = sev >= 3 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.22)'
    ctx.arc(x, y, radius * 2.4, 0, 2 * Math.PI)
    ctx.fill()

    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fill()

    ctx.lineWidth = Math.max(3, radius * 0.35)
    ctx.strokeStyle = color
    ctx.stroke()
  }

  ctx.restore()
}
