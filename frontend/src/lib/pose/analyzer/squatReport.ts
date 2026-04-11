import { normalizeReportForArchive } from '../../report/unified'
import type { PoseAnalysisReport } from '../report'
import type { PoseFrame } from '../mediapipePose'
import { RealtimeSquatAnalyzer, type RealtimeFeedback, type SquatCoreCorrection } from '../realtimeSquat'
import { collectLiveFrameIssueMessages, mapSuggestionFromIssue, toIssueCode } from './issues'
import { computeReportErrorStats, sampleItems } from './reportUtils'

export type SquatTimelineRow = {
  frame: number
  tMs: number
  phase: string
  gateCode?: string
  gatePaused?: boolean
  trackingQuality: number | null
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
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
  gating?: {
    totalFrames: number
    gatedFrames: number
    byCode: Array<{ code: string; count: number }>
    last: { code: string; title: string; reason: string; fix: string } | null
  }
}): PoseAnalysisReport {
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : null
  const avgTrackingQualityForLogic = avgTrackingQuality ?? 0
  const fallbackSuggestion = 'Keep a steady tempo and align your knees with your toes.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your full body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'
  const issueMessages = sortedIssues
    .filter(([message, count]) => {
      const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
      const text = message.toLowerCase()
      const isSideViewWarn = text.includes('side view')
      const isLowConfidenceWarn = text.includes('low keypoint confidence')
      if (text.includes('try to stay in a clear side view for more stable tracking')) return false

      if ((isSideViewWarn || isLowConfidenceWarn) && avgTrackingQualityForLogic >= 0.62) {
        return ratio >= 0.35
      }
      return true
    })
    .map(([message]) => message)

  const tempoCheck = analyzeSquatTempoFromTimeline(input.timelineRows)
  const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0
  const phaseFastRepCount = Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount)
  const unifiedFastRepCount = Math.max(sessionFastRepCount, phaseFastRepCount)
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

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%, avg rep ${input.lastFeedback.session.avgRepDurationSec ?? '-'}s.`
    : `${summaryPrefix}: no stable pose frames were detected.`
  const suggestions = buildSquatReplaySuggestions(input.lastFeedback, sortedIssues, fallbackSuggestion)
  const gateByCodeSorted = input.gating ? [...input.gating.byCode].sort((a, b) => b.count - a.count) : []
  const gatedFramePct = input.gating && input.gating.totalFrames > 0 ? input.gating.gatedFrames / input.gating.totalFrames : 0
  const squatCoreCorrections = summarizeSquatCoreCorrections(input.lastFeedback, tempoCheck)
  const formScore = computeSquatExplainableScore({
    feedback: input.lastFeedback,
    avgTrackingQuality: avgTrackingQualityForLogic,
    gatedFramePct,
    tempoCheck
  })
  const keyMetrics = {
    totalReps: input.lastFeedback?.session.totalReps ?? 0,
    correctReps: input.lastFeedback?.session.correctReps ?? 0,
    incorrectReps: input.lastFeedback?.session.incorrectReps ?? 0,
    unassessedReps: input.lastFeedback?.session.unassessedReps ?? 0,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
    fastRepCount: unifiedFastRepCount,
    slowRepCount: input.lastFeedback?.session.slowRepCount ?? 0,
    avgTrackingQuality: avgTrackingQuality !== null ? Math.round(avgTrackingQuality * 100) / 100 : null,
    formScore: formScore.value,
    scoreEligibility: formScore.value === null ? formScore.reason : 'eligible',
    effectiveFps: input.fps,
    gatedFrames: input.gating?.gatedFrames ?? 0,
    gatedFramePct: Math.round(gatedFramePct * 1000) / 1000,
    topGateCode: gateByCodeSorted[0]?.code ?? null
  }
  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleItems(input.timelineRows, 180)

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
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      kneeAngle: input.lastFeedback?.kneeAngle ?? null,
      hipAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      offsetAngle: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: avgTrackingQuality !== null ? Math.round(avgTrackingQuality * 100) / 100 : null,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      coreCorrections: squatCoreCorrections,
      score: formScore,
      tempo: tempoCheck,
      gating: input.gating ?? null,
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
      timelineSampled,
      gating: input.gating ?? null
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
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeSquatAnalyzer()
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    if (frame.landmarks) {
      const feedback = analyzer.analyzeFrame({ landmarks: frame.landmarks, gatePaused: false })
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
    timelineRows
  })
}

function summarizeSquatCoreCorrections(feedback: RealtimeFeedback | null, tempoCheck: { fastDescentCount: number; fastAscentCount: number }): SquatCoreCorrection[] {
  const assessedReps = feedback ? (feedback.session.correctReps ?? 0) + (feedback.session.incorrectReps ?? 0) : 0
  const totalReps = feedback?.session.totalReps ?? 0
  const depthCount = feedback?.session.depthInsufficientCount ?? 0
  const kneeValgusCount = feedback?.session.kneeValgusCount ?? 0
  const heelLiftCount = feedback?.session.heelLiftCount ?? 0
  const torsoLeanCount = feedback?.session.torsoLeanCount ?? feedback?.session.forwardLeanCount ?? 0
  const tempoCount = Math.max(feedback?.session.tempoDriftCount ?? 0, tempoCheck.fastAscentCount, tempoCheck.fastDescentCount)

  function ratio(count: number) {
    if (!assessedReps) return null
    return Math.round((count / assessedReps) * 1000) / 1000
  }

  function levelFromRatio(r: number | null): { level: SquatCoreCorrection['level']; score: SquatCoreCorrection['levelScore'] } {
    if (r === null) return { level: 'unknown', score: null }
    if (r <= 0.12) return { level: r === 0 ? 'ok' : 'minor', score: r === 0 ? 0 : 1 }
    if (r <= 0.35) return { level: 'moderate', score: 2 }
    return { level: 'severe', score: 3 }
  }

  const depthLevel = levelFromRatio(ratio(depthCount))
  const valgusLevel = levelFromRatio(ratio(kneeValgusCount))
  const heelLevel = levelFromRatio(ratio(heelLiftCount))
  const torsoLevel = levelFromRatio(ratio(torsoLeanCount))
  const tempoLevel = levelFromRatio(ratio(tempoCount))

  return [
    {
      type: 'DEPTH',
      title: depthLevel.level === 'ok' ? 'Depth looks good' : depthLevel.level === 'unknown' ? 'Depth check unavailable' : 'Depth insufficient',
      level: depthLevel.level,
      levelScore: depthLevel.score,
      evidence: { assessedReps, totalReps, insufficientDepthReps: depthCount, ratio: ratio(depthCount) },
      suggestion: 'Aim to descend until thighs are near parallel while keeping balance over mid-foot.',
      joints: [23, 24, 25, 26, 27, 28]
    },
    {
      type: 'KNEE_VALGUS',
      title: valgusLevel.level === 'ok' ? 'Knee tracking looks good' : valgusLevel.level === 'unknown' ? 'Knee tracking unavailable' : 'Knees collapsing inward',
      level: valgusLevel.level,
      levelScore: valgusLevel.score,
      evidence: { assessedReps, totalReps, valgusReps: kneeValgusCount, ratio: ratio(kneeValgusCount) },
      suggestion: 'Drive knees out to track over toes and keep feet rooted.',
      joints: [23, 24, 25, 26, 27, 28]
    },
    {
      type: 'HEEL_LIFT',
      title: heelLevel.level === 'ok' ? 'Heels stay grounded' : heelLevel.level === 'unknown' ? 'Heel contact unavailable' : 'Heels lifting off the ground',
      level: heelLevel.level,
      levelScore: heelLevel.score,
      evidence: { assessedReps, totalReps, heelLiftReps: heelLiftCount, ratio: ratio(heelLiftCount) },
      suggestion: 'Shift pressure to mid-foot/heel and widen stance slightly if needed.',
      joints: [27, 28, 29, 30, 31, 32]
    },
    {
      type: 'TORSO_LEAN',
      title: torsoLevel.level === 'ok' ? 'Torso stays upright' : torsoLevel.level === 'unknown' ? 'Torso lean unavailable' : 'Excessive forward torso lean',
      level: torsoLevel.level,
      levelScore: torsoLevel.score,
      evidence: { assessedReps, totalReps, torsoLeanReps: torsoLeanCount, ratio: ratio(torsoLeanCount) },
      suggestion: 'Keep chest up and brace your core as you descend.',
      joints: [11, 12, 23, 24]
    },
    {
      type: 'TEMPO_DRIFT',
      title: tempoLevel.level === 'ok' ? 'Tempo looks steady' : tempoLevel.level === 'unknown' ? 'Tempo drift unavailable' : 'Tempo drift detected',
      level: tempoLevel.level,
      levelScore: tempoLevel.score,
      evidence: {
        assessedReps,
        totalReps,
        tempoIssueReps: tempoCount,
        ratio: ratio(tempoCount),
        fastDescentCount: tempoCheck.fastDescentCount,
        fastAscentCount: tempoCheck.fastAscentCount,
        avgRepDurationSec: feedback?.session.avgRepDurationSec ?? null,
        fastRepCount: feedback?.session.fastRepCount ?? 0,
        slowRepCount: feedback?.session.slowRepCount ?? 0
      },
      suggestion: 'Use a steady tempo: ~2s down, brief pause, and controlled rise.',
      joints: [11, 12, 23, 24, 25, 26]
    }
  ]
}

function computeSquatExplainableScore(input: {
  feedback: RealtimeFeedback | null
  avgTrackingQuality: number
  gatedFramePct: number
  tempoCheck: { fastDescentCount: number; fastAscentCount: number }
}): { value: number | null; reason: string | null; breakdown: Array<Record<string, unknown>> } {
  const feedback = input.feedback
  const assessedReps = feedback ? (feedback.session.correctReps ?? 0) + (feedback.session.incorrectReps ?? 0) : 0
  if (!feedback) return { value: null, reason: 'no_feedback', breakdown: [] }
  if (input.avgTrackingQuality < 0.45) return { value: null, reason: 'tracking_quality_low', breakdown: [] }
  if (input.gatedFramePct >= 0.6) return { value: null, reason: 'too_many_gated_frames', breakdown: [] }
  if (assessedReps < 2) return { value: null, reason: 'not_enough_assessed_reps', breakdown: [] }

  const depthCount = feedback.session.depthInsufficientCount ?? 0
  const kneeValgusCount = feedback.session.kneeValgusCount ?? 0
  const heelLiftCount = feedback.session.heelLiftCount ?? 0
  const torsoLeanCount = feedback.session.torsoLeanCount ?? feedback.session.forwardLeanCount ?? 0
  const tempoCount = Math.max(feedback.session.tempoDriftCount ?? 0, input.tempoCheck.fastAscentCount, input.tempoCheck.fastDescentCount)

  function ratio(count: number) {
    return assessedReps > 0 ? Math.max(0, Math.min(1, count / assessedReps)) : 0
  }

  const breakdown = [
    {
      type: 'DEPTH',
      label: 'Depth',
      weight: 30,
      ratio: ratio(depthCount),
      penalty: Math.round(ratio(depthCount) * 30 * 10) / 10,
      evidence: { depthInsufficientCount: depthCount, assessedReps },
      suggestion: 'Aim to descend until thighs are near parallel while keeping balance over mid-foot.'
    },
    {
      type: 'KNEE_VALGUS',
      label: 'Knee valgus',
      weight: 25,
      ratio: ratio(kneeValgusCount),
      penalty: Math.round(ratio(kneeValgusCount) * 25 * 10) / 10,
      evidence: { kneeValgusCount, assessedReps },
      suggestion: 'Drive knees out to track over toes and keep feet rooted.'
    },
    {
      type: 'HEEL_LIFT',
      label: 'Heel lift',
      weight: 20,
      ratio: ratio(heelLiftCount),
      penalty: Math.round(ratio(heelLiftCount) * 20 * 10) / 10,
      evidence: { heelLiftCount, assessedReps },
      suggestion: 'Shift pressure to mid-foot/heel and widen stance slightly if needed.'
    },
    {
      type: 'TORSO_LEAN',
      label: 'Torso lean',
      weight: 25,
      ratio: ratio(torsoLeanCount),
      penalty: Math.round(ratio(torsoLeanCount) * 25 * 10) / 10,
      evidence: { torsoLeanCount, assessedReps },
      suggestion: 'Keep chest up and brace your core as you descend.'
    },
    {
      type: 'TEMPO_DRIFT',
      label: 'Tempo drift',
      weight: 15,
      ratio: ratio(tempoCount),
      penalty: Math.round(ratio(tempoCount) * 15 * 10) / 10,
      evidence: { tempoIssueCount: tempoCount, assessedReps, fastDescentCount: input.tempoCheck.fastDescentCount, fastAscentCount: input.tempoCheck.fastAscentCount },
      suggestion: 'Use a steady tempo: ~2s down, brief pause, and controlled rise.'
    }
  ]

  const penaltySum = breakdown.reduce((acc, item) => acc + (typeof item.penalty === 'number' ? item.penalty : 0), 0)
  const value = Math.max(0, Math.min(100, Math.round((100 - penaltySum) * 10) / 10))
  return { value, reason: null, breakdown }
}

function buildSquatReplaySuggestions(feedback: RealtimeFeedback | null, sortedIssues: Array<[string, number]>, fallbackSuggestion: string) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...sortedIssues].sort((a, b) => {
    const aKnee = a[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0
    const bKnee = b[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0
    if (aKnee !== bKnee) return bKnee - aKnee
    return b[1] - a[1]
  })

  for (const [message] of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'squat')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start fully upright, descend until thighs are near parallel, then stand tall to complete each rep.')
    }
    if ((feedback.session.accuracyPct ?? 0) < 70) {
      suggestions.add('Slow down each rep: 2 seconds down, brief pause, then drive up with controlled tempo.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Place the camera at hip height, keep your full body visible, and improve front lighting.')
    }
    const avgRepDurationSec = feedback.session.avgRepDurationSec ?? null
    const fastRepCount = feedback.session.fastRepCount ?? 0
    const slowRepCount = feedback.session.slowRepCount ?? 0
    if (avgRepDurationSec !== null) {
      if (fastRepCount >= 1 || avgRepDurationSec < 1.15) {
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
  const DESCENT_FAST_SEC = 0.62
  const ASCENT_FAST_SEC = 0.58
  const MIN_PHASE_SEC = 0.2
  const DIRECTION_SWITCH_MIN_FRAMES = 2
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
