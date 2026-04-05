import type { PoseFrame } from './mediapipePose'
import { PoseMetricTracker } from './poseMetricTracker'

export type GenericMotionAnalysis = {
  summary: string
  repEstimate: number | null
  coverage: number
  stabilityScore: number
  mobilityScore: number
  rhythmScore: number
  symmetryScore: number
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: number | null }>
  suggestions: string[]
  timeline: Array<{ frame: number; tMs: number; centerY: number | null; shoulderTiltDeg: number | null; kneeFlexDeg: number | null }>
}

export function analyzeGenericMotion(frames: PoseFrame[]): GenericMotionAnalysis {
  const tracker = new PoseMetricTracker({ stabilityWindowMs: 900 })
  const timeline = frames.map((f, idx) => {
    if (!f.landmarks) {
      return { frame: idx, tMs: f.tMs, centerY: null, shoulderTiltDeg: null, kneeFlexDeg: null }
    }
    const lm = f.landmarks
    const ls = lm[11]
    const rs = lm[12]
    const pf = tracker.update(lm, f.tMs)
    const centerY = pf.metrics.centerY
    const shoulderTiltDeg =
      ls && rs
        ? Math.abs((Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180) / Math.PI)
        : null
    const kneeFlexDeg = pf.metrics.kneeAvgDeg
    return { frame: idx, tMs: f.tMs, centerY, shoulderTiltDeg, kneeFlexDeg }
  })

  const validFrames = timeline.filter((x) => x.centerY !== null).length
  const coverage = frames.length > 0 ? validFrames / frames.length : 0
  const centerSeries = timeline.map((x) => x.centerY).filter((x): x is number => x !== null)
  const shoulderSeries = timeline.map((x) => x.shoulderTiltDeg).filter((x): x is number => x !== null)
  const kneeSeries = timeline.map((x) => x.kneeFlexDeg).filter((x): x is number => x !== null)

  const centerStd = std(centerSeries)
  const shoulderStd = std(shoulderSeries)
  const kneeRange = range(kneeSeries)
  const repEstimate = estimateReps(centerSeries)
  const rhythmScore = scoreRhythm(centerSeries)
  const stabilityScore = clamp01(1 - centerStd * 6 - shoulderStd / 150)
  const mobilityScore = clamp01(kneeRange / 70)
  const symmetryScore = clamp01(1 - Math.min(1, shoulderStd / 45))

  const issues: GenericMotionAnalysis['issues'] = []
  const suggestions = new Set<string>()

  if (coverage < 0.6) {
    issues.push({ code: 'LOW_VISIBILITY', severity: 'warning', message: '人体关键点可见率偏低，建议改善光线与机位。', atFrame: null })
    suggestions.add('将摄像头放在胸口高度附近，并保证全身入镜。')
  }
  if (stabilityScore < 0.45) {
    issues.push({ code: 'LOW_STABILITY', severity: 'warning', message: '动作稳定性较低，身体轨迹抖动较明显。', atFrame: null })
    suggestions.add('降低速度，先保证路径稳定，再逐步提高节奏。')
  }
  if (mobilityScore < 0.35) {
    issues.push({ code: 'LOW_RANGE_OF_MOTION', severity: 'warning', message: '关节活动幅度偏小，动作范围可能不足。', atFrame: null })
    suggestions.add('在安全前提下提高动作幅度，并加入针对关节活动度的热身。')
  }
  if (rhythmScore < 0.35) {
    issues.push({ code: 'RHYTHM_UNEVEN', severity: 'info', message: '节奏起伏较大，可进一步优化重复的一致性。', atFrame: null })
    suggestions.add('尝试使用固定节拍（例如 2-1-2）保持一致节奏。')
  }

  const summary =
    repEstimate && repEstimate > 0
      ? `已完成通用动作分析，估计有效重复约 ${repEstimate} 次。`
      : '已完成通用动作分析，未识别到稳定重复结构（可能为计时类或静态动作）。'

  return {
    summary,
    repEstimate,
    coverage: round(coverage, 3),
    stabilityScore: round(stabilityScore, 3),
    mobilityScore: round(mobilityScore, 3),
    rhythmScore: round(rhythmScore, 3),
    symmetryScore: round(symmetryScore, 3),
    issues,
    suggestions: Array.from(suggestions),
    timeline
  }
}

function estimateReps(series: number[]) {
  if (series.length < 20) return null
  const smooth = movingAverage(series, 5)
  let peaks = 0
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] > smooth[i - 1] && smooth[i] > smooth[i + 1]) peaks++
  }
  return peaks > 0 ? peaks : null
}

function scoreRhythm(series: number[]) {
  if (series.length < 20) return 0.5
  const smooth = movingAverage(series, 5)
  const peakIdx: number[] = []
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] > smooth[i - 1] && smooth[i] > smooth[i + 1]) peakIdx.push(i)
  }
  if (peakIdx.length < 3) return 0.5
  const intervals: number[] = []
  for (let i = 1; i < peakIdx.length; i++) intervals.push(peakIdx[i] - peakIdx[i - 1])
  const m = mean(intervals)
  if (!m) return 0.5
  const cv = std(intervals) / m
  return clamp01(1 - cv)
}

function movingAverage(series: number[], size: number) {
  const out: number[] = []
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - size + 1)
    out.push(mean(series.slice(start, i + 1)))
  }
  return out
}

function mean(xs: number[]) {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs: number[]) {
  if (!xs.length) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / xs.length)
}

function range(xs: number[]) {
  if (!xs.length) return 0
  let min = xs[0]
  let max = xs[0]
  for (const x of xs) {
    if (x < min) min = x
    if (x > max) max = x
  }
  return max - min
}

function clamp01(v: number) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function round(v: number, digits: number) {
  const base = 10 ** digits
  return Math.round(v * base) / base
}
