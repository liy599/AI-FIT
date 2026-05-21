import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../reporting/types'
import type { PoseAnalyzerFeedback } from '../analyzer/types'
import { BentOverRowVideoAnalyzer, DEFAULT_BENT_OVER_ROW_TUNING, type BentOverRowTuning } from '../analyzer/bentOverRow'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectAnalyzerReplayStats } from './replayStats'
import { computeReportErrorStats, sampleTimelineRows, toIssueCode } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import type { SquatRepFinding, SquatTimelineRow } from './types'
import { DEFAULT_POSE_RUNTIME_RULES, severityFromRatio, type PoseRuntimeRules } from './policyRules'
import { isPoseDebugEnabled } from '../debugFlags'

export function buildBentOverRowAlignedReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  tuning?: Partial<BentOverRowTuning>
  lastFeedback: PoseAnalyzerFeedback | null
  messageFreq: Map<string, number>
  analyzedFrameCount: number
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  repFindings?: SquatRepFinding[]
  messageFirstSeenMs?: Map<string, number>
  messageEventCount?: Map<string, number>
  messageSeenMomentsMs?: Map<string, number[]>
  rules?: PoseRuntimeRules['bentOverRow']
}): PoseAnalysisReport {
  const rules = input.rules ?? DEFAULT_POSE_RUNTIME_RULES.bentOverRow
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0

  let maxRowDeg: number | null = null
  for (const row of input.timelineRows) {
    const raise = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (raise === null) continue
    maxRowDeg = maxRowDeg === null ? raise : Math.max(maxRowDeg, raise)
  }

  const fallbackSuggestion = 'Pull the dumbbells to your hips with a smooth tempo and keep your back flat.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : 'No valid pose frames were detected. Keep your full upper body in frame and try another video.'

  const issueMessages = sortedIssues
    .filter(([message, count]) => {
      const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
      const text = message.toLowerCase()
      const isFrontWarn = text.includes('face the camera') || text.includes('front')
      const isSideWarn = text.includes('side view')
      const isLowConfidenceWarn = text.includes('low keypoint confidence') || text.includes('confidence')
      if ((isFrontWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) {
        return ratio >= 0.35
      }
      if (isSideWarn && avgTrackingQuality >= 0.62) {
        return ratio >= 0.25
      }
      return true
    })
    .map(([message]) => message)

  const issues: PoseAnalysisReport['issues'] =
    issueMessages.length > 0
      ? issueMessages.map((message) => {
          const frameCount = input.messageFreq.get(message) ?? 0
          const ratio = input.analyzedFrameCount > 0 ? frameCount / input.analyzedFrameCount : 0
          const severity = severityFromRatio(ratio, {
            warnRatio: rules.rangeWarnRatio,
            failRatio: rules.rangeFailRatio
          })
          return {
            code: toIssueCode(message),
            severity,
            message,
            atFrame: null,
            count: messageMomentCount(input, message),
            firstSeenMs: findFirstSeenMs(input.messageFirstSeenMs, message),
            seenMomentsMs: collectMessageMoments(input.messageSeenMomentsMs, message)
          }
        })
      : [
          {
            code: 'NO_OBVIOUS_ISSUES',
            severity: 'info' as const,
            message: 'No major issues were detected.',
            atFrame: null
          }
        ]

  const summary = input.lastFeedback
    ? `${input.lastFeedback.session.totalReps} reps detected. ${input.lastFeedback.session.correctReps} correct, ${input.lastFeedback.session.incorrectReps} incorrect.`
    : 'No stable body pose was detected. Try brighter light and keep your full body in frame.'

  const suggestions = buildBentOverRowReplaySuggestions(sortedIssues, fallbackSuggestion)
  const totalReps = input.lastFeedback?.session.totalReps ?? 0
  const correctReps = input.lastFeedback?.session.correctReps ?? 0
  const incorrectReps = input.lastFeedback?.session.incorrectReps ?? 0
  const effectiveReps = correctReps + incorrectReps
  const unassessedReps = Math.max(0, totalReps - effectiveReps)
  const keyMetrics = {
    totalReps,
    effectiveReps,
    unassessedReps,
    correctReps,
    incorrectReps,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
    maxRowDeg,
    avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
    effectiveFps: input.fps
  }

  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleTimelineRows(input.timelineRows, 180)
  const timelineSeries = [
    { key: 'kneeAngleDeg', label: 'Row Angle' },
    { key: 'hipAngleDeg', label: 'Elbow Angle' },
    { key: 'torsoFromVerticalDeg', label: 'Torso Angle' }
  ]
  const repFindings = input.repFindings ?? []
  const effectiveTuning = { ...DEFAULT_BENT_OVER_ROW_TUNING, ...(input.tuning ?? {}) }

  return normalizeReportForArchive({
    version: 3,
    generatedAt,
    status: 'ok',
    task: { id: input.taskId, viewAngle: input.viewAngle, instruction: null },
    exercise: input.exercise,
    video: input.video,
    summary,
    keyMetrics,
    issues,
    suggestions,
    details: {
      type: 'video_replay_bent_over_row',
      modelName: 'MoveNet Lightning (offline replay)',
      analyzer: 'BentOverRowVideoAnalyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      rowDeg: input.lastFeedback?.kneeAngle ?? null,
      elbowAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      symmetryGap: input.lastFeedback?.kneeVerticalAngle ?? null,
      frontAlignment: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      lastRepResult: input.lastFeedback?.lastRepResult ?? null,
      lastRepMessage: input.lastFeedback?.lastRepMessage ?? null,
      lastRepReasonCodes: input.lastFeedback?.lastRepReasonCodes ?? [],
      lastRepReasonLabels: input.lastFeedback?.lastRepReasonLabels ?? [],
      lastRepFrameCount: input.lastFeedback?.lastRepFrameCount ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      ...(isPoseDebugEnabled() ? { tuning: effectiveTuning, debug: input.lastFeedback?.debug ?? null } : {}),
      timelineSeries,
      timelineSampled,
      repFindings
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
      errorStats: computeReportErrorStats(issues),
      suggestions,
      timelineSeries,
      timelineSampled,
      repFindings
    }
  })
}

export function buildBentOverRowVideoReplayReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  tuning?: Partial<BentOverRowTuning>
  rules?: PoseRuntimeRules['bentOverRow']
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new BentOverRowVideoAnalyzer()
  analyzer.setAnalyzerFps(input.fps)
  analyzer.setTuning({ ...DEFAULT_BENT_OVER_ROW_TUNING, ...(input.tuning ?? {}) })
  const stats = collectAnalyzerReplayStats({ analyzer, exerciseSlug: 'bent-over-row', nativeFrames: input.nativeFrames, onProgress: input.onProgress })

  return buildBentOverRowAlignedReport({
    taskId: input.taskId,
    viewAngle: input.viewAngle,
    exercise: input.exercise,
    video: input.video,
    fps: input.fps,
    tuning: input.tuning,
    lastFeedback: stats.lastFeedback,
    messageFreq: stats.messageFreq,
    analyzedFrameCount: stats.analyzedFrameCount,
    trackingQualitySamples: stats.trackingQualitySamples,
    timelineRows: stats.timelineRows,
    repFindings: stats.repFindings,
    messageFirstSeenMs: stats.messageFirstSeenMs,
    messageEventCount: stats.messageEventCount,
    messageSeenMomentsMs: stats.messageSeenMomentsMs,
    rules: input.rules
  })
}

function findFirstSeenMs(messageFirstSeenMs: Map<string, number> | undefined, message: string) {
  if (!messageFirstSeenMs) return null
  return messageFirstSeenMs.get(message) ?? null
}

function estimateMessageMoments(count: number, fps: number) {
  if (!(count > 0)) return 0
  if (!(fps > 0)) return count
  return Math.max(1, Math.ceil(count / Math.max(1, Math.round(fps))))
}

function messageMomentCount(
  input: { messageFreq: Map<string, number>; messageEventCount?: Map<string, number>; fps: number },
  message: string
) {
  const exact = input.messageEventCount?.get(message)
  if (typeof exact === 'number' && exact > 0) return exact
  return estimateMessageMoments(input.messageFreq.get(message) ?? 0, input.fps)
}

function collectMessageMoments(messageSeenMomentsMs: Map<string, number[]> | undefined, message: string) {
  if (!messageSeenMomentsMs) return []
  return [...(messageSeenMomentsMs.get(message) ?? [])].sort((a, b) => a - b)
}

function buildBentOverRowReplaySuggestions(sortedIssues: Array<[string, number]>, fallbackSuggestion: string) {
  const suggestions = new Set<string>()
  for (const [message] of sortedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'bent-over-row')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }
  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}
