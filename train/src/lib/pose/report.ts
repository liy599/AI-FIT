import type { SquatSideAnalysis } from './squatSide'
import type { GenericMotionAnalysis } from './genericMotion'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

export type UnifiedReport = {
  version: number
  generatedAt: string
  status: 'ok' | 'error'
  task: {
    id: string
    viewAngle: string
    instruction: string | null
  }
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  summary: string
  keyMetrics: Record<string, number | string | null>
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: number | null }>
  suggestions: string[]
  details: JsonValue
  sections: {
    overview: JsonObject
    metrics: JsonObject
    errorStats: { total: number; bySeverity: { info: number; warning: number; error: number }; byCode: Array<{ code: string; count: number; maxSeverity: 'info' | 'warning' | 'error' }> }
    suggestions: string[]
    timelineSampled: JsonArray
  }
} & { [key: string]: JsonValue }

function computeErrorStats(
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error' }>
): { total: number; bySeverity: { info: number; warning: number; error: number }; byCode: Array<{ code: string; count: number; maxSeverity: 'info' | 'warning' | 'error' }> } {
  const bySeverity = { info: 0, warning: 0, error: 0 }
  const map = new Map<string, { count: number; maxSeverity: 'info' | 'warning' | 'error' }>()

  function severityRank(s: 'info' | 'warning' | 'error') {
    if (s === 'error') return 3
    if (s === 'warning') return 2
    return 1
  }

  for (const i of issues) {
    bySeverity[i.severity] += 1
    const prev = map.get(i.code)
    if (!prev) {
      map.set(i.code, { count: 1, maxSeverity: i.severity })
      continue
    }
    prev.count += 1
    if (severityRank(i.severity) > severityRank(prev.maxSeverity)) prev.maxSeverity = i.severity
  }

  const byCode = Array.from(map.entries())
    .map(([code, v]) => ({ code, count: v.count, maxSeverity: v.maxSeverity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return { total: issues.length, bySeverity, byCode }
}

export function buildSquatSideReport(input: {
  taskId: string
  viewAngle: string
  instruction: string | null
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  analysis: SquatSideAnalysis
}): UnifiedReport {
  const repCount = input.analysis.reps.length
  const allIssues = input.analysis.issues

  const depthInsufficient = allIssues.filter((x) => x.code === 'DEPTH_INSUFFICIENT').length
  const heelLift = allIssues.filter((x) => x.code === 'HEEL_LIFT').length
  const torsoLean = allIssues.filter((x) => x.code === 'TORSO_LEAN_EXCESSIVE').length
  const kneeForward = allIssues.filter((x) => x.code === 'KNEE_TOO_FORWARD').length

  const issues = allIssues.map((i) => ({
    code: i.code,
    severity: i.severity,
    message: i.message,
    atFrame: i.atFrame ?? null
  }))

  const keyMetrics: UnifiedReport['keyMetrics'] = {
    reps: repCount,
    fps: input.fps,
    depthInsufficient,
    heelLift,
    torsoLean,
    kneeForward
  }

  const timelineSampled = sampleTimeline(input.analysis.timeline, input.fps, 5)
  const errorStats = computeErrorStats(issues)
  const generatedAt = new Date().toISOString()

  return {
    version: 3,
    generatedAt,
    status: 'ok',
    task: { id: input.taskId, viewAngle: input.viewAngle, instruction: input.instruction },
    exercise: input.exercise,
    video: input.video,
    summary: input.analysis.summary,
    keyMetrics,
    issues,
    suggestions: input.analysis.suggestions,
    details: {
      type: 'squat_side',
      fps: input.fps,
      reps: input.analysis.reps,
      timelineSampled
    },
    sections: {
      overview: {
        generatedAt,
        status: 'ok',
        taskId: input.taskId,
        viewAngle: input.viewAngle,
        exerciseName: input.exercise?.name ?? null,
        summary: input.analysis.summary
      },
      metrics: keyMetrics as unknown as JsonObject,
      errorStats: errorStats as unknown as UnifiedReport['sections']['errorStats'],
      suggestions: input.analysis.suggestions,
      timelineSampled: timelineSampled as unknown as JsonArray
    }
  }
}

export function buildGenericMotionReport(input: {
  taskId: string
  viewAngle: string
  instruction: string | null
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  analysis: GenericMotionAnalysis
}): UnifiedReport {
  const keyMetrics: UnifiedReport['keyMetrics'] = {
    fps: input.fps,
    repEstimate: input.analysis.repEstimate,
    coverage: input.analysis.coverage,
    stabilityScore: input.analysis.stabilityScore,
    mobilityScore: input.analysis.mobilityScore,
    rhythmScore: input.analysis.rhythmScore,
    symmetryScore: input.analysis.symmetryScore
  }
  const issues = input.analysis.issues.map((x) => ({
    code: x.code,
    severity: x.severity,
    message: x.message,
    atFrame: x.atFrame
  }))
  const timelineSampled = sampleGenericTimeline(input.analysis.timeline, input.fps, 5)
  const errorStats = computeErrorStats(issues)
  const generatedAt = new Date().toISOString()

  return {
    version: 3,
    generatedAt,
    status: 'ok',
    task: { id: input.taskId, viewAngle: input.viewAngle, instruction: input.instruction },
    exercise: input.exercise,
    video: input.video,
    summary: input.analysis.summary,
    keyMetrics,
    issues,
    suggestions: input.analysis.suggestions,
    details: {
      type: 'generic_motion',
      timelineSampled
    },
    sections: {
      overview: {
        generatedAt,
        status: 'ok',
        taskId: input.taskId,
        viewAngle: input.viewAngle,
        exerciseName: input.exercise?.name ?? null,
        summary: input.analysis.summary
      },
      metrics: keyMetrics as unknown as JsonObject,
      errorStats: errorStats as unknown as UnifiedReport['sections']['errorStats'],
      suggestions: input.analysis.suggestions,
      timelineSampled: timelineSampled as unknown as JsonArray
    }
  }
}

function sampleTimeline(
  timeline: Array<{ frame: number; tMs: number; phase: string | null; kneeAngleDeg: number | null; hipAngleDeg: number | null; torsoFromVerticalDeg: number | null }>,
  fps: number,
  sampleFps: number
) {
  const step = Math.max(1, Math.round(fps / Math.max(1, sampleFps)))
  const out: Array<{
    frame: number
    tMs: number
    phase: string | null
    kneeAngleDeg: number | null
    hipAngleDeg: number | null
    torsoFromVerticalDeg: number | null
  }> = []
  for (let i = 0; i < timeline.length; i += step) {
    out.push(timeline[i])
  }
  return out
}

function sampleGenericTimeline(
  timeline: Array<{ frame: number; tMs: number; centerY: number | null; shoulderTiltDeg: number | null; kneeFlexDeg: number | null }>,
  fps: number,
  sampleFps: number
) {
  const step = Math.max(1, Math.round(fps / Math.max(1, sampleFps)))
  const out: Array<{ frame: number; tMs: number; centerY: number | null; shoulderTiltDeg: number | null; kneeFlexDeg: number | null }> = []
  for (let i = 0; i < timeline.length; i += step) {
    out.push(timeline[i])
  }
  return out
}
