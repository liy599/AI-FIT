import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../reporting/types'
import type { PoseAnalyzerFeedback } from '../analyzer/types'
import { LateralRaiseVideoAnalyzer } from '../analyzer/lateralRaise'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectAnalyzerReplayStats } from './replayStats'
import { computeReportErrorStats, sampleTimelineRows, toIssueCode } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import type { SquatTimelineRow } from './types'
import { DEFAULT_POSE_RUNTIME_RULES, severityFromRatio, type PoseRuntimeRules } from './policyRules'

export function buildLateralRaiseAlignedReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  lastFeedback: PoseAnalyzerFeedback | null
  messageFreq: Map<string, number>
  analyzedFrameCount: number
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  tempoFastThresholdSec?: number
  rules?: PoseRuntimeRules['lateralRaise']
}): PoseAnalysisReport {
  const rules = input.rules ?? DEFAULT_POSE_RUNTIME_RULES.lateralRaise
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0

  let maxRaiseDeg: number | null = null
  for (const row of input.timelineRows) {
    const raise = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (raise === null) continue
    maxRaiseDeg = maxRaiseDeg === null ? raise : Math.max(maxRaiseDeg, raise)
  }

  const fallbackSuggestion = 'Raise to shoulder level with a smooth tempo and keep torso stable.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : 'No valid pose frames were detected. Keep your full upper body in frame and try another video.'

  const issueMessages = sortedIssues
    .filter(([message, count]) => {
      const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
      const text = message.toLowerCase()
      const isFrontWarn = text.includes('face the camera') || text.includes('front')
      const isLowConfidenceWarn = text.includes('low keypoint confidence') || text.includes('confidence')
      if ((isFrontWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) {
        return ratio >= 0.35
      }
      return true
    })
    .map(([message]) => message)

  const issues =
    issueMessages.length > 0
      ? issueMessages.map((message) => {
          const count = input.messageFreq.get(message) ?? 0
          const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
          const text = message.toLowerCase()
          const isSymmetryIssue = text.includes('symmetry') || text.includes('left') || text.includes('right')
          const severity = severityFromRatio(ratio, {
            warnRatio: isSymmetryIssue ? rules.symmetryWarnRatio : rules.torsoSwayWarnRatio,
            failRatio: isSymmetryIssue ? rules.symmetryFailRatio : rules.torsoSwayFailRatio
          })
          return {
            code: toIssueCode(message),
            severity,
            message,
            atFrame: null
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

  const suggestions = buildLateralRaiseReplaySuggestions(sortedIssues, fallbackSuggestion)
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
    maxRaiseDeg,
    avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
    effectiveFps: input.fps
  }

  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleTimelineRows(input.timelineRows, 180)
  const timelineSeries = [
    { key: 'kneeAngleDeg', label: 'Raise Angle' },
    { key: 'hipAngleDeg', label: 'Elbow Angle' },
    { key: 'torsoFromVerticalDeg', label: 'Torso Angle' }
  ]

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
      type: 'video_replay_lateral_raise',
      modelName: 'MoveNet Lightning (offline replay)',
      analyzer: 'LateralRaiseVideoAnalyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      raiseDeg: input.lastFeedback?.kneeAngle ?? null,
      elbowAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      symmetryGap: input.lastFeedback?.kneeVerticalAngle ?? null,
      frontAlignment: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      timelineSeries,
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
      errorStats: computeReportErrorStats(issues),
      suggestions,
      timelineSeries,
      timelineSampled
    }
  })
}

export function buildLateralRaiseVideoReplayReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  tempoFastThresholdSec?: number
  rules?: PoseRuntimeRules['lateralRaise']
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new LateralRaiseVideoAnalyzer()
  const stats = collectAnalyzerReplayStats({ analyzer, exerciseSlug: 'lateral-raise', nativeFrames: input.nativeFrames, onProgress: input.onProgress })

  return buildLateralRaiseAlignedReport({
    taskId: input.taskId,
    viewAngle: input.viewAngle,
    exercise: input.exercise,
    video: input.video,
    fps: input.fps,
    lastFeedback: stats.lastFeedback,
    messageFreq: stats.messageFreq,
    analyzedFrameCount: stats.analyzedFrameCount,
    trackingQualitySamples: stats.trackingQualitySamples,
    timelineRows: stats.timelineRows,
    rules: input.rules
  })
}

function buildLateralRaiseReplaySuggestions(sortedIssues: Array<[string, number]>, fallbackSuggestion: string) {
  const suggestions = new Set<string>()
  for (const [message] of sortedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'lateral-raise')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }
  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}
