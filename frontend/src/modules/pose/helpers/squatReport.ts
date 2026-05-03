import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../../../lib/pose/report'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import { RealtimeSquatAnalyzer, VIDEO_DEFAULT_SQUAT_TEMPO } from '../../../lib/pose/realtimeSquatAnalyzer'
import type { MoveNetKeypoint } from '../../../lib/pose/movenetTracker'
import { collectLiveFrameIssueMessages } from './live'
import { computeReportErrorStats, sampleTimelineRows } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import { VIDEO_DEFAULT_SQUAT_TUNING, type SquatTempo, type SquatTuning, type SquatRepFinding, type SquatTimelineRow } from './types'

export { VIDEO_DEFAULT_SQUAT_TEMPO }
export type { SquatTuning, SquatTempo }

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
  tempoFastThresholdSec?: number
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
  const tempoCheck = analyzeSquatTempoFromTimeline(input.timelineRows, input.tempoFastThresholdSec)
  const highQualitySample =
    (input.lastFeedback?.session.accuracyPct ?? 0) >= 95 && (input.lastFeedback?.session.incorrectReps ?? 0) === 0
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
      analyzer: 'RealtimeSquatAnalyzer',
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
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  tuning?: Partial<SquatTuning>
  tempoFastThresholdSec?: number
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeSquatAnalyzer()
  analyzer.setTuning(input.tuning ?? VIDEO_DEFAULT_SQUAT_TUNING)
  analyzer.setTempo(VIDEO_DEFAULT_SQUAT_TEMPO)
  analyzer.setAnalyzerFps(input.fps)
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  let lastRepCount = 0
  const total = input.nativeFrames.length

  for (let i = 0; i < input.nativeFrames.length; i++) {
    const nativeFrame = input.nativeFrames[i]!
    if (nativeFrame.keypoints?.length) {
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
        tMs: nativeFrame.tMs,
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
            tMs: nativeFrame.tMs
          })
        }
        lastRepCount = feedback.repCount
      }
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.nativeFrames.length - 1)) {
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
    repFindings,
    tempoFastThresholdSec: input.tempoFastThresholdSec
  })
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

function analyzeSquatTempoFromTimeline(timelineRows: SquatTimelineRow[], tempoFastThresholdSec = 0.4) {
  // Runtime policy owns fast-tempo sensitivity; local default keeps offline fallback deterministic.
  const DESCENT_FAST_SEC = tempoFastThresholdSec
  const ASCENT_FAST_SEC = tempoFastThresholdSec
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


