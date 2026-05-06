import type { PoseAnalysisReport } from './types'
import { POSE_TOOL_MESSAGES, poseToolErrorMessage } from '../runtime/toolUi'
import { stampReportPolicyMeta } from './policyStamp'

type BuildOfflineArchivePayloadArgs = {
  startedAt: string
  endedAt: string
  exerciseType: string
  exerciseDisplayName: string
  reps: number
  report: PoseAnalysisReport
  posePolicyVersion: string
  buildTrainingRecordName: (input: { startedAt: string; exerciseName: string }) => string
}

export function validateOfflineArchiveUser(user: unknown) {
  if (!user) return POSE_TOOL_MESSAGES.loginRequiredForOfflineArchive
  return null
}

export function buildOfflineArchivePayload(args: BuildOfflineArchivePayloadArgs) {
  return {
    started_at: args.startedAt,
    ended_at: args.endedAt,
    exercise_type: args.exerciseType,
    note: args.buildTrainingRecordName({ startedAt: args.startedAt, exerciseName: args.exerciseDisplayName }),
    sets: [{ reps: args.reps, note: 'Auto-saved from video analysis report' }],
    report: stampReportPolicyMeta(args.report as unknown as Record<string, unknown>, args.posePolicyVersion)
  }
}

export function resolveOfflineArchiveStatusMessage(success: boolean, error?: unknown) {
  if (success) return POSE_TOOL_MESSAGES.offlineArchiveSaved
  return poseToolErrorMessage(error, POSE_TOOL_MESSAGES.offlineArchiveSaveFailed)
}

