import type { NormalizedLandmark } from './mediapipePose'

export type CoachMode = 'beginner' | 'pro'

export type SquatCorrectionType = 'DEPTH' | 'KNEE_VALGUS' | 'HEEL_LIFT' | 'TORSO_LEAN' | 'TEMPO_DRIFT'
export type SquatCorrectionLevel = 'ok' | 'minor' | 'moderate' | 'severe' | 'unknown'

export type SquatCoreCorrection = {
  type: SquatCorrectionType
  title: string
  level: SquatCorrectionLevel
  levelScore: 0 | 1 | 2 | 3 | null
  evidence: Record<string, number | string | null>
  suggestion: string
  joints: number[]
}

export type RealtimeFeedback = {
  phase: 'up' | 'descent' | 'bottom' | 'ascent'
  state: 's1' | 's2' | 's3' | null
  mode: CoachMode
  kneeAngle: number | null
  hipAngle: number | null
  torsoAngle: number | null
  kneeVerticalAngle: number | null
  offsetAngle: number | null
  trackingQuality: number
  hipKneeMatch?: boolean | null
  isCountingPaused: boolean
  warnings: string[]
  issues: Array<{ message: string; joints: number[] }>
  coreCorrections: SquatCoreCorrection[]
  stateSequence: Array<'s2' | 's3'>
  lastRepResult: 'correct' | 'incorrect' | null
  lastRepMessage: string | null
  lastRepReasonCodes: string[]
  lastRepReasonLabels: string[]
  lastRepCorrections: string[]
  correctCount: number
  incorrectCount: number
  repCount: number
  lastRepFrameCount: number | null
  inactiveSeconds: number
  session: {
    totalReps: number
    correctReps: number
    incorrectReps: number
    accuracyPct: number
    unassessedReps?: number
    depthInsufficientCount: number
    kneeOverToeCount: number
    kneeValgusCount: number
    heelLiftCount: number
    forwardLeanCount: number
    backwardLeanCount: number
    torsoLeanCount: number
    sideViewWarningCount: number
    avgRepDurationSec?: number | null
    fastRepCount?: number
    slowRepCount?: number
    tempoDriftCount?: number
  }
}

const LM = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, footIndex: 31, nose: 0, rShoulder: 12 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, footIndex: 32, nose: 0, rShoulder: 11 }
}

const KNEE_OVER_TOE_WARN_RATIO = 0.07
const KNEE_OVER_TOE_FAIL_RATIO = 0.1
const KNEE_OVER_TOE_FAIL_MIN_FRAMES = 3
const FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL = 49
const FORWARD_LEAN_FAIL_MIN_FRAMES = 5
const ASSUMED_ANALYZER_FPS = 24
const REP_FAST_SEC = 0.95
const REP_SLOW_SEC = 3.6
const DEPTH_OK_KNEE_ANGLE = 112
const DEPTH_WARN_KNEE_ANGLE = 118
const DEPTH_FAIL_KNEE_ANGLE = 125
const HEEL_LIFT_MINOR_Y = 0.012
const HEEL_LIFT_MODERATE_Y = 0.025
const HEEL_LIFT_SEVERE_Y = 0.04
const HEEL_LIFT_FAIL_MIN_FRAMES = 3
const KNEE_VALGUS_OK_RATIO = 0.92
const KNEE_VALGUS_MINOR_RATIO = 0.85
const KNEE_VALGUS_MODERATE_RATIO = 0.75
const KNEE_VALGUS_FAIL_MIN_FRAMES = 3
const TORSO_LEAN_OK_ANGLE_FROM_VERTICAL = 30
const TORSO_LEAN_MODERATE_ANGLE_FROM_VERTICAL = 40
const TORSO_LEAN_SEVERE_ANGLE_FROM_VERTICAL = 49
const REP_VALID_MIN_FRAMES = 8
const REP_VALID_RATIO_MIN = 0.45
const TRACKING_QUALITY_MIN = 0.28
const S1_ENTER_KNEE_ANGLE = 154
const S1_EXIT_KNEE_ANGLE = 149
const S3_ENTER_KNEE_ANGLE = 138
const S3_EXIT_KNEE_ANGLE = 146
const FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL = 35
const STATE_SWITCH_MIN_FRAMES = 2
const HIP_KNEE_BIN_SIZE_DEG = 10
const HIP_KNEE_MIN_VALID_FRAMES = 4
const HIP_KNEE_FAIL_MISMATCH_RATIO = 0.58
const HIP_KNEE_FAIL_MAX_DEVIATION_DEG = 35

// Strict 10°-bin one-to-one mapping:
// knee bin i (i*10 ~ i*10+10) -> exactly one hip bin HIP_TARGET_BIN_BY_KNEE_BIN[i].
// No跨区间/多区间匹配。
const HIP_TARGET_BIN_BY_KNEE_BIN: number[] = [
  3, // knee 0-10   -> hip 30-40
  4, // knee 10-20  -> hip 40-50
  5, // knee 20-30  -> hip 50-60
  6, // knee 30-40  -> hip 60-70
  7, // knee 40-50  -> hip 70-80
  8, // knee 50-60  -> hip 80-90
  9, // knee 60-70  -> hip 90-100
  10, // knee 70-80 -> hip 100-110
  11, // knee 80-90 -> hip 110-120
  12, // knee 90-100 -> hip 120-130
  13, // knee 100-110 -> hip 130-140
  14, // knee 110-120 -> hip 140-150
  15, // knee 120-130 -> hip 150-160
  16, // knee 130-140 -> hip 160-170
  16, // knee 140-150 -> hip 160-170
  17, // knee 150-160 -> hip 170-180
  17, // knee 160-170 -> hip 170-180
  17 // knee 170-180 -> hip 170-180
]

export class RealtimeSquatAnalyzer {
  private mode: CoachMode = 'beginner'
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private kneeOverToeRepCount = 0
  private forwardLeanRepCount = 0
  private depthInsufficientRepCount = 0
  private kneeValgusRepCount = 0
  private heelLiftRepCount = 0
  private torsoLeanRepCount = 0
  private tempoIssueRepCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private stateCandidate: 's1' | 's2' | 's3' | null = null
  private stateCandidateFrames = 0
  private repStartedFromStanding = false
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private enteredBottom = false
  private frameCount = 0
  private repPeakKneeOverToeRatio = 0
  private repKneeOverToeHardFrames = 0
  private repPeakTorsoLeanAngle = 0
  private repForwardLeanHardFrames = 0
  private repMinKneeAngle: number | null = null
  private repPeakHeelLiftY = 0
  private repHeelLiftHardFrames = 0
  private repMinKneeSpacingRatio: number | null = null
  private repKneeValgusHardFrames = 0
  private repValidFrameCount = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private repDurationsSec: number[] = []
  private repHipKneeValidFrames = 0
  private repHipKneeMismatchFrames = 0
  private repHipKneeMaxDeviationDeg = 0

  setMode(mode: CoachMode) {
    this.mode = mode
  }

  analyzeFrame(input: { landmarks: NormalizedLandmark[]; gatePaused: boolean }): RealtimeFeedback {
    return this.analyzeWithGate(input.landmarks, input.gatePaused)
  }

  analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
    return this.analyzeWithGate(landmarks, false)
  }

  analyzeWithGate(landmarks: NormalizedLandmark[], gatePaused: boolean): RealtimeFeedback {
    const side = this.chooseSide(landmarks)
    const idx = LM[side]
    const lShoulder = landmarks[11]
    const rShoulder = landmarks[12]
    const lHip = landmarks[23]
    const rHip = landmarks[24]
    const lKnee = landmarks[25]
    const rKnee = landmarks[26]
    const lAnkle = landmarks[27]
    const rAnkle = landmarks[28]

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)
    const midKnee = this.midpoint(lKnee, rKnee)
    const midAnkle = this.midpoint(lAnkle, rAnkle)

    const shoulder = landmarks[idx.shoulder]
    const hip = landmarks[idx.hip]
    const knee = landmarks[idx.knee]
    const ankle = landmarks[idx.ankle]
    const footIndex = landmarks[idx.footIndex]
    const nose = landmarks[idx.nose]
    const otherShoulder = landmarks[idx.rShoulder]

    // For side-view squat, use the selected single-side chain first.
    // Midpoint mixing can skew sagittal angles when left/right depth differs.
    const kneeAngle = this.angleDeg(hip, knee, ankle) ?? this.angleDeg(midHip ?? hip, midKnee ?? knee, midAnkle ?? ankle)
    const hipAngle = this.angleDeg(shoulder, hip, knee) ?? this.angleDeg(midShoulder ?? shoulder, midHip ?? hip, midKnee ?? knee)
    // Keep squat correctness logic centered on two angles only:
    // knee angle and hip angle (both are 3-point cosine-angle computations).
    const torsoAngle: number | null = null
    const kneeVerticalAngle: number | null = null
    const offsetAngle = this.offsetAngleDeg(nose, shoulder, otherShoulder)
    const trackingQuality = this.avgVisibility(landmarks, [idx.nose, idx.shoulder, idx.hip, idx.knee, idx.ankle, idx.footIndex])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const wrongAngle = offsetAngle !== null && offsetAngle > 55
    const lowConfidence = trackingQuality < TRACKING_QUALITY_MIN || kneeAngle === null || hipAngle === null
    const isCountingPaused = gatePaused || wrongAngle || lowConfidence
    const detectedState = kneeAngle === null ? this.currentState : this.detectState(kneeAngle)
    const nextState = isCountingPaused ? this.currentState : this.smoothState(detectedState)
    const hipKneeNow = this.evalHipKneeCoupling(kneeAngle, hipAngle)
    let kneeOverToeRatio: number | null = null
    const heelLiftY = this.heelLiftY(landmarks, idx.heel, idx.footIndex)
    const kneeSpacingRatio = this.kneeSpacingRatio(landmarks, offsetAngle)

    if (wrongAngle) {
      warnings.push('Try to stay in a clear side view for more stable tracking.')
    }
    if (lowConfidence) {
      warnings.push('Low keypoint confidence. Improve lighting and keep your full body in frame.')
    }

    if (!isCountingPaused) {
      if (hipKneeNow && !hipKneeNow.inRange) {
        if (hipKneeNow.deviationDeg >= 30) {
          issues.push({ message: 'Hip-knee coordination is off', joints: [11, 12, 23, 24, 25, 26] })
        } else if (hipKneeNow.deviationDeg >= 20) {
          warnings.push('Hip-knee coordination is drifting. Keep hip hinge synchronized with knee bend.')
        }
      }
    }
    this.updateState(nextState, kneeOverToeRatio, torsoAngle, kneeAngle, hipAngle, heelLiftY, kneeSpacingRatio, !isCountingPaused)

    const coreCorrections = this.buildCoreCorrections({
      kneeAngle,
      torsoAngle,
      shoulder,
      hip,
      ankle,
      heelLiftY,
      kneeSpacingRatio
    })
    const tempoCorr = coreCorrections.find((x) => x.type === 'TEMPO_DRIFT')
    if (tempoCorr && (tempoCorr.level === 'moderate' || tempoCorr.level === 'severe')) {
      warnings.push(tempoCorr.title)
    }
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: this.mode,
      kneeAngle: kneeAngle !== null ? Math.round(kneeAngle) : null,
      hipAngle: hipAngle !== null ? Math.round(hipAngle) : null,
      torsoAngle: torsoAngle !== null ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: kneeVerticalAngle !== null ? Math.round(kneeVerticalAngle) : null,
      offsetAngle: offsetAngle !== null ? Math.round(offsetAngle) : null,
      trackingQuality: Math.round(trackingQuality * 100) / 100,
      hipKneeMatch: hipKneeNow ? hipKneeNow.inRange : null,
      isCountingPaused,
      warnings,
      issues,
      coreCorrections,
      stateSequence: [],
      lastRepResult: this.lastRepResult,
      lastRepMessage: this.lastRepMessage ?? primaryIssue ?? primaryWarn,
      lastRepReasonCodes: this.lastRepReasonCodes,
      lastRepReasonLabels: this.lastRepReasonLabels,
      lastRepCorrections: this.lastRepCorrections,
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      repCount: this.repCount,
      lastRepFrameCount: this.lastRepFrameCount,
      inactiveSeconds: 0,
      session: {
        totalReps: this.repCount,
        correctReps: this.correctCount,
        incorrectReps: this.incorrectCount,
        accuracyPct:
          this.correctCount + this.incorrectCount > 0
            ? Math.round((this.correctCount / (this.correctCount + this.incorrectCount)) * 100)
            : 0,
        unassessedReps: this.unassessedCount,
        depthInsufficientCount: this.depthInsufficientRepCount,
        kneeOverToeCount: this.kneeOverToeRepCount,
        kneeValgusCount: this.kneeValgusRepCount,
        heelLiftCount: this.heelLiftRepCount,
        forwardLeanCount: this.forwardLeanRepCount,
        backwardLeanCount: 0,
        torsoLeanCount: this.torsoLeanRepCount,
        sideViewWarningCount: 0,
        avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
        fastRepCount: this.fastRepCount,
        slowRepCount: this.slowRepCount,
        tempoDriftCount: this.tempoIssueRepCount
      }
    }
  }

  resetSession() {
    this.mode = 'beginner'
    this.repCount = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.unassessedCount = 0
    this.kneeOverToeRepCount = 0
    this.forwardLeanRepCount = 0
    this.depthInsufficientRepCount = 0
    this.kneeValgusRepCount = 0
    this.heelLiftRepCount = 0
    this.torsoLeanRepCount = 0
    this.tempoIssueRepCount = 0
    this.currentState = null
    this.stateCandidate = null
    this.stateCandidateFrames = 0
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.enteredBottom = false
    this.repStartedFromStanding = false
    this.frameCount = 0
    this.repPeakKneeOverToeRatio = 0
    this.repKneeOverToeHardFrames = 0
    this.repPeakTorsoLeanAngle = 0
    this.repForwardLeanHardFrames = 0
    this.repMinKneeAngle = null
    this.repPeakHeelLiftY = 0
    this.repHeelLiftHardFrames = 0
    this.repMinKneeSpacingRatio = null
    this.repKneeValgusHardFrames = 0
    this.repValidFrameCount = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.repDurationsSec = []
    this.repHipKneeValidFrames = 0
    this.repHipKneeMismatchFrames = 0
    this.repHipKneeMaxDeviationDeg = 0
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    kneeOverToeRatio: number | null,
    torsoAngle: number | null,
    kneeAngle: number | null,
    hipAngle: number | null,
    heelLiftY: number | null,
    kneeSpacingRatio: number | null,
    isAssessingFrame: boolean
  ) {
    if (nextState === null) return
    const startedRep = this.currentState === 's1' && (nextState === 's2' || nextState === 's3')
    if (startedRep) {
      // Start a fresh per-rep window when descent begins from standing.
      this.repStartedFromStanding = true
      this.frameCount = 0
      this.repPeakKneeOverToeRatio = 0
      this.repKneeOverToeHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repMinKneeAngle = null
      this.repPeakHeelLiftY = 0
      this.repHeelLiftHardFrames = 0
      this.repMinKneeSpacingRatio = null
      this.repKneeValgusHardFrames = 0
      this.repValidFrameCount = 0
      this.repHipKneeValidFrames = 0
      this.repHipKneeMismatchFrames = 0
      this.repHipKneeMaxDeviationDeg = 0
    }
    this.frameCount += 1
    if (isAssessingFrame) this.repValidFrameCount += 1
    if (typeof kneeOverToeRatio === 'number' && Number.isFinite(kneeOverToeRatio) && kneeOverToeRatio > 0) {
      this.repPeakKneeOverToeRatio = Math.max(this.repPeakKneeOverToeRatio, kneeOverToeRatio)
      if (kneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO) this.repKneeOverToeHardFrames += 1
    }
    if (typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) && torsoAngle > 0) {
      this.repPeakTorsoLeanAngle = Math.max(this.repPeakTorsoLeanAngle, torsoAngle)
      if (torsoAngle >= FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL) this.repForwardLeanHardFrames += 1
    }
    if (typeof kneeAngle === 'number' && Number.isFinite(kneeAngle) && kneeAngle > 0) {
      this.repMinKneeAngle = this.repMinKneeAngle === null ? kneeAngle : Math.min(this.repMinKneeAngle, kneeAngle)
    }
    if (typeof heelLiftY === 'number' && Number.isFinite(heelLiftY) && heelLiftY > 0) {
      this.repPeakHeelLiftY = Math.max(this.repPeakHeelLiftY, heelLiftY)
      if (heelLiftY >= HEEL_LIFT_SEVERE_Y) this.repHeelLiftHardFrames += 1
    }
    if (typeof kneeSpacingRatio === 'number' && Number.isFinite(kneeSpacingRatio) && kneeSpacingRatio > 0) {
      this.repMinKneeSpacingRatio = this.repMinKneeSpacingRatio === null ? kneeSpacingRatio : Math.min(this.repMinKneeSpacingRatio, kneeSpacingRatio)
      if (kneeSpacingRatio <= KNEE_VALGUS_MODERATE_RATIO) this.repKneeValgusHardFrames += 1
    }
    if (isAssessingFrame) {
      const hk = this.evalHipKneeCoupling(kneeAngle, hipAngle)
      if (hk) {
        this.repHipKneeValidFrames += 1
        if (!hk.inRange) this.repHipKneeMismatchFrames += 1
        this.repHipKneeMaxDeviationDeg = Math.max(this.repHipKneeMaxDeviationDeg, hk.deviationDeg)
      }
    }
    if (nextState === 's3') this.enteredBottom = true
    if (this.currentState !== 's1' && nextState === 's1' && this.enteredBottom && this.repStartedFromStanding) {
      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const hasReliableTracking = this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN
      this.repCount += 1
      const repDurationSec = Math.max(0.1, this.frameCount / ASSUMED_ANALYZER_FPS)
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < REP_FAST_SEC) this.fastRepCount += 1
      if (repDurationSec > REP_SLOW_SEC) this.slowRepCount += 1
      this.repDurationsSec.push(repDurationSec)
      if (this.repDurationsSec.length > 20) this.repDurationsSec.shift()
      if (hasReliableTracking) {
        const hipKneeFramesEnough = this.repHipKneeValidFrames >= HIP_KNEE_MIN_VALID_FRAMES
        const mismatchRatio = this.repHipKneeValidFrames > 0 ? this.repHipKneeMismatchFrames / this.repHipKneeValidFrames : 1
        const hipKneeFailed =
          !hipKneeFramesEnough ||
          mismatchRatio >= HIP_KNEE_FAIL_MISMATCH_RATIO ||
          this.repHipKneeMaxDeviationDeg >= HIP_KNEE_FAIL_MAX_DEVIATION_DEG

        if (hipKneeFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []
          reasonCodes.push(!hipKneeFramesEnough ? 'HIP_KNEE_DATA_INSUFFICIENT' : 'HIP_KNEE_COORDINATION')
          reasonLabels.push(
            !hipKneeFramesEnough
              ? 'Hip-knee coordination data was insufficient'
              : 'Hip-knee coordination did not follow the expected ergonomic range'
          )
          corrections.push(
            'Match hip angle to the mapped range for each knee-angle interval and keep the two joints moving in sync.'
          )
          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage = reasonLabels.length > 1 ? `Rep failed: ${reasonLabels.slice(0, 2).join(' + ')}.` : `Rep failed: ${reasonLabels[0] ?? 'form issue'}.`
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep the tempo steady.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      } else {
        this.incorrectCount += 1
        this.lastRepResult = 'incorrect'
        this.lastRepMessage = 'Rep failed: keypoint tracking was incomplete.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoint tracking was incomplete']
        this.lastRepCorrections = ['Improve lighting and keep your full body in frame before continuing.']
      }
      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredBottom = false
      this.repStartedFromStanding = false
      this.repPeakKneeOverToeRatio = 0
      this.repKneeOverToeHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repMinKneeAngle = null
      this.repPeakHeelLiftY = 0
      this.repHeelLiftHardFrames = 0
      this.repMinKneeSpacingRatio = null
      this.repKneeValgusHardFrames = 0
      this.repValidFrameCount = 0
      this.repHipKneeValidFrames = 0
      this.repHipKneeMismatchFrames = 0
      this.repHipKneeMaxDeviationDeg = 0
    }
    this.currentState = nextState
  }

  private buildCoreCorrections(input: {
    kneeAngle: number | null
    torsoAngle: number | null
    shoulder: NormalizedLandmark | undefined
    hip: NormalizedLandmark | undefined
    ankle: NormalizedLandmark | undefined
    heelLiftY: number | null
    kneeSpacingRatio: number | null
  }): SquatCoreCorrection[] {
    const depth = this.computeDepthCorrection(input.kneeAngle)
    const valgus = this.computeKneeValgusCorrection(input.kneeSpacingRatio)
    const heel = this.computeHeelLiftCorrection(input.heelLiftY, null)
    const torso = this.computeTorsoLeanCorrection(input.torsoAngle, input.shoulder, input.hip, input.ankle)
    const tempo = this.computeTempoDriftCorrection()
    return [depth, valgus, heel, torso, tempo]
  }

  private computeDepthCorrection(kneeAngle: number | null): SquatCoreCorrection {
    const value = typeof kneeAngle === 'number' && Number.isFinite(kneeAngle) ? kneeAngle : null
    const score =
      value === null
        ? null
        : value > DEPTH_FAIL_KNEE_ANGLE
          ? 3
          : value > DEPTH_WARN_KNEE_ANGLE
            ? 2
            : value > DEPTH_OK_KNEE_ANGLE
              ? 1
              : 0
    const level: SquatCorrectionLevel = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe'
    return {
      type: 'DEPTH',
      title:
        level === 'unknown'
          ? 'Depth check unavailable'
          : level === 'ok'
            ? 'Depth looks good'
            : level === 'minor'
              ? 'Depth slightly shallow'
              : level === 'moderate'
                ? 'Depth insufficient'
                : 'Depth far too shallow',
      level,
      levelScore: score,
      evidence: { kneeAngleDeg: value !== null ? Math.round(value) : null, okAtOrBelowDeg: DEPTH_OK_KNEE_ANGLE },
      suggestion: 'Aim to descend until thighs are near parallel while keeping balance over mid-foot.',
      joints: [23, 24, 25, 26, 27, 28]
    }
  }

  private computeKneeValgusCorrection(kneeSpacingRatio: number | null): SquatCoreCorrection {
    const value = typeof kneeSpacingRatio === 'number' && Number.isFinite(kneeSpacingRatio) ? kneeSpacingRatio : null
    const score =
      value === null
        ? null
        : value >= KNEE_VALGUS_OK_RATIO
          ? 0
          : value >= KNEE_VALGUS_MINOR_RATIO
            ? 1
            : value >= KNEE_VALGUS_MODERATE_RATIO
              ? 2
              : 3
    const level: SquatCorrectionLevel = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe'
    return {
      type: 'KNEE_VALGUS',
      title:
        level === 'unknown'
          ? 'Knee tracking unavailable'
          : level === 'ok'
            ? 'Knee tracking looks good'
            : level === 'minor'
              ? 'Knees slightly collapsing inward'
              : level === 'moderate'
                ? 'Knees collapsing inward'
                : 'Severe knee collapse inward',
      level,
      levelScore: score,
      evidence: { kneeSpacingRatio: value !== null ? Math.round(value * 1000) / 1000 : null, okAtOrAbove: KNEE_VALGUS_OK_RATIO },
      suggestion: 'Drive knees out to track over toes and keep feet rooted.',
      joints: [23, 24, 25, 26, 27, 28]
    }
  }

  private computeHeelLiftCorrection(heelLiftY: number | null, idx: (typeof LM)['left'] | (typeof LM)['right'] | null): SquatCoreCorrection {
    const value = typeof heelLiftY === 'number' && Number.isFinite(heelLiftY) ? heelLiftY : null
    const score =
      value === null
        ? null
        : value >= HEEL_LIFT_SEVERE_Y
          ? 3
          : value >= HEEL_LIFT_MODERATE_Y
            ? 2
            : value >= HEEL_LIFT_MINOR_Y
              ? 1
              : 0
    const level: SquatCorrectionLevel = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe'
    return {
      type: 'HEEL_LIFT',
      title:
        level === 'unknown'
          ? 'Heel contact unavailable'
          : level === 'ok'
            ? 'Heels stay grounded'
            : level === 'minor'
              ? 'Heels slightly lifting'
              : level === 'moderate'
                ? 'Heels lifting off the ground'
                : 'Heels lifting significantly',
      level,
      levelScore: score,
      evidence: { heelLiftY: value !== null ? Math.round(value * 1000) / 1000 : null, severeAtOrAbove: HEEL_LIFT_SEVERE_Y },
      suggestion: 'Shift pressure to mid-foot/heel and widen stance slightly if needed.',
      joints: idx ? [idx.ankle, idx.heel, idx.footIndex] : [27, 28, 29, 30, 31, 32]
    }
  }

  private computeTorsoLeanCorrection(
    torsoAngle: number | null,
    shoulder: NormalizedLandmark | undefined,
    hip: NormalizedLandmark | undefined,
    ankle: NormalizedLandmark | undefined
  ): SquatCoreCorrection {
    const value = typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) ? torsoAngle : null
    const forward = shoulder && hip && ankle ? this.isForwardLean(shoulder, hip, ankle) : null
    const score =
      value === null
        ? null
        : value > TORSO_LEAN_SEVERE_ANGLE_FROM_VERTICAL
          ? 3
          : value > TORSO_LEAN_MODERATE_ANGLE_FROM_VERTICAL
            ? 2
            : value > TORSO_LEAN_OK_ANGLE_FROM_VERTICAL
              ? 1
              : 0
    const level: SquatCorrectionLevel = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe'
    return {
      type: 'TORSO_LEAN',
      title:
        level === 'unknown'
          ? 'Torso lean unavailable'
          : level === 'ok'
            ? 'Torso stays upright'
            : level === 'minor'
              ? 'Torso leaning forward slightly'
              : level === 'moderate'
                ? 'Excessive forward torso lean'
                : 'Severe torso forward lean',
      level,
      levelScore: score,
      evidence: { torsoFromVerticalDeg: value !== null ? Math.round(value) : null, direction: forward === null ? null : forward ? 'forward' : 'backward' },
      suggestion: 'Keep chest up and brace your core as you descend.',
      joints: [11, 12, 23, 24]
    }
  }

  private computeTempoDriftCorrection(): SquatCoreCorrection {
    const n = this.repDurationsSec.length
    const avg = n > 0 ? this.repDurationsSec.reduce((a, b) => a + b, 0) / n : null
    const variance =
      avg !== null && n >= 2 ? this.repDurationsSec.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / (n - 1) : null
    const sd = variance !== null ? Math.sqrt(Math.max(0, variance)) : null
    const cv = avg !== null && sd !== null && avg > 1e-6 ? sd / avg : null
    const fast = this.fastRepCount
    const slow = this.slowRepCount
    const score =
      n < 2 || avg === null
        ? null
        : cv !== null && cv >= 0.35
          ? 3
          : (fast + slow) >= Math.max(2, Math.ceil(this.repCount * 0.5))
            ? 2
            : cv !== null && cv >= 0.22
              ? 2
              : (fast + slow) >= 1 || (cv !== null && cv >= 0.16)
                ? 1
                : 0
    const level: SquatCorrectionLevel = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe'
    const title =
      level === 'unknown'
        ? 'Tempo drift unavailable'
        : level === 'ok'
          ? 'Tempo looks steady'
          : level === 'minor'
            ? 'Tempo slightly inconsistent'
            : level === 'moderate'
              ? 'Tempo drift detected'
              : 'Tempo highly inconsistent'
    return {
      type: 'TEMPO_DRIFT',
      title,
      level,
      levelScore: score,
      evidence: {
        reps: this.repCount,
        avgRepDurationSec: avg !== null ? Math.round(avg * 100) / 100 : null,
        durationCv: cv !== null ? Math.round(cv * 1000) / 1000 : null,
        fastReps: fast,
        slowReps: slow
      },
      suggestion: 'Use a steady tempo: ~2s down, brief pause, and controlled rise.',
      joints: [11, 12, 23, 24, 25, 26]
    }
  }

  private detectState(kneeAngle: number | null): 's1' | 's2' | 's3' | null {
    if (kneeAngle === null) return null
    // Apply small hysteresis so state does not jitter near angle boundaries.
    if (this.currentState === 's1') {
      if (kneeAngle >= S1_EXIT_KNEE_ANGLE) return 's1'
      if (kneeAngle > S3_ENTER_KNEE_ANGLE) return 's2'
      return 's3'
    }
    if (this.currentState === 's3') {
      if (kneeAngle <= S3_EXIT_KNEE_ANGLE) return 's3'
      if (kneeAngle < S1_ENTER_KNEE_ANGLE) return 's2'
      return 's1'
    }
    if (kneeAngle >= S1_ENTER_KNEE_ANGLE) return 's1'
    if (kneeAngle > S3_ENTER_KNEE_ANGLE) return 's2'
    return 's3'
  }

  private smoothState(nextDetected: 's1' | 's2' | 's3' | null): 's1' | 's2' | 's3' | null {
    if (nextDetected === null) return this.currentState
    if (this.currentState === null) {
      this.stateCandidate = nextDetected
      this.stateCandidateFrames = 1
      return nextDetected
    }
    if (nextDetected === this.currentState) {
      this.stateCandidate = nextDetected
      this.stateCandidateFrames = 0
      return this.currentState
    }
    if (nextDetected !== this.stateCandidate) {
      this.stateCandidate = nextDetected
      this.stateCandidateFrames = 1
      return this.currentState
    }
    this.stateCandidateFrames += 1
    if (this.stateCandidateFrames >= STATE_SWITCH_MIN_FRAMES) {
      this.stateCandidateFrames = 0
      return nextDetected
    }
    return this.currentState
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's2') return 'descent'
    if (state === 's3') return 'bottom'
    return 'up'
  }

  private chooseSide(landmarks: NormalizedLandmark[]): 'left' | 'right' {
    let leftVis = 0
    let rightVis = 0
    for (const k of [11, 23, 25, 27]) leftVis += landmarks[k]?.visibility ?? 0
    for (const k of [12, 24, 26, 28]) rightVis += landmarks[k]?.visibility ?? 0
    return rightVis > leftVis ? 'right' : 'left'
  }

  private isForwardLean(shoulder: NormalizedLandmark, hip: NormalizedLandmark, ankle: NormalizedLandmark) {
    const dir = Math.sign((ankle.x - hip.x) || 1)
    return (shoulder.x - hip.x) * dir > 0
  }

  private heelLiftY(landmarks: NormalizedLandmark[], heelIdx: number, footIdx: number): number | null {
    const heel = landmarks[heelIdx]
    const foot = landmarks[footIdx]
    if (!heel || !foot) return null
    if (Math.min(this.visibilityOf(heel), this.visibilityOf(foot)) < 0.3) return null
    const y = foot.y - heel.y
    if (!Number.isFinite(y)) return null
    return Math.max(0, y)
  }

  private kneeSpacingRatio(landmarks: NormalizedLandmark[], offsetAngle: number | null): number | null {
    if (offsetAngle === null) return null
    if (offsetAngle < 18 || offsetAngle > 55) return null
    const lKnee = landmarks[25]
    const rKnee = landmarks[26]
    const lAnkle = landmarks[27]
    const rAnkle = landmarks[28]
    if (!lKnee || !rKnee || !lAnkle || !rAnkle) return null
    if (Math.min(this.visibilityOf(lKnee), this.visibilityOf(rKnee), this.visibilityOf(lAnkle), this.visibilityOf(rAnkle)) < 0.35) return null
    const kneeDist = Math.abs(lKnee.x - rKnee.x)
    const ankleDist = Math.abs(lAnkle.x - rAnkle.x)
    if (!Number.isFinite(kneeDist) || !Number.isFinite(ankleDist) || ankleDist < 1e-6) return null
    return Math.max(0, Math.min(2, kneeDist / ankleDist))
  }

  private evalHipKneeCoupling(kneeAngle: number | null, hipAngle: number | null) {
    const k = typeof kneeAngle === 'number' && Number.isFinite(kneeAngle) ? kneeAngle : null
    const h = typeof hipAngle === 'number' && Number.isFinite(hipAngle) ? hipAngle : null
    if (k === null || h === null) return null
    const bin = this.angleBin(k)
    const targetHipBin = HIP_TARGET_BIN_BY_KNEE_BIN[bin]
    if (typeof targetHipBin !== 'number' || !Number.isFinite(targetHipBin)) return null
    const range = {
      min: targetHipBin * HIP_KNEE_BIN_SIZE_DEG,
      max: Math.min(180, targetHipBin * HIP_KNEE_BIN_SIZE_DEG + HIP_KNEE_BIN_SIZE_DEG)
    }
    const actualHipBin = this.angleBin(h)
    const exactBinMatch = actualHipBin === targetHipBin
    const inRange = h >= range.min && h <= range.max
    const deviationDeg = inRange ? 0 : h < range.min ? range.min - h : h - range.max
    return { inRange: inRange && exactBinMatch, deviationDeg, range, bin, targetHipBin, actualHipBin }
  }

  private angleBin(angleDeg: number) {
    const clamped = Math.max(0, Math.min(179.999, angleDeg))
    return Math.floor(clamped / HIP_KNEE_BIN_SIZE_DEG)
  }

  private avgVisibility(landmarks: NormalizedLandmark[], indices: number[]) {
    let total = 0
    for (const idx of indices) total += this.visibilityOf(landmarks[idx])
    return indices.length > 0 ? total / indices.length : 0
  }

  private visibilityOf(p: NormalizedLandmark | undefined) {
    if (!p) return 0
    const v = typeof p.visibility === 'number' ? p.visibility : 0.5
    if (!Number.isFinite(v)) return 0
    return Math.max(0, Math.min(1, v))
  }

  private angleDeg(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null, c?: NormalizedLandmark | null): number | null {
    if (!a || !b || !c) return null
    // 3-point cosine-angle method:
    // cos(theta) = (BA·BC) / (|BA|*|BC|), theta = acos(cos).
    const ba = { x: a.x - b.x, y: a.y - b.y }
    const bc = { x: c.x - b.x, y: c.y - b.y }
    const dot = ba.x * bc.x + ba.y * bc.y
    const mag = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dot / mag))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleFromVerticalDeg(top?: NormalizedLandmark | null, bottom?: NormalizedLandmark | null): number | null {
    if (!top || !bottom) return null
    const dx = bottom.x - top.x
    const dy = bottom.y - top.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private lineToVerticalDeg(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null): number | null {
    if (!a || !b) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private offsetAngleDeg(
    nose?: NormalizedLandmark,
    shoulder?: NormalizedLandmark,
    otherShoulder?: NormalizedLandmark
  ): number | null {
    if (!nose || !shoulder || !otherShoulder) return null
    const shoulderSpanX = Math.abs(shoulder.x - otherShoulder.x)
    const shoulderSpanY = Math.abs(shoulder.y - otherShoulder.y) + 1e-6
    const frontalLikeDeg = (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
    const noseDx = Math.abs(nose.x - shoulder.x)
    const noseDy = Math.abs(nose.y - shoulder.y) + 1e-6
    const noseOffsetDeg = (Math.atan2(noseDx, noseDy) * 180) / Math.PI
    return (frontalLikeDeg + noseOffsetDeg) / 2
  }

  private midpoint(a?: NormalizedLandmark, b?: NormalizedLandmark): NormalizedLandmark | null {
    if (!a || !b) return null
    if (Math.min(a.visibility ?? 0, b.visibility ?? 0) < 0.15) return null
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
      visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0)
    }
  }
}
