import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../../../lib/pose/report'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import { RealtimeBentOverRowAnalyzer } from '../../../lib/pose/realtimeBentOverRow'
import type { MoveNetKeypoint } from '../../../lib/pose/movenetTracker'
import { collectLiveFrameIssueMessages } from './live'
import { computeReportErrorStats, sampleTimelineRows, toIssueCode } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import type { SquatRepFinding, SquatTimelineRow } from './types'
import { DEFAULT_POSE_RUNTIME_RULES, severityFromRatio, type PoseRuntimeRules } from './policyRules'

export function buildBentOverRowAlignedReport(input: {
  source: 'live' | 'video'
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  lastFeedback: RealtimeFeedback | null
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
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your full upper body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'

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
            message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
            atFrame: null
          }
        ]

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%`
    : `${summaryPrefix}: no stable pose frames were detected.`

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
  const repFindings = input.repFindings ?? []

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
      type: input.source === 'video' ? 'video_live_replay_bent_over_row' : 'live_realtime_bent_over_row',
      modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimeBentOverRowAnalyzer',
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
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
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
      timelineSampled,
      repFindings
    }
  })
}

export function buildBentOverRowVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  rules?: PoseRuntimeRules['bentOverRow']
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeBentOverRowAnalyzer()
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const messageFirstSeenMs = new Map<string, number>()
  const messageEventCount = new Map<string, number>()
  const messageLastEventMs = new Map<string, number>()
  const messageSeenMomentsMs = new Map<string, number[]>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  let lastRepCount = 0
  const total = input.nativeFrames.length

  for (let i = 0; i < input.nativeFrames.length; i++) {
    const frame = input.nativeFrames[i]!
    if (frame.keypoints?.length) {
      const feedback = analyzer.analyzeNative(frame.keypoints)
      lastFeedback = feedback
      analyzedFrameCount += 1
      if (Number.isFinite(feedback.trackingQuality)) trackingQualitySamples.push(feedback.trackingQuality)
      for (const message of collectLiveFrameIssueMessages(feedback)) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
        if (!messageFirstSeenMs.has(text)) messageFirstSeenMs.set(text, frame.tMs)
        recordMessageMoment(text, frame.tMs, messageEventCount, messageLastEventMs, messageSeenMomentsMs)
      }
      timelineRows.push({
        frame: i,
        tMs: frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle
      })
      if (feedback.repCount > lastRepCount) {
        const result: SquatRepFinding['result'] =
          feedback.lastRepResult === 'correct' ? 'correct' : feedback.lastRepResult === 'incorrect' ? 'incorrect' : 'invalid'
        const reasons = feedback.lastRepReasonLabels.length > 0 ? [...feedback.lastRepReasonLabels] : []
        const primaryIssue =
          reasons[0] ??
          feedback.lastRepMessage ??
          (result === 'correct' ? 'Rep passed quality check.' : 'Rep was counted but not valid for quality scoring.')
        for (let repNo = lastRepCount + 1; repNo <= feedback.repCount; repNo++) {
          repFindings.push({
            repNumber: repNo,
            result,
            primaryIssue,
            reasons,
            atFrame: i,
            tMs: frame.tMs
          })
        }
        lastRepCount = feedback.repCount
      }
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.nativeFrames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }

  return buildBentOverRowAlignedReport({
    source: 'video',
    taskId: input.taskId,
    viewAngle: input.viewAngle,
    exercise: input.exercise,
    video: input.video,
    fps: input.fps,
    lastFeedback,
    messageFreq,
    analyzedFrameCount,
    trackingQualitySamples,
    timelineRows,
    repFindings,
    messageFirstSeenMs,
    messageEventCount,
    messageSeenMomentsMs,
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

function recordMessageMoment(
  message: string,
  tMs: number,
  messageEventCount: Map<string, number>,
  messageLastEventMs: Map<string, number>,
  messageSeenMomentsMs: Map<string, number[]>,
  debounceMs = 1000
) {
  const prev = messageLastEventMs.get(message)
  if (prev === undefined || tMs - prev >= debounceMs) {
    messageEventCount.set(message, (messageEventCount.get(message) ?? 0) + 1)
    messageLastEventMs.set(message, tMs)
    const existing = messageSeenMomentsMs.get(message)
    if (existing) existing.push(tMs)
    else messageSeenMomentsMs.set(message, [tMs])
  }
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

