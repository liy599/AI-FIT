import { normalizeReportForArchive } from '../../lib/report/unified'
import type { PoseAnalysisReport } from '../../lib/pose/report'
import type { NormalizedLandmark, PoseFrame } from '../../lib/pose/mediapipePose'
import { type RealtimeFeedback } from '../../lib/pose/realtimeSquat'
import { RealtimeLateralRaiseAnalyzer } from '../../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../../lib/pose/realtimePushup'
import { RealtimePullupAnalyzer } from '../../lib/pose/realtimePullup'
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
}

export type SquatRepFinding = {
  repNumber: number
  result: 'correct' | 'incorrect' | 'invalid'
  primaryIssue: string
  reasons: string[]
  atFrame: number
  tMs: number
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
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullupAnalyzer()
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
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('torso') || text.includes('hips')) return 'Brace your core and keep shoulders, hips, and ankles in one line.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve depth and body-line checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'pullup') {
    if (text.includes('kipping') || text.includes('sway') || text.includes('swing')) return 'Reduce swing, brace your core, and keep the pull path controlled.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve pull-up range and alignment checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
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
