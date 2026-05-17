export type PoseRuntimeRules = {
  tempoFastThresholdSec: number
  pushup: {
    bodyLineWarnRatio: number
    bodyLineFailRatio: number
    depthWarnRatio: number
    depthFailRatio: number
  }
  lateralRaise: {
    torsoSwayWarnRatio: number
    torsoSwayFailRatio: number
    symmetryWarnRatio: number
    symmetryFailRatio: number
  }
  bentOverRow: {
    backAngleWarnDeg: number
    backAngleFailDeg: number
    rangeWarnRatio: number
    rangeFailRatio: number
  }
  analyzerTuning: {
    squat: Record<string, number>
    pushup: Record<string, number>
    lateralRaise: Record<string, number>
    bentOverRow: Record<string, number>
  }
}

export const DEFAULT_POSE_RUNTIME_RULES: PoseRuntimeRules = {
  tempoFastThresholdSec: 0.4,
  pushup: {
    bodyLineWarnRatio: 0.2,
    bodyLineFailRatio: 0.45,
    depthWarnRatio: 0.2,
    depthFailRatio: 0.45
  },
  lateralRaise: {
    torsoSwayWarnRatio: 0.12,
    torsoSwayFailRatio: 0.35,
    symmetryWarnRatio: 0.12,
    symmetryFailRatio: 0.35
  },
  bentOverRow: {
    backAngleWarnDeg: 35,
    backAngleFailDeg: 50,
    rangeWarnRatio: 0.12,
    rangeFailRatio: 0.35
  },
  analyzerTuning: {
    squat: {
      kneeForwardWarnRatio: 0.045,
      kneeForwardFailRatio: 0.058,
      kneeForwardFailMinFrames: 2,
      forwardLeanWarnDeg: 40,
      forwardLeanFailDeg: 55,
      forwardLeanFailMinFrames: 5,
      trackingQualityMin: 0.28
    },
    pushup: {
      trackingQualityMinForCount: 0.22,
      trackingQualityMinForAssess: 0.3,
      sideViewWarnDeg: 55,
      depthRequiredElbowAngle: 130,
      bodyLineFailAngle: 145,
      hipSagHardDeg: 28,
      hipPikeHardDeg: 28
    },
    lateralRaise: {
      trackingQualityMin: 0.28,
      torsoSwayWarnDeg: 20,
      torsoSwayFailDeg: 30,
      symmetryWarnDeg: 22,
      symmetryFailDeg: 32,
      topRangeMinDeg: 70
    },
    bentOverRow: {
      trackingQualityMin: 0.28,
      torsoLeanWarnDeg: 35,
      torsoLeanFailDeg: 50,
      symmetryWarnDeg: 18,
      symmetryFailDeg: 28,
      topRangeMinDeg: 90
    }
  }
}

export function resolveAnalyzerTuning(
  exerciseSlug: string,
  rules: PoseRuntimeRules
) {
  if (exerciseSlug === 'squat') return rules.analyzerTuning.squat
  if (exerciseSlug === 'pushup') return rules.analyzerTuning.pushup
  if (exerciseSlug === 'lateral-raise') return rules.analyzerTuning.lateralRaise
  if (exerciseSlug === 'bent-over-row') return rules.analyzerTuning.bentOverRow
  return undefined
}

export function severityFromRatio(
  ratio: number,
  thresholds: { warnRatio: number; failRatio: number }
): 'info' | 'warning' | 'error' {
  if (ratio >= thresholds.failRatio) return 'error'
  if (ratio >= thresholds.warnRatio) return 'warning'
  return 'info'
}


