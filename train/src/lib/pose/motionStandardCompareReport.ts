import type { NormalizedLandmark, PoseFrame as ExtractedFrame } from './mediapipePose'
import { PoseMetricTracker } from './poseMetricTracker'
import { MotionComparator, type MotionStandard } from './motionCompare'

type IssueSeverity = 'info' | 'warning' | 'error'

type TimelineRow = {
  frame: number
  tMs: number
  phaseId: string
  phaseLabel: string
  score: number
  errorCount: number
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
  stabilityScore: number | null
  highlights: Array<{
    targetId: string
    label: string
    direction: 'increase' | 'decrease' | 'ok' | 'unknown'
    cue: string
    value: number | null
    score: number
  }>
}

function avgInt(values: number[]) {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round(sum / values.length)
}

function sampleArray<T>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max <= 0) return []
  if (max === 1) return [items[items.length - 1] as T]

  const idx = new Set<number>()
  idx.add(0)
  idx.add(items.length - 1)
  while (idx.size < max) {
    const t = Math.floor(((idx.size - 1) / (max - 1)) * (items.length - 1))
    idx.add(t)
    if (idx.size >= max) break
    idx.add(Math.floor(items.length / 2))
  }
  return Array.from(idx)
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((i) => items[i] as T)
}

function cueFromStandard(standard: MotionStandard) {
  const out: string[] = []
  for (const p of standard.phases) {
    for (const t of p.targets) {
      if (t.cueIncrease) out.push(t.cueIncrease)
      if (t.cueDecrease) out.push(t.cueDecrease)
    }
  }
  return Array.from(new Set(out)).filter((x) => x.trim().length > 0)
}

export function buildMotionStandardCompareReport(input: {
  taskId: string
  viewAngle: string
  instruction: string | null
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: ExtractedFrame[]
  standard: MotionStandard
}): {
  version: number
  generatedAt: string
  status: 'ok' | 'error'
  task: { id: string; viewAngle: string; instruction: string | null }
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  summary: string
  keyMetrics: Record<string, number | string | null>
  issues: Array<{ code: string; severity: IssueSeverity; message: string; atFrame: number | null }>
  suggestions: string[]
  details: unknown
} {
  const now = new Date()
  const tracker = new PoseMetricTracker({ stabilityWindowMs: 900 })
  const comparator = new MotionComparator(input.standard)
  const timeline: TimelineRow[] = []

  const issueAgg = new Map<
    string,
    { targetId: string; label: string; cue: string; count: number; firstFrame: number; direction: 'increase' | 'decrease' | 'unknown' }
  >()
  let unknownTargetCount = 0

  for (let i = 0; i < input.frames.length; i++) {
    const f = input.frames[i] as ExtractedFrame
    const lm = f.landmarks as NormalizedLandmark[] | null
    if (!lm) continue
    const pf = tracker.update(lm, f.tMs)
    const cmp = comparator.evaluate(pf)
    if (!cmp) continue

    for (const t of cmp.targets) {
      if (t.direction === 'ok') continue
      if (t.direction === 'unknown') {
        unknownTargetCount += 1
        continue
      }
      const key = `${t.targetId}:${t.direction}`
      const prev = issueAgg.get(key)
      if (!prev) {
        issueAgg.set(key, { targetId: t.targetId, label: t.label, cue: t.cue, count: 1, firstFrame: i, direction: t.direction })
      } else {
        prev.count += 1
      }
    }

    timeline.push({
      frame: i,
      tMs: f.tMs,
      phaseId: cmp.phaseId,
      phaseLabel: cmp.phaseLabel,
      score: cmp.overallScore,
      errorCount: cmp.errorCount,
      kneeAngleDeg: pf.metrics.kneeAvgDeg,
      hipAngleDeg: pf.metrics.hipAvgDeg,
      torsoFromVerticalDeg: pf.metrics.torsoInclineAbsDeg,
      stabilityScore: pf.metrics.stabilityScore,
      highlights: cmp.highlights.map((h) => ({
        targetId: h.targetId,
        label: h.label,
        direction: h.direction,
        cue: h.cue,
        value: h.value,
        score: h.score
      }))
    })
  }

  const comparableFrames = timeline.length
  const scores = timeline.map((x) => x.score).filter((x) => Number.isFinite(x))
  const avgScore = avgInt(scores)
  const minScore = scores.length ? Math.min(...scores) : null
  const maxScore = scores.length ? Math.max(...scores) : null
  const badFrames = timeline.filter((x) => x.errorCount > 0).length
  const badFramePct = comparableFrames > 0 ? Math.round((badFrames / comparableFrames) * 100) : 0

  const sortedIssues = Array.from(issueAgg.values()).sort((a, b) => b.count - a.count)
  const topIssues = sortedIssues.slice(0, 10)

  const issues: Array<{ code: string; severity: IssueSeverity; message: string; atFrame: number | null }> = []
  for (const x of topIssues) {
    const ratio = comparableFrames > 0 ? x.count / comparableFrames : 0
    const severity: IssueSeverity = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info'
    const code = `MOTION_${x.targetId}`.toUpperCase()
    const msg = `${x.label}：${x.cue}`
    issues.push({ code, severity, message: msg, atFrame: x.firstFrame })
  }
  if (comparableFrames === 0) {
    issues.push({ code: 'NO_POSE_FRAMES', severity: 'warning', message: '未提取到足够的人体关键点帧，无法进行标准模板对比。', atFrame: null })
  } else if (unknownTargetCount > 0) {
    issues.push({ code: 'LOW_METRIC_QUALITY', severity: 'info', message: '部分指标因关键点质量不足无法计算，建议改善光线与机位。', atFrame: null })
  }

  const suggestions = (() => {
    if (topIssues.length > 0) return Array.from(new Set(topIssues.map((x) => x.cue))).slice(0, 8)
    return cueFromStandard(input.standard).slice(0, 8)
  })()

  const summary =
    comparableFrames > 0
      ? `模板对比完成：平均得分 ${avgScore ?? '-'} · 最低 ${minScore ?? '-'} · 异常帧 ${badFramePct}%`
      : '模板对比未完成：可用关键点帧不足。'

  const keyMetrics: Record<string, number | string | null> = {
    fps: input.fps,
    standardId: input.standard.id,
    standardName: input.standard.name,
    extractedFrames: input.frames.length,
    comparableFrames,
    avgScore,
    minScore,
    maxScore,
    badFramePct
  }

  return {
    version: 3,
    generatedAt: now.toISOString(),
    status: 'ok',
    task: { id: input.taskId, viewAngle: input.viewAngle, instruction: input.instruction },
    exercise: input.exercise,
    video: input.video,
    summary,
    keyMetrics,
    issues,
    suggestions,
    details: {
      type: 'motion_standard_compare',
      standard: { id: input.standard.id, name: input.standard.name },
      fps: input.fps,
      topIssues: topIssues.map((x) => ({ targetId: x.targetId, label: x.label, cue: x.cue, count: x.count, direction: x.direction })),
      timelineSampled: sampleArray(timeline, 160)
    }
  }
}
