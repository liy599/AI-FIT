import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../../../lib/pose/report'
import type { PoseFrame } from '../../../lib/pose/mediapipePose'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import { RealtimeBenchPressAnalyzer } from '../../../lib/pose/realtimeBenchPress'
import { collectLiveFrameIssueMessages } from './live'
import { computeReportErrorStats, sampleTimelineRows, toIssueCode } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import type { BenchPressTimelineRow } from './types'

export function buildBenchPressAlignedReport(input: {
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
  timelineRows: BenchPressTimelineRow[]
}): PoseAnalysisReport {
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0

  let minElbowAngle: number | null = null
  for (const row of input.timelineRows) {
    const angle = typeof row.elbowAngleDeg === 'number' ? row.elbowAngleDeg : null
    if (angle === null) continue
    minElbowAngle = minElbowAngle === null ? angle : Math.min(minElbowAngle, angle)
  }

  const fallbackSuggestion = 'Lower under control, keep wrists stacked, and press in a smooth path.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your full body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'

  const issueMessages = sortedIssues
    .filter(([message, count]) => {
      const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
      const text = message.toLowerCase()
      const isSideViewWarn = text.includes('side-view') || text.includes('side view')
      const isLowConfidenceWarn = text.includes('low keypoint confidence')
      if ((isSideViewWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) {
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
          const severity: 'info' | 'warning' | 'error' = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info'
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
            message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
            atFrame: null
          }
        ]

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%`
    : `${summaryPrefix}: no stable pose frames were detected.`

  const suggestions = buildBenchPressReplaySuggestions(input.lastFeedback, sortedIssues, fallbackSuggestion)
  const keyMetrics = {
    totalReps: input.lastFeedback?.session.totalReps ?? 0,
    correctReps: input.lastFeedback?.session.correctReps ?? 0,
    incorrectReps: input.lastFeedback?.session.incorrectReps ?? 0,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    minElbowAngleDeg: minElbowAngle,
    avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
    effectiveFps: input.fps
  }

  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleTimelineRows(input.timelineRows, 180)

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
      type: input.source === 'video' ? 'video_live_replay_bench_press' : 'live_realtime_bench_press',
      modelName: input.source === 'video' ? 'MediaPipe Pose (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimeBenchPressAnalyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      elbowAngle: input.lastFeedback?.kneeAngle ?? null,
      bodyLineAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      sideAlignment: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
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
      timelineSampled
    }
  })
}

export function buildBenchPressVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeBenchPressAnalyzer()
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: BenchPressTimelineRow[] = []
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    if (frame.landmarks) {
      const feedback = analyzer.analyze(frame.landmarks)
      lastFeedback = feedback
      analyzedFrameCount += 1
      if (Number.isFinite(feedback.trackingQuality)) trackingQualitySamples.push(feedback.trackingQuality)
      for (const message of collectLiveFrameIssueMessages(feedback)) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
      }
      timelineRows.push({
        frame: i,
        tMs: frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        elbowAngleDeg: feedback.kneeAngle,
        bodyLineAngleDeg: feedback.hipAngle,
        torsoFromHorizontalDeg: feedback.torsoAngle
      })
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }

  return buildBenchPressAlignedReport({
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
    timelineRows
  })
}

function buildBenchPressReplaySuggestions(feedback: RealtimeFeedback | null, sortedIssues: Array<[string, number]>, fallbackSuggestion: string) {
  const suggestions = new Set<string>()
  for (const [message] of sortedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'bench-press')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Lower to a stable depth, pause briefly, then press to a controlled lockout.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Improve lighting and keep shoulders, elbows, wrists, and torso fully visible.')
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}

