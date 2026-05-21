﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { humanizePoseReport } from './copy'
import { extractNativePoseFromVideoUrlWithMoveNet, type MoveNetNativeFrame } from '../vision/movenetPose'
import type { PoseAnalysisReport } from './types'
import type { PosePolicy } from '../api'
import type { PoseRuntimeRules } from '../policy'
import { buildBentOverRowVideoReplayReport } from '../helpers/bentOverRowReport'
import { buildLateralRaiseVideoReplayReport } from '../helpers/lateralRaiseReport'
import { buildPushupVideoReplayReport } from '../helpers/pushupReport'
import { buildSquatVideoReplayReport } from '../helpers/squatReport'
import type { OfflineProgress } from '../runtime/types'

const OFFLINE_MOVENET_DETECTOR_VARIANT: 'lightning' | 'thunder' = 'lightning'
const OFFLINE_PREFER_PLAYBACK_SAMPLING = false
const OFFLINE_MOVENET_MIN_VISIBILITY = 0.2
const OFFLINE_ENABLE_STABILIZER = true
const OFFLINE_ENABLE_ANTISWAP = true

type ExerciseMeta = {
  id: string
  slug: string
  displayName: string
  exerciseType: string
}

type LocalVideoMeta = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
}

export type ExtractedOfflinePose = {
  fps: number
  nativeFrames: MoveNetNativeFrame[]
  video: LocalVideoMeta
}

type ExtractOfflinePoseArgs = {
  file: File
  objectUrl: string
  posePolicy: PosePolicy | null
  setOfflineProgress: (progress: OfflineProgress) => void
}

type BuildOfflineReportArgs = {
  taskId: string
  exercise: ExerciseMeta
  effectiveViewAngle: 'unknown' | 'front' | 'side' | 'back'
  extracted: ExtractedOfflinePose
  tempoFastThresholdSec: number
  poseRuntimeRules: PoseRuntimeRules
  setOfflineProgress: (progress: OfflineProgress) => void
}

export function resolveOfflineViewAngle(exerciseSlug: string, fallback: 'unknown' | 'front' | 'side' | 'back') {
  if (exerciseSlug === 'squat' || exerciseSlug === 'bent-over-row') return 'side'
  if (exerciseSlug === 'lateral-raise') return 'front'
  return fallback
}

// The original video stays local; only sampled MoveNet keypoints feed report generation.
export async function extractOfflinePoseFromLocalVideo(args: ExtractOfflinePoseArgs): Promise<ExtractedOfflinePose> {
  const offlineTargetFpsRaw = Number(args.posePolicy?.offline?.analysis_target_fps ?? 30)
  const offlineTargetFps = Number.isFinite(offlineTargetFpsRaw) ? Math.max(1, Math.min(30, Math.round(offlineTargetFpsRaw))) : 30
  const offlineAnalysisLimitSec = Number(args.posePolicy?.offline?.analysis_limit_seconds ?? 120)
  const offlineAnalysisMaxFrames = Math.max(1, Math.floor(offlineTargetFps * offlineAnalysisLimitSec))
  const extracted = await extractNativePoseFromVideoUrlWithMoveNet(args.objectUrl, {
    targetFps: offlineTargetFps,
    maxFrames: offlineAnalysisMaxFrames,
    maxDurationSec: offlineAnalysisLimitSec,
    detectorVariant: OFFLINE_MOVENET_DETECTOR_VARIANT,
    preferPlaybackSampling: OFFLINE_PREFER_PLAYBACK_SAMPLING,
    minVisibility: OFFLINE_MOVENET_MIN_VISIBILITY,
    enableStabilizer: OFFLINE_ENABLE_STABILIZER,
    enableAntiSwap: OFFLINE_ENABLE_ANTISWAP,
    onProgress: (p: { stage: string; processed: number; total: number }) => {
      args.setOfflineProgress({
        stage: p.stage === 'loading' ? 'Loading MoveNet model' : 'Extracting pose keypoints',
        processed: p.processed,
        total: p.total
      })
    }
  })

  let nativeFrames = extracted.nativeFrames
  const baseT = (typeof nativeFrames[0]?.tMs === 'number' && Number.isFinite(nativeFrames[0]!.tMs) ? nativeFrames[0]!.tMs : 0) ?? 0
  const baseTms = Number.isFinite(baseT) && baseT > 0 ? baseT : 0
  if (baseTms > 0) nativeFrames = nativeFrames.map((frame) => ({ ...frame, tMs: Math.max(0, frame.tMs - baseTms) }))

  return {
    fps: extracted.fps,
    nativeFrames,
    video: {
      id: `local-${Date.now()}`,
      originalName: args.file.name,
      mimeType: args.file.type || 'video/mp4',
      sizeBytes: args.file.size
    }
  }
}

export function buildOfflinePoseReport(args: BuildOfflineReportArgs): PoseAnalysisReport {
  const baseInput = {
    taskId: args.taskId,
    viewAngle: args.effectiveViewAngle,
    exercise: { id: args.exercise.id, name: args.exercise.exerciseType },
    video: args.extracted.video,
    fps: args.extracted.fps,
    nativeFrames: args.extracted.nativeFrames
  }

  const rawReport =
    args.exercise.slug === 'squat'
      ? buildSquatVideoReplayReport({
          ...baseInput,
          tuning: args.poseRuntimeRules.analyzerTuning.squat,
          tempoFastThresholdSec: args.tempoFastThresholdSec,
          onProgress: (processed: number, total: number) => args.setOfflineProgress({ stage: 'Replaying squat video analyzer', processed, total })
        })
      : args.exercise.slug === 'lateral-raise'
          ? buildLateralRaiseVideoReplayReport({
              ...baseInput,
              tuning: args.poseRuntimeRules.analyzerTuning.lateralRaise,
              tempoFastThresholdSec: args.tempoFastThresholdSec,
              rules: args.poseRuntimeRules.lateralRaise,
              onProgress: (processed: number, total: number) => args.setOfflineProgress({ stage: 'Replaying lateral-raise video analyzer', processed, total })
            })
        : args.exercise.slug === 'bent-over-row'
            ? buildBentOverRowVideoReplayReport({
                ...baseInput,
                tuning: args.poseRuntimeRules.analyzerTuning.bentOverRow,
                rules: args.poseRuntimeRules.bentOverRow,
                onProgress: (processed: number, total: number) => args.setOfflineProgress({ stage: 'Replaying bent-over-row video analyzer', processed, total })
              })
            : buildPushupVideoReplayReport({
                ...baseInput,
                tuning: args.poseRuntimeRules.analyzerTuning.pushup,
                tempoFastThresholdSec: args.tempoFastThresholdSec,
                rules: args.poseRuntimeRules.pushup,
                onProgress: (processed: number, total: number) => args.setOfflineProgress({ stage: 'Replaying push-up video analyzer', processed, total })
              })

  return humanizePoseReport(rawReport) as PoseAnalysisReport
}



