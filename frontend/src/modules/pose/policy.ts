import { useEffect, useMemo, useState } from 'react'

import { getPosePolicy, type PosePolicy } from './api'
import { DEFAULT_POSE_RUNTIME_RULES, resolveAnalyzerTuning, severityFromRatio, type PoseRuntimeRules } from './helpers/policyRules'
import { MAX_VIDEO_BYTES } from './runtime/toolUi'

export type PosePolicyRuntime = {
  posePolicy: PosePolicy | null
  posePolicyVersion: string
  maxVideoBytes: number
  localInferenceOnly: boolean
  tempoFastThresholdSec: number
  poseRuntimeRules: PoseRuntimeRules
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export type { PoseRuntimeRules }
export { DEFAULT_POSE_RUNTIME_RULES, resolveAnalyzerTuning, severityFromRatio }

export function usePosePolicyRuntime(): PosePolicyRuntime {
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

  const maxVideoBytes = clampNumber(Number(posePolicy?.offline?.max_video_bytes ?? MAX_VIDEO_BYTES), 5 * 1024 * 1024, 1024 * 1024 * 1024)
  const posePolicyVersion = posePolicy?.version ?? 'local-default'
  const localInferenceOnly = Boolean(posePolicy?.rules?.privacy?.local_inference_only ?? true)
  const tempoFastThresholdSec = clampNumber(Number(posePolicy?.rules?.analyzer_common?.tempo_fast_threshold_seconds ?? 0.4), 0.2, 2.0)
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
        squat: { ...DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.squat },
        pushup: { ...DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.pushup },
        lateralRaise: { ...DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.lateralRaise },
        bentOverRow: { ...DEFAULT_POSE_RUNTIME_RULES.analyzerTuning.bentOverRow }
      }
    }),
    [posePolicy, tempoFastThresholdSec]
  )

  return {
    posePolicy,
    posePolicyVersion,
    maxVideoBytes,
    localInferenceOnly,
    tempoFastThresholdSec,
    poseRuntimeRules
  }
}
