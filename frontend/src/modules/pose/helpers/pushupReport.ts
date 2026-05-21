import { normalizeReportForArchive } from '../../../lib/report/unified'
import type { PoseAnalysisReport } from '../reporting/types'
import type { PoseAnalyzerFeedback } from '../analyzer/types'
import { DEFAULT_PUSHUP_TUNING, PushupVideoAnalyzer, type PushupTuning } from '../analyzer/pushup'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectAnalyzerReplayStats } from './replayStats'
import { computeReportErrorStats, sampleTimelineRows, toIssueCode } from './reportBase'
import { mapSuggestionFromIssue } from './suggestionMap'
import type { SquatRepFinding, SquatTimelineRow } from './types'
import { DEFAULT_POSE_RUNTIME_RULES, severityFromRatio, type PoseRuntimeRules } from './policyRules'
import { isPoseDebugEnabled } from '../debugFlags'

export function buildPushupAlignedReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  tuning?: Partial<PushupTuning>
  lastFeedback: PoseAnalyzerFeedback | null
  messageFreq: Map<string, number>
  analyzedFrameCount: number
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  repFindings?: SquatRepFinding[]
  tempoFastThresholdSec?: number
  rules?: PoseRuntimeRules['pushup']
}): PoseAnalysisReport {
  const rules = input.rules ?? DEFAULT_POSE_RUNTIME_RULES.pushup
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

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
  const depthInsufficientCount = input.lastFeedback?.session.depthInsufficientCount ?? 0
  const hipsSagCount = input.lastFeedback?.session.forwardLeanCount ?? 0
  const hipsHighCount = input.lastFeedback?.session.backwardLeanCount ?? 0
  const repFindings = input.repFindings ?? []

  let minElbowAngle: number | null = null
  for (const row of input.timelineRows) {
    const angle = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (angle === null) continue
    minElbowAngle = minElbowAngle === null ? angle : Math.min(minElbowAngle, angle)
  }

  const fallbackSuggestion = 'Brace your core. Keep a straight line from shoulders to ankles. Lower under control.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : 'No valid pose frames were detected. Keep your full body in frame and try another video.'

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

  const tempoCheck = analyzePushupTempoFromTimeline(input.timelineRows, input.tempoFastThresholdSec)
  const issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: null }> = []
  const assessedDenominator = Math.max(1, effectiveReps)

  if (depthInsufficientCount > 0) {
    const ratio = depthInsufficientCount / assessedDenominator
    issues.push({
      code: 'DEPTH_INSUFFICIENT',
      severity: severityFromRatio(ratio, { warnRatio: rules.depthWarnRatio, failRatio: rules.depthFailRatio }),
      message: `In ${depthInsufficientCount} of ${effectiveReps} scored reps, you did not go low enough.`,
      atFrame: null
    })
  }
  if (hipsSagCount > 0) {
    const ratio = hipsSagCount / assessedDenominator
    issues.push({
      code: 'HIPS_SAGGING',
      severity: severityFromRatio(ratio, { warnRatio: rules.bodyLineWarnRatio, failRatio: rules.bodyLineFailRatio }),
      message: `In ${hipsSagCount} of ${effectiveReps} scored reps, your hips dropped and your body line was not straight.`,
      atFrame: null
    })
  }
  if (hipsHighCount > 0) {
    const ratio = hipsHighCount / assessedDenominator
    issues.push({
      code: 'HIPS_TOO_HIGH',
      severity: severityFromRatio(ratio, { warnRatio: rules.bodyLineWarnRatio, failRatio: rules.bodyLineFailRatio }),
      message: `In ${hipsHighCount} of ${effectiveReps} scored reps, your hips were too high (body was angled like an upside-down V).`,
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
      message: `${unassessedReps} of ${totalReps} reps were not scored (incomplete range of motion or unclear tracking such as lighting, occlusion, or body not fully visible).`,
      atFrame: null
    })
  }
  for (const message of issueMessages) {
    const count = input.messageFreq.get(message) ?? 0
    const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
    if (ratio < 0.18) continue
    const text = message.toLowerCase()
    if (
      text.includes('low keypoint confidence') ||
      text.includes('side view') ||
      text.includes('depth insufficient') ||
      text.includes('hips sag') ||
      text.includes('hips too high')
    ) {
      continue
    }
    const severity: 'info' | 'warning' | 'error' = ratio >= 0.4 ? 'warning' : 'info'
    issues.push({
      code: toIssueCode(message),
      severity,
      message,
      atFrame: null
    })
    if (issues.length >= 10) break
  }
  if (issues.length === 0) {
    issues.push({
      code: 'NO_OBVIOUS_ISSUES',
      severity: 'info',
      message: 'No major issues were detected.',
      atFrame: null
    })
  }
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

  const summary = input.lastFeedback
    ? `${input.lastFeedback.session.totalReps} reps detected. ${input.lastFeedback.session.correctReps} correct, ${input.lastFeedback.session.incorrectReps} incorrect.`
    : 'No stable body pose was detected. Try brighter light and keep your full body in frame.'

  const suggestions = buildPushupReplaySuggestions(input.lastFeedback, sortedIssues, tempoCheck, fallbackSuggestion)
  const keyMetrics = {
    totalReps,
    effectiveReps,
    unassessedReps,
    assessedRepPct,
    correctReps,
    incorrectReps,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
    minElbowAngleDeg: minElbowAngle,
    avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
    fastRepCount: Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount),
    effectiveFps: input.fps,
    depthInsufficientCount,
    hipsSagCount,
    hipsHighCount,
    sideViewInvalidReps
  }

  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleTimelineRows(input.timelineRows, 180)
  const timelineSeries = [
    { key: 'kneeAngleDeg', label: 'Elbow Angle' },
    { key: 'hipAngleDeg', label: 'Body Line Angle' },
    { key: 'torsoFromVerticalDeg', label: 'Torso Angle' }
  ]
  const effectiveTuning = { ...DEFAULT_PUSHUP_TUNING, ...(input.tuning ?? {}) }

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
      type: 'video_replay_pushup',
      modelName: 'MoveNet Lightning (offline replay)',
      analyzer: 'PushupVideoAnalyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      effectiveRepCount: effectiveReps,
      unassessedRepCount: unassessedReps,
      assessedRepPct,
      sideViewInvalidReps,
      depthInsufficientCount,
      hipsSagCount,
      hipsHighCount,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      elbowAngle: input.lastFeedback?.kneeAngle ?? null,
      bodyLineAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      sideAlignment: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      lastRepResult: input.lastFeedback?.lastRepResult ?? null,
      lastRepMessage: input.lastFeedback?.lastRepMessage ?? null,
      lastRepReasonCodes: input.lastFeedback?.lastRepReasonCodes ?? [],
      lastRepReasonLabels: input.lastFeedback?.lastRepReasonLabels ?? [],
      lastRepFrameCount: input.lastFeedback?.lastRepFrameCount ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      tempo: tempoCheck,
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

export function buildPushupVideoReplayReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  tuning?: Partial<PushupTuning>
  tempoFastThresholdSec?: number
  rules?: PoseRuntimeRules['pushup']
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new PushupVideoAnalyzer()
  analyzer.setTuning({ ...DEFAULT_PUSHUP_TUNING, ...(input.tuning ?? {}) })
  const stats = collectAnalyzerReplayStats({ analyzer, exerciseSlug: 'pushup', nativeFrames: input.nativeFrames, onProgress: input.onProgress })

  return buildPushupAlignedReport({
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
    tempoFastThresholdSec: input.tempoFastThresholdSec,
    rules: input.rules
  })
}

function analyzePushupTempoFromTimeline(timelineRows: SquatTimelineRow[], tempoFastThresholdSec = 0.5) {
  const DESCENT_FAST_SEC = Math.max(0.3, tempoFastThresholdSec + 0.02)
  const ASCENT_FAST_SEC = Math.max(0.3, tempoFastThresholdSec)
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
  feedback: PoseAnalyzerFeedback | null,
  sortedIssues: Array<[string, number]>,
  tempoCheck: { fastDescentCount: number; fastAscentCount: number },
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...sortedIssues].sort((a, b) => b[1] - a[1])

  if (feedback) {
    const totalReps = feedback.session.totalReps ?? 0
    const correctReps = feedback.session.correctReps ?? 0
    const incorrectReps = feedback.session.incorrectReps ?? 0
    const assessedReps = correctReps + incorrectReps
    const unassessedReps = feedback.session.unassessedReps ?? Math.max(0, totalReps - assessedReps)

    if ((feedback.session.depthInsufficientCount ?? 0) > 0) {
      suggestions.add('Lower further until elbows bend clearly, then press back up under control.')
    }
    if ((feedback.session.forwardLeanCount ?? 0) > 0) {
      suggestions.add('Brace your core. Keep a straight line from shoulders to ankles.')
    }
    if ((feedback.session.backwardLeanCount ?? 0) > 0) {
      suggestions.add('Lower hips slightly. Keep a straight line from shoulders to ankles.')
    }
    if (unassessedReps > 0 || (feedback.trackingQuality ?? 0) < 0.45) {
      suggestions.add('Improve lighting. Keep shoulders, hips, knees, and ankles visible.')
      suggestions.add('Use a clear side view so depth and body line can be checked.')
    }
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start in a stable plank, lower until elbows bend clearly, then press back to a stable top position.')
    }
  }

  if (tempoCheck.fastDescentCount > 0 || tempoCheck.fastAscentCount > 0) {
    suggestions.add('Slow down each rep: control down, brief pause, then press up smoothly.')
  }

  for (const [message] of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'pushup')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 5) break
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}
