import { normalizeReportForArchive } from '../../../lib/report/unified'
import { humanizePoseReport } from '../../../lib/pose/feedbackCopy'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import type { PoseAnalysisReport } from '../../../lib/pose/report'
import { stampReportPolicyMeta } from './policyStamp'
import { POSE_TOOL_MESSAGES } from './shared'
import {
  buildBentOverRowAlignedReport,
  buildLateralRaiseAlignedReport,
  buildLiveSuggestions,
  buildPushupAlignedReport,
  buildSquatAlignedReport,
  collectLiveIssueMessages,
  getSessionComment,
  getTopIssues,
  getTopIssuesFromMessageFreq,
  getTopRepIssuesFromFindings,
  toIssueCode,
  type ExerciseSlug,
  type PoseRuntimeRules,
  type SquatRepFinding,
  type SquatTimelineRow
} from '../helpers'
import type { LiveSessionEndReason, LiveSessionStatus, LiveSessionSummary } from './types'

type BuildLiveReportArgs = {
  exercise: { slug: ExerciseSlug; displayName: string }
  taskId: string
  effectiveFps: number | null
  liveTargetFps: number
  feedback: RealtimeFeedback | null
  issueFreq: Map<string, number>
  analyzedFrameCount: number
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  repFindings: SquatRepFinding[]
  currentMainTipLabel: string
  tempoFastThresholdSec: number
  poseRuntimeRules: PoseRuntimeRules
}

type BuildLiveSessionSummaryArgs = {
  snapshot: RealtimeFeedback | null
  elapsedMs: number
  exerciseSlug: ExerciseSlug
  repFindings: SquatRepFinding[]
  issueFreq: Map<string, number>
}

type ResolveStopLiveStateArgs = {
  startedPerfAt: number | null
  nowPerf: number
  liveSessionLimitMs: number
  liveSessionElapsedMs: number
  reason: Exclude<LiveSessionEndReason, null>
}

type ResolveResetLiveStateArgs = {
  running: boolean
  nowIso: string
  nowPerf: number
  previousStartedAt: string | null
}

type BuildLiveTrainingPayloadArgs = {
  startedAt: string
  endedAt: string
  exerciseType: string
  exerciseDisplayName: string
  reps: number
  mainTipLabel: string
  report: Record<string, unknown>
  posePolicyVersion: string
  buildTrainingRecordName: (input: { startedAt: string; exerciseName: string }) => string
}

export function buildLiveReport(args: BuildLiveReportArgs): PoseAnalysisReport {
  const common = {
    source: 'live' as const,
    taskId: args.taskId,
    exercise: { id: args.exercise.slug, name: args.exercise.displayName },
    video: null,
    fps: args.effectiveFps ?? args.liveTargetFps,
    lastFeedback: args.feedback,
    messageFreq: args.issueFreq,
    analyzedFrameCount: args.analyzedFrameCount,
    trackingQualitySamples: args.trackingQualitySamples,
    timelineRows: args.timelineRows,
    repFindings: args.repFindings
  }

  if (args.exercise.slug === 'squat') {
    return buildSquatAlignedReport({ ...common, viewAngle: 'side', tempoFastThresholdSec: args.tempoFastThresholdSec })
  }
  if (args.exercise.slug === 'lateral-raise') {
    return buildLateralRaiseAlignedReport({ ...common, viewAngle: 'front', tempoFastThresholdSec: args.tempoFastThresholdSec, rules: args.poseRuntimeRules.lateralRaise })
  }
  if (args.exercise.slug === 'pushup') {
    return buildPushupAlignedReport({ ...common, viewAngle: 'side', tempoFastThresholdSec: args.tempoFastThresholdSec, rules: args.poseRuntimeRules.pushup })
  }
  if (args.exercise.slug === 'bent-over-row') {
    return buildBentOverRowAlignedReport({ ...common, viewAngle: 'side', rules: args.poseRuntimeRules.bentOverRow })
  }

  const feedback = args.feedback
  const summary = feedback
    ? `Live training: total ${feedback.session.totalReps}, correct ${feedback.session.correctReps}, accuracy ${feedback.session.accuracyPct}%`
    : 'No live training data yet'
  const issueMessages = collectLiveIssueMessages(feedback)
  const suggestions = buildLiveSuggestions(feedback, args.currentMainTipLabel, args.exercise.slug)

  return humanizePoseReport(
    normalizeReportForArchive({
      version: 1,
      status: 'ok',
      tool: 'pose-live',
      generatedAt: new Date().toISOString(),
      summary,
      keyMetrics: {
        totalReps: feedback?.session.totalReps ?? 0,
        correctReps: feedback?.session.correctReps ?? 0,
        incorrectReps: feedback?.session.incorrectReps ?? 0,
        formAccuracyPct: feedback?.session.accuracyPct ?? 0
      },
      modelName: 'MoveNet Lightning',
      effectiveFps: args.effectiveFps,
      repCount: feedback?.repCount ?? 0,
      correctCount: feedback?.correctCount ?? 0,
      incorrectCount: feedback?.incorrectCount ?? 0,
      kneeAngle: feedback?.kneeAngle ?? null,
      hipAngle: feedback?.hipAngle ?? null,
      torsoAngle: feedback?.torsoAngle ?? null,
      offsetAngle: feedback?.offsetAngle ?? null,
      trackingQuality: feedback?.trackingQuality ?? null,
      currentSuggestion: args.currentMainTipLabel,
      warnings: feedback?.warnings ?? [],
      issues: issueMessages.map((message) => ({
        code: toIssueCode(message),
        severity: 'warning',
        message,
        atFrame: null
      })),
      suggestions
    }) as never
  ) as PoseAnalysisReport
}

export function buildLiveSessionSummary(args: BuildLiveSessionSummaryArgs): LiveSessionSummary {
  const repLevelTopIssues = getTopRepIssuesFromFindings(args.repFindings)
  const frameLevelTopIssues = getTopIssuesFromMessageFreq(args.issueFreq)
  const fallbackTopIssues =
    (args.snapshot?.session.incorrectReps ?? 0) > 0
      ? getTopIssues(args.snapshot)
      : frameLevelTopIssues.length > 0
        ? frameLevelTopIssues
        : []

  return {
    durationSec: Math.round(args.elapsedMs / 1000),
    reps: args.snapshot?.session.totalReps ?? 0,
    correctReps: args.snapshot?.session.correctReps ?? 0,
    incorrectReps: args.snapshot?.session.incorrectReps ?? 0,
    accuracyPct: args.snapshot?.session.accuracyPct ?? 0,
    sessionComment: getSessionComment(args.snapshot?.session.accuracyPct ?? 0, args.snapshot?.session.totalReps ?? 0, args.exerciseSlug),
    topIssues: repLevelTopIssues.length > 0 ? repLevelTopIssues : fallbackTopIssues
  }
}

export function resolveStopLiveState(args: ResolveStopLiveStateArgs) {
  const elapsedMs = args.startedPerfAt
    ? Math.min(args.liveSessionLimitMs, Math.max(0, args.nowPerf - args.startedPerfAt))
    : args.liveSessionElapsedMs
  const status: LiveSessionStatus = 'ended'
  return { elapsedMs, status, endReason: args.reason }
}

export function resolveResetLiveState(args: ResolveResetLiveStateArgs) {
  if (args.running) {
    return {
      startedAt: args.nowIso,
      startedPerfAt: args.nowPerf,
      status: 'running' as const,
      endReason: null
    }
  }
  return {
    startedAt: args.previousStartedAt,
    startedPerfAt: null,
    status: 'idle' as const,
    endReason: null
  }
}

export function validateLiveTrainingSave(user: unknown, reps: number) {
  if (!user) return POSE_TOOL_MESSAGES.loginRequiredForLiveSave
  if (reps <= 0) return POSE_TOOL_MESSAGES.noLiveRepsToSave
  return null
}

export function buildLiveTrainingPayload(args: BuildLiveTrainingPayloadArgs) {
  return {
    started_at: args.startedAt,
    ended_at: args.endedAt,
    exercise_type: args.exerciseType,
    note: args.buildTrainingRecordName({ startedAt: args.startedAt, exerciseName: args.exerciseDisplayName }),
    sets: [{ reps: args.reps, note: args.mainTipLabel }],
    report: stampReportPolicyMeta(args.report, args.posePolicyVersion)
  }
}
