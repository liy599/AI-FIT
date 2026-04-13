<<<<<<< HEAD
import { normalizeReportForArchive } from '../../lib/report/unified'
import type { PoseAnalysisReport } from '../../lib/pose/report'
import type { NormalizedLandmark, PoseFrame } from '../../lib/pose/mediapipePose'
import { type RealtimeFeedback } from '../../lib/pose/realtimeSquat'
import { RealtimeLateralRaise17Analyzer, VIDEO_DEFAULT_LATERAL_RAISE17_TEMPO } from '../../lib/pose/realtimeLateralRaise17'
import { RealtimePushupAnalyzer } from '../../lib/pose/realtimePushup'
import { RealtimePullup17Analyzer, VIDEO_DEFAULT_PULLUP17_TEMPO } from '../../lib/pose/realtimePullup17'
import { RealtimeBenchPressAnalyzer } from '../../lib/pose/realtimeBenchPress'
import { RealtimeSquat17Analyzer, VIDEO_DEFAULT_SQUAT17_TEMPO, type Squat17Tempo, type Squat17Tuning } from '../../lib/pose/realtimeSquat17'
import type { MoveNetKeypoint } from '../../lib/pose/movenetTracker'

export type ExerciseSlug = 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press'

export type SquatTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
  frontAlignmentDeg?: number | null
}

export type SquatRepFinding = {
  repNumber: number
  result: 'correct' | 'incorrect' | 'invalid'
  primaryIssue: string
  reasons: string[]

  atFrame: number
  tMs: number
}

export type BenchPressTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  elbowAngleDeg: number | null
  bodyLineAngleDeg: number | null
  torsoFromHorizontalDeg: number | null
}

export type RealtimeAnalyzer = {
  analyze: (landmarks: NormalizedLandmark[]) => RealtimeFeedback
  analyzeNative?: (keypoints: MoveNetKeypoint[]) => RealtimeFeedback
  setTuning?: (next: Partial<Squat17Tuning>) => void
  setTempo?: (next: Partial<Squat17Tempo>) => void
  setAnalyzerFps?: (fps: number) => void
  resetSession: () => void
}

// Video-analysis-only fallback tuning (aligned with backend defaults).
export const VIDEO_DEFAULT_SQUAT17_TUNING: Squat17Tuning = {
  kneeForwardWarnRatio: 0.050,
  kneeForwardFailRatio: 0.065,
  kneeForwardFailMinFrames: 2,
  forwardLeanWarnDeg: 40,
  forwardLeanFailDeg: 54,
  forwardLeanFailMinFrames: 2,
  trackingQualityMin: 0.28
}

export function buildSquatAlignedReport(input: {
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
}): PoseAnalysisReport {
  const sortedFrameMessages = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0
  const totalReps = input.lastFeedback?.session.totalReps ?? 0
  const correctReps = input.lastFeedback?.session.correctReps ?? 0
  const incorrectReps = input.lastFeedback?.session.incorrectReps ?? 0
  const effectiveReps = correctReps + incorrectReps
  const unassessedReps = input.lastFeedback?.session.unassessedReps ?? Math.max(0, totalReps - effectiveReps)
  const assessedRepPct = totalReps > 0 ? Math.round((effectiveReps / totalReps) * 100) : 0
  const sideViewInvalidReps = input.lastFeedback?.session.sideViewWarningCount ?? 0
  const kneeForwardCount = input.lastFeedback?.session.kneeOverToeCount ?? 0
  const forwardLeanCount = input.lastFeedback?.session.forwardLeanCount ?? 0
  const avgRepDurationSec = input.lastFeedback?.session.avgRepDurationSec ?? null
  const sessionSlowRepCount = input.lastFeedback?.session.slowRepCount ?? 0
  const fallbackSuggestion = 'Keep a steady tempo and align your knees with your toes.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your full body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'
  const tempoCheck = analyzeSquatTempoFromTimeline(input.timelineRows)
  const highQualitySample =
    (input.lastFeedback?.session.accuracyPct ?? 0) >= 95 &&
    (input.lastFeedback?.session.incorrectReps ?? 0) === 0
  const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0
  const phaseFastRepCount = Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount)
  const unifiedFastRepCount = highQualitySample ? sessionFastRepCount : Math.max(sessionFastRepCount, phaseFastRepCount)

  const issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }> = []
  const assessedDenominator = Math.max(1, effectiveReps)

  if (kneeForwardCount > 0) {
    const ratio = kneeForwardCount / assessedDenominator
    issues.push({
      code: 'KNEE_FORWARD_EXCESSIVE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Knee forward drift detected in ${kneeForwardCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (forwardLeanCount > 0) {
    const ratio = forwardLeanCount / assessedDenominator
    issues.push({
      code: 'FORWARD_LEAN_EXCESSIVE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Excessive torso lean detected in ${forwardLeanCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (sideViewInvalidReps > 0) {
    const ratio = totalReps > 0 ? sideViewInvalidReps / totalReps : 1
    issues.push({
      code: 'SIDE_VIEW_UNSTABLE',
      severity: ratio >= 0.4 ? 'warning' : 'info',
      message: `Side-view alignment unstable in ${sideViewInvalidReps}/${totalReps} total reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (unassessedReps > 0) {
    const ratio = totalReps > 0 ? unassessedReps / totalReps : 1
    issues.push({
      code: 'REPS_UNASSESSED',
      severity: ratio >= 0.35 ? 'warning' : 'info',
      message: `${unassessedReps}/${totalReps} reps could not be quality-assessed due to unstable or incomplete keypoints.`,
      atFrame: null
    })
  }

  for (const [message, count] of sortedFrameMessages) {
    const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
    const text = message.toLowerCase()
    const isSideViewWarn = text.includes('side view')
    const isLowConfidenceWarn = text.includes('low keypoint confidence') || text.includes('incomplete keypoints')
    if (isSideViewWarn && sideViewInvalidReps > 0) continue
    if (isSideViewWarn && (sideViewInvalidReps < 2 || totalReps <= 3)) continue
    if (!isSideViewWarn && !isLowConfidenceWarn) continue
    if (avgTrackingQuality >= 0.62 && ratio < 0.28) continue
    if (ratio < 0.18) continue
    const detailedMessage = isSideViewWarn
      ? `Frequent side-view drift seen in ${Math.round(ratio * 100)}% of analyzed frames.`
      : `Keypoint confidence instability seen in ${Math.round(ratio * 100)}% of analyzed frames.`
    const code = isSideViewWarn ? 'SIDE_VIEW_DRIFT_FRAMES' : 'KEYPOINT_CONFIDENCE_LOW_FRAMES'
    if (!issues.some((item) => item.code === code)) {
      issues.push({
        code,
        severity: ratio >= 0.4 ? 'warning' : 'info',
        message: detailedMessage,
        atFrame: null
      })
    }
  }

  const fastRepRatio = effectiveReps > 0 ? unifiedFastRepCount / effectiveReps : 0
  const slowRepRatio = effectiveReps > 0 ? sessionSlowRepCount / effectiveReps : 0
  if (
    !highQualitySample &&
    effectiveReps >= 3 &&
    unifiedFastRepCount >= 2 &&
    fastRepRatio >= 0.45 &&
    avgRepDurationSec !== null &&
    avgRepDurationSec < 1.1
  ) {
    issues.push({
      code: 'DESCENT_TOO_FAST',
      severity: fastRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is fast in ${unifiedFastRepCount}/${effectiveReps} assessed reps (${Math.round(fastRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (
    !highQualitySample &&
    effectiveReps >= 3 &&
    sessionSlowRepCount >= 2 &&
    slowRepRatio >= 0.45 &&
    avgRepDurationSec !== null &&
    avgRepDurationSec > 4.2
  ) {
    issues.push({
      code: 'TEMPO_TOO_SLOW',
      severity: slowRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is slow in ${sessionSlowRepCount}/${effectiveReps} assessed reps (${Math.round(slowRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (
    !highQualitySample &&
    effectiveReps >= 3 &&
    ((unifiedFastRepCount >= 1 && sessionSlowRepCount >= 1) ||
      (tempoCheck.fastDescentCount >= 1 && tempoCheck.fastAscentCount === 0) ||
      (tempoCheck.fastAscentCount >= 1 && tempoCheck.fastDescentCount === 0))
  ) {
    issues.push({
      code: 'TEMPO_UNSTABLE',
      severity: 'info',
      message: 'Tempo stability is inconsistent across reps. Keep descent and ascent rhythm more uniform.',
      atFrame: null
    })
  }

  if (issues.length === 0) {
    issues.push({
      code: 'NO_OBVIOUS_ISSUES',
      severity: 'info',
      message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
      atFrame: null
    })
  }

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${totalReps}, effective ${effectiveReps}, unassessed ${unassessedReps}, correct ${correctReps}, incorrect ${incorrectReps}, accuracy ${input.lastFeedback.session.accuracyPct}%, avg rep ${input.lastFeedback.session.avgRepDurationSec ?? '-'}s.`
    : `${summaryPrefix}: no stable pose frames were detected.`
  const suggestions = buildSquatReplaySuggestions(input.lastFeedback, issues, fallbackSuggestion)
  const keyMetrics = {
    totalReps,
    effectiveReps,
    unassessedReps,
    correctReps,
    incorrectReps,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    assessedRepPct,
    avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
    fastRepCount: unifiedFastRepCount,
    slowRepCount: input.lastFeedback?.session.slowRepCount ?? 0,
    sideViewInvalidReps,
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
      type: input.source === 'video' ? 'video_live_replay_squat' : 'live_realtime_squat',
      modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimeSquat17Analyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      effectiveRepCount: effectiveReps,
      unassessedRepCount: unassessedReps,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      assessedRepPct,
      sideViewInvalidReps,
      kneeAngle: input.lastFeedback?.kneeAngle ?? null,
      hipAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      offsetAngle: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      tempo: tempoCheck,
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

export function buildSquatVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  nativeFrames?: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  tuning?: Partial<Squat17Tuning>
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeSquat17Analyzer()
  analyzer.setTuning(input.tuning ?? VIDEO_DEFAULT_SQUAT17_TUNING)
  analyzer.setTempo(VIDEO_DEFAULT_SQUAT17_TEMPO)
  analyzer.setAnalyzerFps(input.fps)
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  let lastRepCount = 0
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    const nativeFrame = input.nativeFrames?.[i]
    if (frame.landmarks && nativeFrame?.keypoints?.length) {
      const feedback = analyzer.analyzeNative(nativeFrame.keypoints)
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
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }
  return buildSquatAlignedReport({
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
    repFindings
  })
}

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

export function buildPushupAlignedReport(input: {
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
    const angle = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (angle === null) continue
    minElbowAngle = minElbowAngle === null ? angle : Math.min(minElbowAngle, angle)
  }

  const fallbackSuggestion = 'Brace your core, keep a straight body line, and lower under control.'
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
      if ((isSideViewWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) return ratio >= 0.35
      return true
    })
    .map(([message]) => message)

  const tempoCheck = analyzePushupTempoFromTimeline(input.timelineRows)
  const issues =
    issueMessages.length > 0
      ? issueMessages.map((message) => {
          const count = input.messageFreq.get(message) ?? 0
          const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
          const severity: 'info' | 'warning' | 'error' = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info'
          return { code: toIssueCode(message), severity, message, atFrame: null }
        })
      : [
          {
            code: 'NO_OBVIOUS_ISSUES',
            severity: 'info' as const,
            message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
            atFrame: null
          }
        ]

  if (tempoCheck.fastDescentCount > 0) {
    issues.push({
      code: 'DESCENT_TOO_FAST',
      severity: tempoCheck.fastDescentCount >= 2 ? 'warning' : 'info',
      message: `Descent too fast detected (${tempoCheck.fastDescentCount} rep${tempoCheck.fastDescentCount > 1 ? 's' : ''}).`,
      atFrame: null
    })
  }
  if (tempoCheck.fastAscentCount > 0) {
    issues.push({
      code: 'ASCENT_TOO_FAST',
      severity: tempoCheck.fastAscentCount >= 2 ? 'warning' : 'info',
      message: `Ascent too fast detected (${tempoCheck.fastAscentCount} rep${tempoCheck.fastAscentCount > 1 ? 's' : ''}).`,
      atFrame: null
    })
  }

  const repReasons = input.lastFeedback?.lastRepReasonLabels ?? []
  for (const reason of repReasons) {
    const text = reason.trim()
    if (!text) continue
    const code = toIssueCode(text)
    if (issues.some((x) => x.code === code)) continue
    issues.unshift({ code, severity: 'warning', message: text, atFrame: null })
  }

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%`
    : `${summaryPrefix}: no stable pose frames were detected.`

  const suggestions = buildPushupReplaySuggestions(input.lastFeedback, sortedIssues, tempoCheck, fallbackSuggestion)
  const keyMetrics = {
    totalReps: input.lastFeedback?.session.totalReps ?? 0,
    correctReps: input.lastFeedback?.session.correctReps ?? 0,
    incorrectReps: input.lastFeedback?.session.incorrectReps ?? 0,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    minElbowAngleDeg: minElbowAngle,
    avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
    fastRepCount: Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount),
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
      type: input.source === 'video' ? 'video_live_replay_pushup' : 'live_realtime_pushup',
      modelName: input.source === 'video' ? 'MediaPipe Pose (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimePushupAnalyzer',
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
      tempo: tempoCheck,
      timelineSampled
    },
    sections: {
      overview: { generatedAt, status: 'ok', taskId: input.taskId, viewAngle: input.viewAngle, exerciseName: input.exercise?.name ?? null, summary },
      metrics: keyMetrics,
      errorStats: computeReportErrorStats(issues),
      suggestions,
      timelineSampled
    }
  })
}

export function buildPushupVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimePushupAnalyzer()
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
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
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle
      })
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) input.onProgress(i + 1, total)
  }

  return buildPushupAlignedReport({
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

export function buildPullupAlignedReport(input: {
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
}): PoseAnalysisReport {
  const sortedFrameMessages = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0

  const totalReps = input.lastFeedback?.session.totalReps ?? 0
  const correctReps = input.lastFeedback?.session.correctReps ?? 0
  const incorrectReps = input.lastFeedback?.session.incorrectReps ?? 0
  const effectiveReps = correctReps + incorrectReps
  const unassessedReps = input.lastFeedback?.session.unassessedReps ?? Math.max(0, totalReps - effectiveReps)
  const assessedRepPct = totalReps > 0 ? Math.round((effectiveReps / totalReps) * 100) : 0
  const viewInvalidReps = input.lastFeedback?.session.sideViewWarningCount ?? 0
  const topMissCount = input.lastFeedback?.session.depthInsufficientCount ?? 0
  const swingCount = input.lastFeedback?.session.forwardLeanCount ?? 0
  const armAsymCount = input.lastFeedback?.session.kneeOverToeCount ?? 0
  const avgRepDurationSec = input.lastFeedback?.session.avgRepDurationSec ?? null
  const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0
  const sessionSlowRepCount = input.lastFeedback?.session.slowRepCount ?? 0
  const fallbackSuggestion = 'Pull smoothly, avoid swinging, and lower under control.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your upper body and the bar area in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'

  const issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }> = []
  const assessedDenominator = Math.max(1, effectiveReps)

  if (topMissCount > 0) {
    const ratio = topMissCount / assessedDenominator
    issues.push({
      code: 'TOP_RANGE_INCOMPLETE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Top range not reached in ${topMissCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (swingCount > 0) {
    const ratio = swingCount / assessedDenominator
    issues.push({
      code: 'TOROSO_SWING_EXCESSIVE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Excessive swing detected in ${swingCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (armAsymCount > 0) {
    const ratio = armAsymCount / assessedDenominator
    issues.push({
      code: 'ARM_ASYMMETRY',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Uneven arm pull detected in ${armAsymCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (viewInvalidReps > 0) {
    const ratio = totalReps > 0 ? viewInvalidReps / totalReps : 1
    issues.push({
      code: 'FRONT_VIEW_UNSTABLE',
      severity: ratio >= 0.4 ? 'warning' : 'info',
      message: `Front-view alignment unstable in ${viewInvalidReps}/${totalReps} total reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (unassessedReps > 0) {
    const ratio = totalReps > 0 ? unassessedReps / totalReps : 1
    issues.push({
      code: 'REPS_UNASSESSED',
      severity: ratio >= 0.35 ? 'warning' : 'info',
      message: `${unassessedReps}/${totalReps} reps could not be quality-assessed due to unstable or incomplete keypoints.`,
      atFrame: null
    })
  }

  for (const [message, count] of sortedFrameMessages) {
    const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
    const text = message.toLowerCase()
    const isFrontWarn = text.includes('face the camera') || text.includes('front')
    const isLowConfidenceWarn = text.includes('low keypoint confidence') || text.includes('incomplete keypoints')
    if (!isFrontWarn && !isLowConfidenceWarn) continue
    if (avgTrackingQuality >= 0.62 && ratio < 0.28) continue
    if (ratio < 0.18) continue
    const code = isFrontWarn ? 'FRONT_VIEW_DRIFT_FRAMES' : 'KEYPOINT_CONFIDENCE_LOW_FRAMES'
    if (!issues.some((item) => item.code === code)) {
      issues.push({
        code,
        severity: ratio >= 0.4 ? 'warning' : 'info',
        message: isFrontWarn
          ? `Frequent front-view drift seen in ${Math.round(ratio * 100)}% of analyzed frames.`
          : `Keypoint confidence instability seen in ${Math.round(ratio * 100)}% of analyzed frames.`,
        atFrame: null
      })
    }
  }

  const highQualitySample = (input.lastFeedback?.session.accuracyPct ?? 0) >= 95 && incorrectReps === 0
  const fastRepRatio = effectiveReps > 0 ? sessionFastRepCount / effectiveReps : 0
  const slowRepRatio = effectiveReps > 0 ? sessionSlowRepCount / effectiveReps : 0
  if (!highQualitySample && effectiveReps >= 3 && sessionFastRepCount >= 2 && fastRepRatio >= 0.45 && avgRepDurationSec !== null && avgRepDurationSec < 1.2) {
    issues.push({
      code: 'TEMPO_TOO_FAST',
      severity: fastRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is fast in ${sessionFastRepCount}/${effectiveReps} assessed reps (${Math.round(fastRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (!highQualitySample && effectiveReps >= 3 && sessionSlowRepCount >= 2 && slowRepRatio >= 0.45 && avgRepDurationSec !== null && avgRepDurationSec > 5.0) {
    issues.push({
      code: 'TEMPO_TOO_SLOW',
      severity: slowRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is slow in ${sessionSlowRepCount}/${effectiveReps} assessed reps (${Math.round(slowRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (!highQualitySample && effectiveReps >= 3 && sessionFastRepCount >= 1 && sessionSlowRepCount >= 1) {
    issues.push({
      code: 'TEMPO_UNSTABLE',
      severity: 'info',
      message: 'Tempo stability is inconsistent across reps. Keep pull and lower rhythm more uniform.',
      atFrame: null
    })
  }

  const repReasons = input.lastFeedback?.lastRepReasonLabels ?? []
  for (const reason of repReasons) {
    const text = reason.trim()
    if (!text) continue
    const code = toIssueCode(text)
    if (issues.some((x) => x.code === code)) continue
    issues.unshift({ code, severity: 'warning', message: text, atFrame: null })
  }

  if (issues.length === 0) {
    issues.push({
      code: 'NO_OBVIOUS_ISSUES',
      severity: 'info',
      message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
      atFrame: null
    })
  }

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${totalReps}, effective ${effectiveReps}, unassessed ${unassessedReps}, correct ${correctReps}, incorrect ${incorrectReps}, accuracy ${input.lastFeedback.session.accuracyPct}%, avg rep ${avgRepDurationSec ?? '-'}s.`
    : `${summaryPrefix}: no stable pose frames were detected.`

  const suggestions = buildPullupReplaySuggestions(input.lastFeedback, issues, fallbackSuggestion)
  const keyMetrics = {
    totalReps,
    effectiveReps,
    unassessedReps,
    correctReps,
    incorrectReps,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    assessedRepPct,
    avgRepDurationSec,
    fastRepCount: sessionFastRepCount,
    slowRepCount: sessionSlowRepCount,
    topMissCount,
    swingCount,
    armAsymCount,
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
      type: input.source === 'video' ? 'video_live_replay_pullup' : 'live_realtime_pullup',
      modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimePullup17Analyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      effectiveRepCount: effectiveReps,
      unassessedRepCount: unassessedReps,
      assessedRepPct,
      viewInvalidReps,
      elbowAngle: input.lastFeedback?.kneeAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      frontAlignment: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      timelineSampled,
      repFindings
    },
    sections: {
      overview: { generatedAt, status: 'ok', taskId: input.taskId, viewAngle: input.viewAngle, exerciseName: input.exercise?.name ?? null, summary },
      metrics: keyMetrics,
      errorStats: computeReportErrorStats(issues),
      suggestions,
      timelineSampled,
      repFindings
    }
  })
}

export function buildPullupVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  nativeFrames?: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimePullup17Analyzer()
  analyzer.setTempo(VIDEO_DEFAULT_PULLUP17_TEMPO)
  analyzer.setAnalyzerFps(input.fps)
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  let lastRepCount = 0
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    const native = input.nativeFrames?.[i]
    const hasNative = !!native && Array.isArray(native.keypoints) && native.keypoints.length > 0
    if (hasNative || frame.landmarks) {
      const feedback = hasNative ? analyzer.analyzeNative(native!.keypoints) : analyzer.analyze(frame.landmarks!)
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
        tMs: hasNative ? native!.tMs : frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle,
        frontAlignmentDeg: feedback.offsetAngle
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
            tMs: hasNative ? native!.tMs : frame.tMs
          })
        }
        lastRepCount = feedback.repCount
      }
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) input.onProgress(i + 1, total)
  }

  return buildPullupAlignedReport({
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
    repFindings
  })
}

export function buildLateralRaiseAlignedReport(input: {
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
}): PoseAnalysisReport {
  const sortedFrameMessages = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0
  const totalReps = input.lastFeedback?.session.totalReps ?? 0
  const correctReps = input.lastFeedback?.session.correctReps ?? 0
  const incorrectReps = input.lastFeedback?.session.incorrectReps ?? 0
  const effectiveReps = correctReps + incorrectReps
  const unassessedReps = input.lastFeedback?.session.unassessedReps ?? Math.max(0, totalReps - effectiveReps)
  const assessedRepPct = totalReps > 0 ? Math.round((effectiveReps / totalReps) * 100) : 0
  const viewInvalidReps = input.lastFeedback?.session.sideViewWarningCount ?? 0
  const rangeMissCount = input.lastFeedback?.session.depthInsufficientCount ?? 0
  const symmetryCount = input.lastFeedback?.session.kneeOverToeCount ?? 0
  const torsoSwayCount = input.lastFeedback?.session.forwardLeanCount ?? 0
  const elbowCurlCount = input.lastFeedback?.session.backwardLeanCount ?? 0
  const avgRepDurationSec = input.lastFeedback?.session.avgRepDurationSec ?? null
  const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0
  const sessionSlowRepCount = input.lastFeedback?.session.slowRepCount ?? 0
  const fallbackSuggestion = 'Raise both arms smoothly to shoulder height, keep your torso stable, and lower under control.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your upper body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'
  const issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }> = []
  const assessedDenominator = Math.max(1, effectiveReps)

  if (rangeMissCount > 0) {
    const ratio = rangeMissCount / assessedDenominator
    issues.push({
      code: 'RAISE_RANGE_INCOMPLETE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Shoulder height not reached in ${rangeMissCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (torsoSwayCount > 0) {
    const ratio = torsoSwayCount / assessedDenominator
    issues.push({
      code: 'TORSO_SWAY',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Torso sway detected in ${torsoSwayCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (symmetryCount > 0) {
    const ratio = symmetryCount / assessedDenominator
    issues.push({
      code: 'ARM_SYMMETRY',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Symmetry gap detected in ${symmetryCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (elbowCurlCount > 0) {
    const ratio = elbowCurlCount / assessedDenominator
    issues.push({
      code: 'ELBOW_CURL_EXCESSIVE',
      severity: ratio >= 0.45 ? 'error' : ratio >= 0.2 ? 'warning' : 'info',
      message: `Excessive elbow curl detected in ${elbowCurlCount}/${effectiveReps} assessed reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (viewInvalidReps > 0) {
    const ratio = totalReps > 0 ? viewInvalidReps / totalReps : 1
    issues.push({
      code: 'FRONT_VIEW_UNSTABLE',
      severity: ratio >= 0.4 ? 'warning' : 'info',
      message: `Front-view alignment unstable in ${viewInvalidReps}/${totalReps} total reps (${Math.round(ratio * 100)}%).`,
      atFrame: null
    })
  }

  if (unassessedReps > 0) {
    const ratio = totalReps > 0 ? unassessedReps / totalReps : 1
    issues.push({
      code: 'REPS_UNASSESSED',
      severity: ratio >= 0.35 ? 'warning' : 'info',
      message: `${unassessedReps}/${totalReps} reps could not be quality-assessed due to unstable or incomplete keypoints.`,
      atFrame: null
    })
  }

  for (const [message, count] of sortedFrameMessages) {
    const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
    const text = message.toLowerCase()
    const isFrontWarn = text.includes('face the camera') || text.includes('front')
    const isLowConfidenceWarn = text.includes('low keypoint confidence') || text.includes('incomplete keypoints')
    if (!isFrontWarn && !isLowConfidenceWarn) continue
    if (avgTrackingQuality >= 0.62 && ratio < 0.28) continue
    if (ratio < 0.18) continue
    const code = isFrontWarn ? 'FRONT_VIEW_DRIFT_FRAMES' : 'KEYPOINT_CONFIDENCE_LOW_FRAMES'
    if (!issues.some((item) => item.code === code)) {
      issues.push({
        code,
        severity: ratio >= 0.4 ? 'warning' : 'info',
        message: isFrontWarn
          ? `Frequent front-view drift seen in ${Math.round(ratio * 100)}% of analyzed frames.`
          : `Keypoint confidence instability seen in ${Math.round(ratio * 100)}% of analyzed frames.`,
        atFrame: null
      })
    }
  }

  const highQualitySample = (input.lastFeedback?.session.accuracyPct ?? 0) >= 95 && incorrectReps === 0
  const fastRepRatio = effectiveReps > 0 ? sessionFastRepCount / effectiveReps : 0
  const slowRepRatio = effectiveReps > 0 ? sessionSlowRepCount / effectiveReps : 0
  if (!highQualitySample && effectiveReps >= 3 && sessionFastRepCount >= 2 && fastRepRatio >= 0.45 && avgRepDurationSec !== null && avgRepDurationSec < 1.4) {
    issues.push({
      code: 'TEMPO_TOO_FAST',
      severity: fastRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is fast in ${sessionFastRepCount}/${effectiveReps} assessed reps (${Math.round(fastRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (!highQualitySample && effectiveReps >= 3 && sessionSlowRepCount >= 2 && slowRepRatio >= 0.45 && avgRepDurationSec !== null && avgRepDurationSec > 6.0) {
    issues.push({
      code: 'TEMPO_TOO_SLOW',
      severity: slowRepRatio >= 0.65 ? 'warning' : 'info',
      message: `Tempo is slow in ${sessionSlowRepCount}/${effectiveReps} assessed reps (${Math.round(slowRepRatio * 100)}%).`,
      atFrame: null
    })
  }
  if (!highQualitySample && effectiveReps >= 3 && sessionFastRepCount >= 1 && sessionSlowRepCount >= 1) {
    issues.push({
      code: 'TEMPO_UNSTABLE',
      severity: 'info',
      message: 'Tempo stability is inconsistent across reps. Keep lift and lower rhythm more uniform.',
      atFrame: null
    })
  }

  const repReasons = input.lastFeedback?.lastRepReasonLabels ?? []
  for (const reason of repReasons) {
    const text = reason.trim()
    if (!text) continue
    const code = toIssueCode(text)
    if (issues.some((x) => x.code === code)) continue
    issues.unshift({ code, severity: 'warning', message: text, atFrame: null })
  }

  if (issues.length === 0) {
    issues.push({
      code: 'NO_OBVIOUS_ISSUES',
      severity: 'info',
      message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
      atFrame: null
    })
  }

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${totalReps}, effective ${effectiveReps}, unassessed ${unassessedReps}, correct ${correctReps}, incorrect ${incorrectReps}, accuracy ${input.lastFeedback.session.accuracyPct}%.`
    : `${summaryPrefix}: no stable pose frames were detected.`
  const suggestions = buildLateralRaiseReplaySuggestions(input.lastFeedback, issues, fallbackSuggestion)
  const keyMetrics = {
    totalReps,
    effectiveReps,
    unassessedReps,
    correctReps,
    incorrectReps,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    assessedRepPct,
    avgRepDurationSec,
    fastRepCount: sessionFastRepCount,
    slowRepCount: sessionSlowRepCount,
    rangeMissCount,
    symmetryCount,
    torsoSwayCount,
    elbowCurlCount,
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
      type: input.source === 'video' ? 'video_live_replay_lateral_raise' : 'live_realtime_lateral_raise',
      modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimeLateralRaise17Analyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      effectiveRepCount: effectiveReps,
      unassessedRepCount: unassessedReps,
      assessedRepPct,
      viewInvalidReps,
      raiseAngle: input.lastFeedback?.kneeAngle ?? null,
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

export function buildLateralRaiseVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  nativeFrames?: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeLateralRaise17Analyzer()
  analyzer.setTempo(VIDEO_DEFAULT_LATERAL_RAISE17_TEMPO)
  analyzer.setAnalyzerFps(input.fps)
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  let lastRepCount = 0
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    const native = input.nativeFrames?.[i]
    const hasNative = !!native && Array.isArray(native.keypoints) && native.keypoints.length > 0
    if (hasNative || frame.landmarks) {
      const feedback = hasNative ? analyzer.analyzeNative(native!.keypoints) : analyzer.analyze(frame.landmarks!)
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
        tMs: hasNative ? native!.tMs : frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle,
        frontAlignmentDeg: feedback.offsetAngle
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
            tMs: hasNative ? native!.tMs : frame.tMs
          })
        }
        lastRepCount = feedback.repCount
      }
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }

  return buildLateralRaiseAlignedReport({
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
    repFindings
  })
}

export function getRepsFromReport(report: PoseAnalysisReport) {
  const keyMetrics = (report as unknown as Record<string, unknown>).keyMetrics
  if (keyMetrics && typeof keyMetrics === 'object' && !Array.isArray(keyMetrics)) {
    const totalReps = (keyMetrics as Record<string, unknown>).totalReps
    if (typeof totalReps === 'number' && Number.isFinite(totalReps) && totalReps >= 0) return Math.max(0, Math.round(totalReps))
  }
  const repCount = (report as unknown as Record<string, unknown>).repCount
  if (typeof repCount === 'number' && Number.isFinite(repCount) && repCount >= 0) return Math.max(0, Math.round(repCount))
  return 0
}

export function evaluateRangeCheck(feedback: RealtimeFeedback | null, exerciseSlug: ExerciseSlug) {
  if (!feedback) return { ok: false, reason: 'Waiting for stable tracking' }
  if (feedback.lastRepReasonLabels.length > 0) {
    return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' }
  }
  if (feedback.issues.length > 0) {
    return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.torsoAngle === 'number' && feedback.torsoAngle > 35) {
    return { ok: false, reason: 'Excessive forward lean' }
  }
  if (exerciseSlug === 'lateral-raise' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle >= 60) {
    return { ok: true, reason: 'Raise height reached' }
  }
  if ((exerciseSlug === 'pushup' || exerciseSlug === 'pullup' || exerciseSlug === 'bench-press') && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
    return { ok: true, reason: exerciseSlug === 'pushup' ? 'Push-up depth reached' : exerciseSlug === 'pullup' ? 'Top position reached' : 'Bench depth reached' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
    return { ok: true, reason: 'Depth reached' }
  }
  return { ok: true, reason: 'Current rep is in range' }
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getSessionComment(accuracyPct: number, reps: number, exerciseSlug: ExerciseSlug) {
  if (reps <= 0) {
    return exerciseSlug === 'lateral-raise'
      ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
      : exerciseSlug === 'pushup'
        ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
        : exerciseSlug === 'pullup'
          ? 'No completed reps were detected. Pull with full range and lower under control.'
          : exerciseSlug === 'bench-press'
            ? 'No completed reps were detected. Lower to stable depth and press with a controlled path.'
            : 'No completed reps were detected. Try a full-depth squat with a steady tempo.'
  }
  if (accuracyPct >= 90) return 'Excellent consistency. Keep the same depth and tempo in your next set.'
  if (accuracyPct >= 75) return 'Good overall form. Focus on the repeated issues to improve consistency.'
  if (accuracyPct >= 50) return 'Mixed quality set. Slow down and prioritize controlled reps.'
  return 'Form is not stable yet. Reduce speed and focus on one correction cue at a time.'
}

export function getTopIssues(snapshot: RealtimeFeedback | null) {
  if (!snapshot) return []
  const raw = [...(snapshot.lastRepReasonLabels ?? []), ...(snapshot.issues?.map((x) => x.message) ?? []), ...(snapshot.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(normalized)
    if (deduped.length >= 2) break
  }
  return deduped
}

export function getTopRepIssuesFromFindings(findings: SquatRepFinding[], limit = 2) {
  if (!Array.isArray(findings) || findings.length === 0) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of findings) {
    if (item.result !== 'incorrect') continue
    const candidates = item.reasons.length > 0 ? item.reasons : [item.primaryIssue]
    for (const reason of candidates) {
      const text = reason.trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      out.push(text)
      if (out.length >= Math.max(1, limit)) return out
    }
  }
  return out
}

export function getTopIssuesFromMessageFreq(messageFreq: Map<string, number>, limit = 2) {
  return Array.from(messageFreq.entries())
    .filter(([message, count]) => !!message.trim() && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([message]) => message)
}

export function collectLiveIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.lastRepReasonLabels ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

export function collectLiveFrameIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

export function buildLiveSuggestions(feedback: RealtimeFeedback | null, fallbackSuggestion: string, exerciseSlug: ExerciseSlug) {
  const suggestions = new Set<string>()
  const messages = collectLiveIssueMessages(feedback)
  for (const message of messages) {
    const mapped = mapSuggestionFromIssue(message, exerciseSlug)
    if (mapped) suggestions.add(mapped)
  }
  if (suggestions.size === 0 && fallbackSuggestion.trim()) suggestions.add(fallbackSuggestion.trim())
  if (suggestions.size === 0) {
    suggestions.add(
      exerciseSlug === 'lateral-raise'
        ? 'Keep your movement controlled and face the camera for balanced left-right tracking.'
        : exerciseSlug === 'pushup'
          ? 'Keep your core tight and move through a full push-up range with controlled tempo.'
          : exerciseSlug === 'pullup'
            ? 'Use a steady pull-up tempo and avoid body swing during both ascent and descent.'
            : exerciseSlug === 'bench-press'
              ? 'Keep your setup stable and press with controlled tempo through full range.'
              : 'Keep your movement controlled and maintain a stable side-view camera angle.'
    )
  }
  return Array.from(suggestions).slice(0, 4)
}

export function createAnalyzer(exerciseSlug: ExerciseSlug): RealtimeAnalyzer {
  if (exerciseSlug === 'squat') return new RealtimeSquat17Analyzer()
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaise17Analyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullup17Analyzer()
  if (exerciseSlug === 'bench-press') return new RealtimeBenchPressAnalyzer()
  return new RealtimeSquat17Analyzer()
}

function sampleTimelineRows<T>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max <= 0) return []
  const step = Math.max(1, Math.ceil(items.length / max))
  const out: T[] = []
  for (let i = 0; i < items.length; i += step) out.push(items[i]!)
  return out.slice(0, max)
}

function computeReportErrorStats(issues: Array<{ code: string; severity: 'info' | 'warning' | 'error' }>) {
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

function buildSquatReplaySuggestions(
  feedback: RealtimeFeedback | null,
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }>,
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...issues].sort((a, b) => {
    const rank = (value: 'info' | 'warning' | 'error') => (value === 'error' ? 3 : value === 'warning' ? 2 : 1)
    return rank(b.severity) - rank(a.severity)
  })

  for (const issue of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(issue.message, 'squat')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start fully upright, descend until thighs are near parallel, then stand tall to complete each rep.')
    }
    const accuracy = feedback.session.accuracyPct ?? 0
    if (accuracy < 70) {
      suggestions.add('Slow down each rep: 2 seconds down, brief pause, then drive up with controlled tempo.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Place the camera at hip height, keep your full body visible, and improve front lighting.')
    }
    if ((feedback.session.kneeOverToeCount ?? 0) > 0) {
      suggestions.add('Control knee travel: initiate each rep by sitting hips back, then keep shin angle stable over mid-foot.')
    }
    if ((feedback.session.forwardLeanCount ?? 0) > 0) {
      suggestions.add('Reduce torso lean: keep chest proud, brace before descent, and maintain bar-path/center-of-mass over mid-foot.')
    }
    if ((feedback.session.sideViewWarningCount ?? 0) > 0) {
      suggestions.add('Keep your body profile side-on for the full rep so form checks remain valid.')
    }
    if ((feedback.session.unassessedReps ?? 0) > 0) {
      suggestions.add('Some reps were not assessable: step back slightly and keep shoulders, hips, knees, and ankles visible.')
    }
    const avgRepDurationSec = feedback.session.avgRepDurationSec ?? null
    const fastRepCount = feedback.session.fastRepCount ?? 0
    const slowRepCount = feedback.session.slowRepCount ?? 0
    if (avgRepDurationSec !== null) {
      if (accuracy < 95 && (fastRepCount >= 1 || avgRepDurationSec < 1.1)) {
        suggestions.add('Your squat tempo is a bit fast. Aim for about 2s down, brief pause, and controlled rise.')
      } else if (slowRepCount >= 1 || avgRepDurationSec > 3.8) {
        suggestions.add('Your squat tempo is quite slow. Keep tension, but try a smoother continuous rhythm per rep.')
      } else {
        suggestions.add('Tempo looks stable. Keep this rhythm to maintain depth control and consistent form.')
      }
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
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

function analyzePushupTempoFromTimeline(timelineRows: SquatTimelineRow[]) {
  const DESCENT_FAST_SEC = 0.52
  const ASCENT_FAST_SEC = 0.5
  const MIN_PHASE_SEC = 0.2
  const DIRECTION_SWITCH_MIN_FRAMES = 2
  let fastDescentCount = 0
  let fastAscentCount = 0

  let prevAngle: number | null = null
  let phaseMode: 'idle' | 'descent' | 'ascent' = 'idle'
  let phaseStartMs: number | null = null
  let descentStreak = 0
  let ascentStreak = 0

  function resetDirectionStreak() {
    descentStreak = 0
    ascentStreak = 0
  }

  function maybeCountFast(phase: 'descent' | 'ascent', sec: number) {
    if (sec < MIN_PHASE_SEC) return
    if (phase === 'descent' && sec < DESCENT_FAST_SEC) fastDescentCount += 1
    if (phase === 'ascent' && sec < ASCENT_FAST_SEC) fastAscentCount += 1
  }

  for (const row of timelineRows) {
    const angle = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (row.phase === 'bottom') {
      if (phaseMode === 'descent' && phaseStartMs !== null) maybeCountFast('descent', (row.tMs - phaseStartMs) / 1000)
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevAngle = angle
      continue
    }
    if (row.phase === 'up') {
      if (phaseMode === 'ascent' && phaseStartMs !== null) maybeCountFast('ascent', (row.tMs - phaseStartMs) / 1000)
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevAngle = angle
      continue
    }
    if (row.phase !== 'bottom' && angle !== null && prevAngle !== null) {
      const diff = angle - prevAngle
      if (diff <= -1.4) {
        descentStreak += 1
        ascentStreak = 0
        if (descentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'descent') {
          phaseMode = 'descent'
          phaseStartMs = row.tMs
        }
      } else if (diff >= 1.4) {
        ascentStreak += 1
        descentStreak = 0
        if (ascentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'ascent') {
          phaseMode = 'ascent'
          phaseStartMs = row.tMs
        }
      } else {
        resetDirectionStreak()
      }
    }
    prevAngle = angle
  }

  return { fastDescentCount, fastAscentCount }
}

function buildPushupReplaySuggestions(
  feedback: RealtimeFeedback | null,
  sortedIssues: Array<[string, number]>,
  tempoCheck: { fastDescentCount: number; fastAscentCount: number },
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...sortedIssues].sort((a, b) => b[1] - a[1])

  for (const [message] of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'pushup')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (tempoCheck.fastDescentCount > 0 || tempoCheck.fastAscentCount > 0) {
    suggestions.add('Slow down each rep: control the descent, brief pause, then press up smoothly.')
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start in a stable plank, lower until elbows bend clearly, then press back to full lockout.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Use better front lighting, keep your full body visible, and set a clean side-view camera angle.')
    }
    if ((feedback.session.accuracyPct ?? 0) < 70) {
      suggestions.add('Keep shoulders, hips, and ankles aligned. Avoid letting hips drop during the descent.')
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}

function buildPullupReplaySuggestions(
  feedback: RealtimeFeedback | null,
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }>,
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()

  const prioritizedIssues = [...issues].sort((a, b) => {
    const rank = (value: 'info' | 'warning' | 'error') => (value === 'error' ? 3 : value === 'warning' ? 2 : 1)
    return rank(b.severity) - rank(a.severity)
  })

  for (const issue of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(issue.message, 'pullup')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start from a dead hang, pull smoothly until chin clears the bar, then return to full elbow extension.')
    }
    if ((feedback.session.depthInsufficientCount ?? 0) > 0) {
      suggestions.add('Aim for chin-over-bar at the top. Think chest-to-bar and finish with a brief controlled hold.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Improve lighting and keep both hands, head, shoulders, and hips visible throughout each rep.')
    }
    const avgRepDurationSec = feedback.session.avgRepDurationSec ?? null
    const fastRepCount = feedback.session.fastRepCount ?? 0
    const slowRepCount = feedback.session.slowRepCount ?? 0
    if (avgRepDurationSec !== null && (fastRepCount > 0 || slowRepCount > 0)) {
      if (fastRepCount > slowRepCount) {
        suggestions.add('Tempo is fast. Add a brief top pause and lower under control without dropping.')
      } else if (slowRepCount > fastRepCount) {
        suggestions.add('Tempo is slow. Keep control, but avoid long dead-hang stalls; use a smoother continuous rhythm.')
      }
    }
    if ((feedback.session.accuracyPct ?? 0) < 70) {
      suggestions.add('Focus on one cue per set: reduce swing first, then improve top range, then keep both arms even.')
    }
    if ((feedback.session.unassessedReps ?? 0) > 0) {
      suggestions.add('Reduce unassessed reps: keep both wrists, shoulders, and hips visible and avoid turning away from the camera.')
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}

function buildLateralRaiseReplaySuggestions(
  feedback: RealtimeFeedback | null,
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }>,
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...issues].sort((a, b) => {
    const rank = (value: 'info' | 'warning' | 'error') => (value === 'error' ? 3 : value === 'warning' ? 2 : 1)
    return rank(b.severity) - rank(a.severity)
  })

  for (const issue of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(issue.message, 'lateral-raise')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Raise both arms to about shoulder height, pause briefly, then lower under control.')
    }
    if ((feedback.session.depthInsufficientCount ?? 0) > 0) {
      suggestions.add('Reach shoulder height at the top. Think “wrists to shoulder line” before lowering.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Face the camera, improve lighting, and keep shoulders, elbows, wrists, and torso visible.')
    }
    if ((feedback.session.accuracyPct ?? 0) < 70) {
      suggestions.add('Lower the load and focus on one cue: no torso sway, then improve symmetry, then keep elbows softly fixed.')
    }
    if ((feedback.session.unassessedReps ?? 0) > 0) {
      suggestions.add('Reduce unassessed reps: keep both wrists and elbows fully visible and avoid turning away from the camera.')
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}

function analyzeSquatTempoFromTimeline(timelineRows: SquatTimelineRow[]) {
  const DESCENT_FAST_SEC = 0.4
  const ASCENT_FAST_SEC = 0.4
  const MIN_PHASE_SEC = 0.28
  const DIRECTION_SWITCH_MIN_FRAMES = 3
  let fastDescentCount = 0
  let fastAscentCount = 0

  let prevKnee: number | null = null
  let phaseMode: 'idle' | 'descent' | 'ascent' = 'idle'
  let phaseStartMs: number | null = null
  let descentStreak = 0
  let ascentStreak = 0

  function resetDirectionStreak() {
    descentStreak = 0
    ascentStreak = 0
  }

  function maybeCountFast(phase: 'descent' | 'ascent', sec: number) {
    if (sec < MIN_PHASE_SEC) return
    if (phase === 'descent' && sec < DESCENT_FAST_SEC) fastDescentCount += 1
    if (phase === 'ascent' && sec < ASCENT_FAST_SEC) fastAscentCount += 1
  }

  for (const row of timelineRows) {
    const knee = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (row.phase === 'bottom') {
      if (phaseMode === 'descent' && phaseStartMs !== null) maybeCountFast('descent', (row.tMs - phaseStartMs) / 1000)
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevKnee = knee
      continue
    }
    if (row.phase === 'up') {
      if (phaseMode === 'ascent' && phaseStartMs !== null) maybeCountFast('ascent', (row.tMs - phaseStartMs) / 1000)
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevKnee = knee
      continue
    }
    if (row.phase !== 'bottom' && knee !== null && prevKnee !== null) {
      const diff = knee - prevKnee
      if (diff <= -1.2) {
        descentStreak += 1
        ascentStreak = 0
        if (descentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'descent') {
          phaseMode = 'descent'
          phaseStartMs = row.tMs
        }
      } else if (diff >= 1.2) {
        ascentStreak += 1
        descentStreak = 0
        if (ascentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'ascent') {
          phaseMode = 'ascent'
          phaseStartMs = row.tMs
        }
      } else {
        resetDirectionStreak()
      }
    }
    prevKnee = knee
  }

  return { fastDescentCount, fastAscentCount }
}

function mapSuggestionFromIssue(issue: string, exerciseSlug: ExerciseSlug) {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Lower the load, brace your core, and avoid swinging the torso.'
    if (text.includes('symmetry')) return 'Lift both arms together and match left-right height at the top.'
    if (text.includes('elbow') || text.includes('curl')) return 'Keep a soft elbow bend and move from the shoulder joint.'
    if (text.includes('face the camera') || text.includes('front')) return 'Rotate to face the camera so both arms stay visible.'
    if (text.includes('tempo too fast') || text.includes('too fast')) return 'Slow down: lift up under control, brief pause, then lower slowly.'
    if (text.includes('tempo too slow') || text.includes('too slow')) return 'Keep control, but avoid long stalls; use a smoother continuous rhythm.'
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('depth') || text.includes('deeper') || text.includes('elbow')) {
      return 'Lower further until elbows bend clearly, then press back up under control.'
    }
    if (text.includes('hips too high') || text.includes('avoid raising hips')) {
      return 'Lower hips slightly and keep a stable plank line from shoulders to ankles.'
    }
    if (text.includes('torso') || text.includes('hips')) return 'Brace your core and keep shoulders, hips, and ankles in one line.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve depth and body-line checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'pullup') {
    if (text.includes('kipping') || text.includes('sway') || text.includes('swing')) return 'Reduce swing, brace your core, and keep the pull path controlled.'
    if (text.includes('side-view') || text.includes('side view') || text.includes('face the camera')) return 'Face the camera so both arms stay visible and you can compare left-right control.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
    if (text.includes('tempo too fast') || text.includes('too fast')) return 'Slow down: pause briefly at the top, then lower under control.'
    if (text.includes('tempo too slow') || text.includes('too slow')) return 'Keep control, but avoid long stalls; use a smoother continuous rhythm.'
  }
  if (exerciseSlug === 'bench-press') {
    if (text.includes('torso') || text.includes('bridge')) return 'Keep your torso braced and avoid excessive arch changes between reps.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve bench depth and elbow tracking.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep shoulders, elbows, wrists, and torso visible.'
  }
  if (text.includes('tempo unstable') || text.includes('tempo stability')) {
    return 'Tempo is uneven: keep a consistent cadence (about 2s down and controlled rise) across all reps.'
  }
  if (text.includes('tempo') && text.includes('fast')) {
    return 'Slow down each rep and avoid dropping too quickly at the bottom.'
  }
  if (text.includes('tempo') && text.includes('slow')) {
    return 'Keep tension but reduce long pauses to maintain a smoother continuous tempo.'
  }
  if (text.includes('torso lean')) return 'Brace your core and keep your chest up during the descent.'
  if (text.includes('knee') && text.includes('toes')) {
    return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.'
  }
  if (text.includes('side view')) return 'Set the camera exactly side-on at hip height, 2-3 meters away, with your full body always in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.'
  return ''
}

export function toIssueCode(message: string) {
  return message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
=======
export * from './helpers/types'
export * from './helpers/reportBase'
export * from './helpers/live'
export * from './helpers/analyzers'
export * from './helpers/squatReport'
export * from './helpers/benchPressReport'
export * from './helpers/pushupReport'
export * from './helpers/lateralRaiseReport'
export * from './helpers/pullupReport'
>>>>>>> a7c244ffaa35fe5b39b711aaa6aaf40659bc1868
