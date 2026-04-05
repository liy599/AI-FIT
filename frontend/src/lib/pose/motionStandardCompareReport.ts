import type { NormalizedLandmark, PoseFrame as ExtractedFrame } from './mediapipePose'
import { MotionComparator, type MotionStandard } from './motionCompare'
import { PoseMetricTracker } from './poseMetricTracker'
import type { PoseAnalysisReport } from './report'

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

export function buildMotionStandardCompareReport(input: {
  taskId: string
  viewAngle: string
  instruction: string | null
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: ExtractedFrame[]
  standard: MotionStandard
}): PoseAnalysisReport {
  const tracker = new PoseMetricTracker({ stabilityWindowMs: 900 })
  const comparator = new MotionComparator(input.standard)
  const timeline: TimelineRow[] = []
  const issueAgg = new Map<
    string,
    { targetId: string; label: string; cue: string; count: number; firstFrame: number; direction: 'increase' | 'decrease' | 'unknown' }
  >()
  let unknownTargetCount = 0

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    const landmarks = frame.landmarks as NormalizedLandmark[] | null
    if (!landmarks) continue
    const poseFrame = tracker.update(landmarks, frame.tMs)
    const compared = comparator.evaluate(poseFrame)
    if (!compared) continue

    for (const target of compared.targets) {
      if (target.direction === 'ok') continue
      if (target.direction === 'unknown') {
        unknownTargetCount += 1
        continue
      }
      const key = `${target.targetId}:${target.direction}`
      const prev = issueAgg.get(key)
      if (!prev) {
        issueAgg.set(key, {
          targetId: target.targetId,
          label: target.label,
          cue: target.cue,
          count: 1,
          firstFrame: i,
          direction: target.direction
        })
      } else {
        prev.count += 1
      }
    }

    timeline.push({
      frame: i,
      tMs: frame.tMs,
      phaseId: compared.phaseId,
      phaseLabel: compared.phaseLabel,
      score: compared.overallScore,
      errorCount: compared.errorCount,
      kneeAngleDeg: poseFrame.metrics.kneeAvgDeg,
      hipAngleDeg: poseFrame.metrics.hipAvgDeg,
      torsoFromVerticalDeg: poseFrame.metrics.torsoInclineAbsDeg,
      stabilityScore: poseFrame.metrics.stabilityScore,
      highlights: compared.highlights.map((highlight) => ({
        targetId: highlight.targetId,
        label: highlight.label,
        direction: highlight.direction,
        cue: highlight.cue,
        value: highlight.value,
        score: highlight.score
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

  const topIssues = Array.from(issueAgg.values()).sort((a, b) => b.count - a.count).slice(0, 10)
  const issues: PoseAnalysisReport['issues'] = topIssues.map((issue) => {
    const ratio = comparableFrames > 0 ? issue.count / comparableFrames : 0
    const severity = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info'
    return {
      code: `MOTION_${issue.targetId}`.toUpperCase(),
      severity,
      message: `${issue.label}: ${issue.cue}`,
      atFrame: issue.firstFrame
    }
  })

  if (comparableFrames === 0) {
    issues.push({
      code: 'NO_POSE_FRAMES',
      severity: 'warning',
      message: 'Not enough usable pose frames were extracted for standard comparison.',
      atFrame: null
    })
  } else if (unknownTargetCount > 0) {
    issues.push({
      code: 'LOW_METRIC_QUALITY',
      severity: 'info',
      message: 'Some metrics could not be evaluated because keypoint quality was unstable.',
      atFrame: null
    })
  }

  const suggestions =
    topIssues.length > 0
      ? Array.from(new Set(topIssues.map((issue) => issue.cue))).slice(0, 8)
      : cueFromStandard(input.standard).slice(0, 8)

  const summary =
    comparableFrames > 0
      ? `Standard comparison complete. Avg ${avgScore ?? '-'}, min ${minScore ?? '-'}, bad frames ${badFramePct}%.`
      : 'Standard comparison could not complete because usable pose frames were insufficient.'

  const keyMetrics = {
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
  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleArray(timeline, 160)

  return {
    version: 3,
    generatedAt,
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
      topIssues: topIssues.map((issue) => ({
        targetId: issue.targetId,
        label: issue.label,
        cue: issue.cue,
        count: issue.count,
        direction: issue.direction
      })),
      timelineSampled
    },
    sections: {
      overview: {
        generatedAt,
        status: 'ok',
        taskId: input.taskId,
        viewAngle: input.viewAngle,
        exerciseName: input.exercise?.name ?? null,
        summary
      },
      metrics: keyMetrics,
      errorStats: computeErrorStats(issues),
      suggestions,
      timelineSampled
    }
  }
}

function avgInt(values: number[]) {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function sampleArray<T>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max <= 0) return []
  if (max === 1) return [items[items.length - 1]!]

  const idx = new Set<number>([0, items.length - 1])
  while (idx.size < max) {
    const t = Math.floor(((idx.size - 1) / (max - 1)) * (items.length - 1))
    idx.add(t)
    if (idx.size >= max) break
    idx.add(Math.floor(items.length / 2))
  }
  return Array.from(idx)
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((i) => items[i]!)
}

function cueFromStandard(standard: MotionStandard) {
  const out: string[] = []
  for (const phase of standard.phases) {
    for (const target of phase.targets) {
      if (target.cueIncrease) out.push(target.cueIncrease)
      if (target.cueDecrease) out.push(target.cueDecrease)
    }
  }
  return Array.from(new Set(out)).filter((x) => x.trim().length > 0)
}

function computeErrorStats(
  issues: PoseAnalysisReport['issues']
): PoseAnalysisReport['sections']['errorStats'] {
  const bySeverity = { info: 0, warning: 0, error: 0 }
  const byCode = new Map<string, { count: number; maxSeverity: 'info' | 'warning' | 'error' }>()

  function rank(value: 'info' | 'warning' | 'error') {
    if (value === 'error') return 3
    if (value === 'warning') return 2
    return 1
  }

  for (const issue of issues) {
    bySeverity[issue.severity] += 1
    const prev = byCode.get(issue.code)
    if (!prev) {
      byCode.set(issue.code, { count: 1, maxSeverity: issue.severity })
      continue
    }
    prev.count += 1
    if (rank(issue.severity) > rank(prev.maxSeverity)) prev.maxSeverity = issue.severity
  }

  return {
    total: issues.length,
    bySeverity,
    byCode: Array.from(byCode.entries())
      .map(([code, value]) => ({ code, count: value.count, maxSeverity: value.maxSeverity }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }
}
