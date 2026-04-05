import type { NormalizedLandmark, PoseFrame } from './mediapipePose'
import { angleDeg, angleFromVerticalDeg, clamp01, midpointLandmark } from './poseMetrics'

export type SquatPhase = 'up' | 'descent' | 'bottom' | 'ascent'

export type SquatRep = {
  index: number
  startFrame: number
  bottomFrame: number
  endFrame: number
  phases: Array<{ phase: SquatPhase; startFrame: number; endFrame: number }>
  metrics: {
    minKneeAngleDeg: number | null
    minHipAngleDeg: number | null
    minTorsoFromVerticalDeg: number | null
    maxHeelLiftRatio: number | null
    maxKneeOverToeRatio: number | null
  }
  issues: SquatIssue[]
}

export type SquatIssue = {
  code: 'DEPTH_INSUFFICIENT' | 'TORSO_LEAN_EXCESSIVE' | 'KNEE_TOO_FORWARD' | 'HEEL_LIFT' | 'TOP_NOT_LOCKED'
  severity: 'warning' | 'error'
  message: string
  atFrame: number
}

export type SquatSideAnalysis = {
  reps: SquatRep[]
  timeline: Array<{
    frame: number
    tMs: number
    phase: SquatPhase | null
    kneeAngleDeg: number | null
    hipAngleDeg: number | null
    torsoFromVerticalDeg: number | null
    heelLiftRatio: number | null
    kneeOverToeRatio: number | null
  }>
  summary: string
  issues: SquatIssue[]
  suggestions: string[]
}

type Side = 'left' | 'right'

const LM = {
  left: {
    shoulder: 11,
    hip: 23,
    knee: 25,
    ankle: 27,
    heel: 29,
    footIndex: 31
  },
  right: {
    shoulder: 12,
    hip: 24,
    knee: 26,
    ankle: 28,
    heel: 30,
    footIndex: 32
  }
} as const

export function analyzeSquatSide(frames: PoseFrame[]): SquatSideAnalysis {
  const side = chooseSide(frames)
  type TimelineRow = SquatSideAnalysis['timeline'][number]
  const timeline: TimelineRow[] = frames.map((f, i) => {
    if (!f.landmarks) {
      return {
        frame: i,
        tMs: f.tMs,
        phase: null,
        kneeAngleDeg: null,
        hipAngleDeg: null,
        torsoFromVerticalDeg: null,
        heelLiftRatio: null,
        kneeOverToeRatio: null
      }
    }

    const m = computeMetrics(f.landmarks, side)
    return {
      frame: i,
      tMs: f.tMs,
      phase: null,
      ...m
    }
  })

  const { reps, phasesByFrame } = segmentReps(timeline)
  for (const p of phasesByFrame) {
    const row = timeline[p.frame]
    if (row) row.phase = p.phase
  }

  const issues: SquatIssue[] = []
  const suggestions = new Set<string>()

  for (const rep of reps) {
    for (const iss of rep.issues) issues.push(iss)
    for (const s of suggestFromRep(rep)) suggestions.add(s)
  }

  const summary = reps.length
    ? `识别到 ${reps.length} 次深蹲（侧面），已生成阶段与规则反馈。`
    : '未识别到完整深蹲重复（侧面）。'

  return { reps, timeline, summary, issues, suggestions: Array.from(suggestions) }
}

function chooseSide(frames: PoseFrame[]): Side {
  let left = 0
  let right = 0
  let leftN = 0
  let rightN = 0
  for (const f of frames) {
    const lm = f.landmarks
    if (!lm) continue
    const l = [LM.left.shoulder, LM.left.hip, LM.left.knee, LM.left.ankle].map((i) => lm[i]).filter(Boolean)
    const r = [LM.right.shoulder, LM.right.hip, LM.right.knee, LM.right.ankle].map((i) => lm[i]).filter(Boolean)
    for (const p of l) {
      const v = typeof p.visibility === 'number' ? p.visibility : 1
      left += v
      leftN++
    }
    for (const p of r) {
      const v = typeof p.visibility === 'number' ? p.visibility : 1
      right += v
      rightN++
    }
  }
  const leftAvg = leftN ? left / leftN : 0
  const rightAvg = rightN ? right / rightN : 0
  return rightAvg > leftAvg ? 'right' : 'left'
}

function computeMetrics(lm: NormalizedLandmark[], side: Side) {
  const idx = LM[side]
  const shoulder = lm[idx.shoulder]
  const hip = lm[idx.hip]
  const knee = lm[idx.knee]
  const ankle = lm[idx.ankle]
  const heel = lm[idx.heel]
  const footIndex = lm[idx.footIndex]

  const midShoulder = midpointLandmark(lm[11], lm[12])
  const midHip = midpointLandmark(lm[23], lm[24])
  const midKnee = midpointLandmark(lm[25], lm[26])
  const midAnkle = midpointLandmark(lm[27], lm[28])

  const kneeAngleDeg = angleDeg(midHip, midKnee, midAnkle) ?? angleDeg(hip, knee, ankle)
  const hipAngleDeg = angleDeg(midShoulder, midHip, midKnee) ?? angleDeg(shoulder, hip, knee)
  const torsoFromVerticalDeg = angleFromVerticalDeg(midShoulder, midHip) ?? angleFromVerticalDeg(shoulder, hip)

  const heelLiftRatio = heel && ankle ? clamp01((heel.y - ankle.y) * -1) : null

  const kneeOverToeRatio = knee && footIndex ? signedForwardDiffRatio(knee, footIndex, hip, ankle) : null

  return {
    kneeAngleDeg,
    hipAngleDeg,
    torsoFromVerticalDeg,
    heelLiftRatio,
    kneeOverToeRatio
  }
}

function segmentReps(timeline: Array<{ frame: number; tMs: number; kneeAngleDeg: number | null; hipAngleDeg: number | null; torsoFromVerticalDeg: number | null; heelLiftRatio: number | null; kneeOverToeRatio: number | null }>): {
  reps: SquatRep[]
  phasesByFrame: Array<{ frame: number; phase: SquatPhase }>
} {
  const reps: SquatRep[] = []
  const phasesByFrame: Array<{ frame: number; phase: SquatPhase }> = []

  let state: 'WAIT_UP' | 'DESCENT' | 'ASCENT' = 'WAIT_UP'
  let startFrame = -1
  let bottomFrame = -1
  let minKnee = Infinity
  let minHip = Infinity
  let minTorso = Infinity
  let maxHeelLift = 0
  let maxKneeOverToe = 0

  let lastKnee: number | null = null

  function isUp(row: (typeof timeline)[number]) {
    if (row.kneeAngleDeg === null || row.hipAngleDeg === null) return false
    return row.kneeAngleDeg >= 165 && row.hipAngleDeg >= 155
  }

  function isBottomLike(row: (typeof timeline)[number]) {
    if (row.kneeAngleDeg === null) return false
    return row.kneeAngleDeg <= 105
  }

  function updateMinMax(row: (typeof timeline)[number], frame: number) {
    if (row.kneeAngleDeg !== null && row.kneeAngleDeg < minKnee) {
      minKnee = row.kneeAngleDeg
      bottomFrame = frame
    }
    if (row.hipAngleDeg !== null) minHip = Math.min(minHip, row.hipAngleDeg)
    if (row.torsoFromVerticalDeg !== null) minTorso = Math.min(minTorso, row.torsoFromVerticalDeg)
    if (row.heelLiftRatio !== null) maxHeelLift = Math.max(maxHeelLift, row.heelLiftRatio)
    if (row.kneeOverToeRatio !== null) maxKneeOverToe = Math.max(maxKneeOverToe, row.kneeOverToeRatio)
  }

  for (let i = 0; i < timeline.length; i++) {
    const row = timeline[i]
    const knee = row.kneeAngleDeg

    if (state === 'WAIT_UP') {
      phasesByFrame.push({ frame: i, phase: 'up' })
      if (isUp(row)) {
        if (knee !== null) lastKnee = knee
        continue
      }
      if (knee !== null && lastKnee !== null && knee < lastKnee - 2) {
        state = 'DESCENT'
        startFrame = Math.max(0, i - 1)
        bottomFrame = i
        minKnee = Infinity
        minHip = Infinity
        minTorso = Infinity
        maxHeelLift = 0
        maxKneeOverToe = 0
      }
    } else if (state === 'DESCENT') {
      phasesByFrame.push({ frame: i, phase: isBottomLike(row) ? 'bottom' : 'descent' })
      updateMinMax(row, i)
      if (isBottomLike(row)) {
        continue
      }
      if (knee !== null && minKnee < Infinity && knee > minKnee + 3) {
        state = 'ASCENT'
      }
    } else {
      phasesByFrame.push({ frame: i, phase: 'ascent' })
      updateMinMax(row, i)
      if (isUp(row) && startFrame >= 0 && bottomFrame >= 0) {
        const endFrame = i
        const rep = buildRep(reps.length, timeline, startFrame, bottomFrame, endFrame, {
          minKnee: minKnee < Infinity ? minKnee : null,
          minHip: minHip < Infinity ? minHip : null,
          minTorso: minTorso < Infinity ? minTorso : null,
          maxHeelLift: maxHeelLift || null,
          maxKneeOverToe: maxKneeOverToe || null
        })
        reps.push(rep)
        state = 'WAIT_UP'
        startFrame = -1
        bottomFrame = -1
        minKnee = Infinity
        minHip = Infinity
        minTorso = Infinity
        maxHeelLift = 0
        maxKneeOverToe = 0
      }
    }

    if (knee !== null) lastKnee = knee
  }

  return { reps, phasesByFrame }
}

function buildRep(
  index: number,
  timeline: Array<{ kneeAngleDeg: number | null; hipAngleDeg: number | null; torsoFromVerticalDeg: number | null; heelLiftRatio: number | null; kneeOverToeRatio: number | null }>,
  startFrame: number,
  bottomFrame: number,
  endFrame: number,
  metrics: { minKnee: number | null; minHip: number | null; minTorso: number | null; maxHeelLift: number | null; maxKneeOverToe: number | null }
): SquatRep {
  const issues: SquatIssue[] = []

  if (metrics.minKnee !== null && metrics.minKnee > 115) {
    issues.push({
      code: 'DEPTH_INSUFFICIENT',
      severity: 'warning',
      message: `下蹲深度可能不足（最小膝角约 ${Math.round(metrics.minKnee)}°）`,
      atFrame: bottomFrame
    })
  }

  if (metrics.minTorso !== null && metrics.minTorso < 25) {
    issues.push({
      code: 'TORSO_LEAN_EXCESSIVE',
      severity: 'warning',
      message: `躯干前倾较大（躯干与竖直夹角最小约 ${Math.round(metrics.minTorso)}°）`,
      atFrame: bottomFrame
    })
  }

  if (metrics.maxKneeOverToe !== null && metrics.maxKneeOverToe > 0.06) {
    issues.push({
      code: 'KNEE_TOO_FORWARD',
      severity: 'warning',
      message: '膝盖可能明显超过脚尖（侧面估计）',
      atFrame: bottomFrame
    })
  }

  if (metrics.maxHeelLift !== null && metrics.maxHeelLift > 0.04) {
    issues.push({
      code: 'HEEL_LIFT',
      severity: 'warning',
      message: '疑似出现提踵（足跟上抬）',
      atFrame: bottomFrame
    })
  }

  const topRow = timeline[endFrame]
  if (topRow?.kneeAngleDeg !== null && topRow.kneeAngleDeg < 160) {
    issues.push({
      code: 'TOP_NOT_LOCKED',
      severity: 'warning',
      message: '顶端可能未完全伸展（未锁定）',
      atFrame: endFrame
    })
  }

  const phases: Array<{ phase: SquatPhase; startFrame: number; endFrame: number }> = [
    { phase: 'up', startFrame, endFrame: Math.max(startFrame, startFrame) },
    { phase: 'descent', startFrame, endFrame: Math.max(startFrame, bottomFrame) },
    { phase: 'bottom', startFrame: bottomFrame, endFrame: bottomFrame },
    { phase: 'ascent', startFrame: bottomFrame, endFrame }
  ]

  return {
    index,
    startFrame,
    bottomFrame,
    endFrame,
    phases,
    metrics: {
      minKneeAngleDeg: metrics.minKnee,
      minHipAngleDeg: metrics.minHip,
      minTorsoFromVerticalDeg: metrics.minTorso,
      maxHeelLiftRatio: metrics.maxHeelLift,
      maxKneeOverToeRatio: metrics.maxKneeOverToe
    },
    issues
  }
}

function suggestFromRep(rep: SquatRep): string[] {
  const out: string[] = []
  for (const iss of rep.issues) {
    if (iss.code === 'DEPTH_INSUFFICIENT') out.push('尝试降低深度目标：髋部接近/低于膝关节高度，并保证动作可控。')
    if (iss.code === 'TORSO_LEAN_EXCESSIVE') out.push('躯干前倾较大时，尝试收紧核心、调整站距与髋后坐路径。')
    if (iss.code === 'KNEE_TOO_FORWARD') out.push('膝盖明显前移时，尝试更早后坐髋部并保持足底三点受力。')
    if (iss.code === 'HEEL_LIFT') out.push('出现提踵时，尝试降低深度或调整踝背屈能力/鞋跟高度。')
    if (iss.code === 'TOP_NOT_LOCKED') out.push('每次重复顶端尽量稳定伸髋伸膝至自然站直。')
  }
  return out
}

function signedForwardDiffRatio(a: NormalizedLandmark, b: NormalizedLandmark, hip: NormalizedLandmark | undefined, ankle: NormalizedLandmark | undefined): number | null {
  if (!hip || !ankle) return null
  const dir = Math.sign((ankle.x - hip.x) || 1)
  const diff = (a.x - b.x) * dir
  return diff
}
