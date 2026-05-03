import { useEffect, useMemo, useState } from 'react'

import { getPosePolicy, type PosePolicy } from '../../pose'
import { LIVE_TARGET_FPS, LIVE_SESSION_LIMIT_MS, MAX_VIDEO_BYTES } from './shared'
import type { PoseToolMode } from './types'
import type { SquatTuning } from '../../../lib/pose/realtimeSquatAnalyzer'
import { DEFAULT_POSE_RUNTIME_RULES, type PoseRuntimeRules } from '../helpers'

type UsePoseRuntimePolicyResult = {
  posePolicy: PosePolicy | null
  posePolicyVersion: string
  liveTargetFps: number
  liveTargetFrameMs: number
  liveSessionLimitMs: number
  maxVideoBytes: number
  localInferenceDefault: boolean
  serverConsentRequired: boolean
  tempoFastThresholdSec: number
  poseRuntimeRules: PoseRuntimeRules
  policySquatTuning: Partial<SquatTuning>
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function usePoseRuntimePolicy(_mode: PoseToolMode): UsePoseRuntimePolicyResult {
  const [posePolicy, setPosePolicy] = useState<PosePolicy | null>(null)

  useEffect(() => {
    let active = true
    getPosePolicy()
      .then((policy) => {
        if (!active) return
        setPosePolicy(policy)
      })
      .catch(() => {
        if (!active) return
        setPosePolicy(null)
      })
    return () => {
      active = false
    }
  }, [])

  // Runtime safety: always clamp remote policy values before applying to runtime loops.
  const liveTargetFps = clampNumber(Number(posePolicy?.live?.target_fps ?? LIVE_TARGET_FPS), 1, 120)
  const liveTargetFrameMs = useMemo(() => 1000 / Math.max(1, liveTargetFps), [liveTargetFps])
  const liveSessionLimitMs =
    clampNumber(Number(posePolicy?.live?.session_limit_seconds ?? LIVE_SESSION_LIMIT_MS / 1000), 30, 10 * 60) * 1000
  const maxVideoBytes = clampNumber(Number(posePolicy?.offline?.max_video_bytes ?? MAX_VIDEO_BYTES), 5 * 1024 * 1024, 1024 * 1024 * 1024)
  const posePolicyVersion = posePolicy?.version ?? 'local-default'
  const localInferenceDefault = Boolean(posePolicy?.rules?.privacy?.local_inference_default ?? true)
  const serverConsentRequired = Boolean(posePolicy?.rules?.privacy?.server_upload_requires_explicit_consent ?? true)
  const tempoFastThresholdSec = clampNumber(Number(posePolicy?.rules?.realtime?.tempo_fast_threshold_seconds ?? 0.4), 0.2, 2.0)
  const poseRuntimeRules: PoseRuntimeRules = useMemo(
    () => ({
      tempoFastThresholdSec,
      pushup: {
        bodyLineWarnRatio: clampNumber(Number(posePolicy?.rules?.pushup?.body_line_warn_ratio ?? DEFAULT_POSE_RUNTIME_RULES.pushup.bodyLineWarnRatio), 0.01, 1),
        bodyLineFailRatio: clampNumber(Number(posePolicy?.rules?.pushup?.body_line_fail_ratio ?? DEFAULT_POSE_RUNTIME_RULES.pushup.bodyLineFailRatio), 0.01, 1),
        depthWarnRatio: clampNumber(Number(posePolicy?.rules?.pushup?.depth_warn_ratio ?? DEFAULT_POSE_RUNTIME_RULES.pushup.depthWarnRatio), 0.01, 1),
        depthFailRatio: clampNumber(Number(posePolicy?.rules?.pushup?.depth_fail_ratio ?? DEFAULT_POSE_RUNTIME_RULES.pushup.depthFailRatio), 0.01, 1)
      },
      lateralRaise: {
        torsoSwayWarnRatio: clampNumber(Number(posePolicy?.rules?.lateral_raise?.torso_sway_warn_ratio ?? DEFAULT_POSE_RUNTIME_RULES.lateralRaise.torsoSwayWarnRatio), 0.01, 1),
        torsoSwayFailRatio: clampNumber(Number(posePolicy?.rules?.lateral_raise?.torso_sway_fail_ratio ?? DEFAULT_POSE_RUNTIME_RULES.lateralRaise.torsoSwayFailRatio), 0.01, 1),
        symmetryWarnRatio: clampNumber(Number(posePolicy?.rules?.lateral_raise?.symmetry_warn_ratio ?? DEFAULT_POSE_RUNTIME_RULES.lateralRaise.symmetryWarnRatio), 0.01, 1),
        symmetryFailRatio: clampNumber(Number(posePolicy?.rules?.lateral_raise?.symmetry_fail_ratio ?? DEFAULT_POSE_RUNTIME_RULES.lateralRaise.symmetryFailRatio), 0.01, 1)
      },
      bentOverRow: {
        backAngleWarnDeg: clampNumber(Number(posePolicy?.rules?.bent_over_row?.back_angle_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.bentOverRow.backAngleWarnDeg), 5, 90),
        backAngleFailDeg: clampNumber(Number(posePolicy?.rules?.bent_over_row?.back_angle_fail_deg ?? DEFAULT_POSE_RUNTIME_RULES.bentOverRow.backAngleFailDeg), 5, 110),
        rangeWarnRatio: clampNumber(Number(posePolicy?.rules?.bent_over_row?.range_warn_ratio ?? DEFAULT_POSE_RUNTIME_RULES.bentOverRow.rangeWarnRatio), 0.01, 1),
        rangeFailRatio: clampNumber(Number(posePolicy?.rules?.bent_over_row?.range_fail_ratio ?? DEFAULT_POSE_RUNTIME_RULES.bentOverRow.rangeFailRatio), 0.01, 1)
      },
      analyzerTuning: {
        pushup: {
          trackingQualityMinForCount: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.tracking_quality_min_for_count ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.trackingQualityMinForCount), 0.05, 0.95),
          trackingQualityMinForAssess: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.tracking_quality_min_for_assess ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.trackingQualityMinForAssess), 0.05, 0.95),
          sideViewWarnDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.side_view_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.sideViewWarnDeg), 5, 120),
          depthRequiredElbowAngle: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.depth_required_elbow_angle ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.depthRequiredElbowAngle), 60, 170),
          bodyLineFailAngle: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.body_line_fail_angle ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.bodyLineFailAngle), 90, 180),
          hipSagHardDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.hip_sag_hard_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.hipSagHardDeg), 1, 80),
          hipPikeHardDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.pushup?.hip_pike_hard_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup.hipPikeHardDeg), 1, 80)
        },
        lateralRaise: {
          trackingQualityMin: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.tracking_quality_min ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.trackingQualityMin), 0.05, 0.95),
          torsoSwayWarnDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.torso_sway_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.torsoSwayWarnDeg), 1, 80),
          torsoSwayFailDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.torso_sway_fail_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.torsoSwayFailDeg), 1, 100),
          symmetryWarnDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.symmetry_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.symmetryWarnDeg), 1, 80),
          symmetryFailDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.symmetry_fail_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.symmetryFailDeg), 1, 100),
          topRangeMinDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.lateral_raise?.top_range_min_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise.topRangeMinDeg), 30, 140)
        },
        bentOverRow: {
          trackingQualityMin: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.tracking_quality_min ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.trackingQualityMin), 0.05, 0.95),
          torsoLeanWarnDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.torso_lean_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.torsoLeanWarnDeg), 5, 90),
          torsoLeanFailDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.torso_lean_fail_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.torsoLeanFailDeg), 5, 110),
          symmetryWarnDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.symmetry_warn_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.symmetryWarnDeg), 1, 80),
          symmetryFailDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.symmetry_fail_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.symmetryFailDeg), 1, 100),
          topRangeMinDeg: clampNumber(Number(posePolicy?.rules?.analyzer?.bent_over_row?.top_range_min_deg ?? DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow.topRangeMinDeg), 30, 160)
        }
      }
    }),
    [posePolicy, tempoFastThresholdSec]
  )
  const policySquatTuning: Partial<SquatTuning> = useMemo(
    () => ({
      kneeForwardWarnRatio: clampNumber(Number(posePolicy?.rules?.squat?.knee_forward_warn_ratio ?? 0.045), 0.01, 0.3),
      kneeForwardFailRatio: clampNumber(Number(posePolicy?.rules?.squat?.knee_forward_fail_ratio ?? 0.058), 0.01, 0.35),
      forwardLeanWarnDeg: clampNumber(Number(posePolicy?.rules?.squat?.forward_lean_warn_deg ?? 40), 10, 80),
      forwardLeanFailDeg: clampNumber(Number(posePolicy?.rules?.squat?.forward_lean_fail_deg ?? 55), 15, 90),
      trackingQualityMin: clampNumber(Number(posePolicy?.rules?.realtime?.tracking_quality_min ?? 0.28), 0.05, 0.95)
    }),
    [posePolicy]
  )

  return {
    posePolicy,
    posePolicyVersion,
    liveTargetFps,
    liveTargetFrameMs,
    liveSessionLimitMs,
    maxVideoBytes,
    localInferenceDefault,
    serverConsentRequired,
    tempoFastThresholdSec,
    poseRuntimeRules,
    policySquatTuning
  }
}


