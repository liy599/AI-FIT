import type { PoseAnalyzerFeedback } from './types'
import type { MoveNetKeypoint, MoveNetName } from '../vision/movenetTracker'
import { isPoseDebugEnabled } from '../debugFlags'

const DEFAULT_NATIVE_ANALYZER_FPS = 40
const NATIVE_FRONT_VIEW_OK_ANGLE = 70
const NATIVE_FRONT_VIEW_FAIL_RATIO = 0.65
const NATIVE_FRONT_VIEW_ALT_RANGE_MIN = 60
const NATIVE_FRONT_VIEW_ALT_ELBOW_MIN = 120
const NATIVE_FRONT_VIEW_ALT_ELBOW_GAP_FAIL = 25
const NATIVE_FRONT_VIEW_ALT_ELBOW_GAP_WARN = 35
const NATIVE_SIDE_VIEW_MAX_ALIGNMENT = 40
const NATIVE_SIDE_S1_ENTER_ROW_DEG = 28
const NATIVE_SIDE_S1_EXIT_ROW_DEG = 35
const NATIVE_SIDE_S3_ENTER_ROW_DEG = 44
const NATIVE_SIDE_S3_EXIT_ROW_DEG = 38

const NATIVE_SIDE_TOP_RANGE_WARN_ELBOW_MAX_DEG = 155

const NATIVE_REP_COUNT_MIN_FRAMES = 6
const NATIVE_REP_VALID_MIN_FRAMES = 5
const NATIVE_REP_VALID_RATIO_MIN = 0.3

const NATIVE_S1_ENTER_ROW_DEG = 125
const NATIVE_S1_EXIT_ROW_DEG = 135
const NATIVE_S3_ENTER_ROW_DEG = 115
const NATIVE_S3_EXIT_ROW_DEG = 125

const REP_FAST_SEC = 0.8
const REP_SLOW_SEC = 4.0

export type BentOverRowTuning = {
  trackingQualityMin: number
  torsoLeanWarnDeg: number
  torsoLeanFailDeg: number
  torsoLeanFailMinFrames: number
  kneeStraightWarnDeg: number
  kneeStraightFailDeg: number
  kneeStraightFailMinFrames: number
  symmetryWarnDeg: number
  symmetryFailDeg: number
  symmetryFailMinFrames: number
  topRangeMinDeg: number
}

export type BentOverRowTempo = {
  repFastSec: number
  repSlowSec: number
}

export const DEFAULT_BENT_OVER_ROW_TUNING: BentOverRowTuning = {
  trackingQualityMin: 0.20,
  torsoLeanWarnDeg: 60,
  torsoLeanFailDeg: 75,
  torsoLeanFailMinFrames: 4,
  kneeStraightWarnDeg: 155,
  kneeStraightFailDeg: 165,
  kneeStraightFailMinFrames: 1,
  symmetryWarnDeg: 25,
  symmetryFailDeg: 35,
  symmetryFailMinFrames: 3,
  topRangeMinDeg: 44
}

export const DEFAULT_BENT_OVER_ROW_TEMPO: BentOverRowTempo = {
  repFastSec: 0.5,
  repSlowSec: 6.0
}

export const VIDEO_DEFAULT_BENT_OVER_ROW_TEMPO: BentOverRowTempo = {
  repFastSec: 0.5,
  repSlowSec: 6.0
}

type NamedKeypoints = Record<MoveNetName, MoveNetKeypoint | undefined>

export class BentOverRowVideoAnalyzer {
  private debugEnabled = isPoseDebugEnabled()
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private rangeMissCount = 0
  private symmetryCount = 0
  private torsoLeanCount = 0
  private kneeStraightCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private lastCompletedRepMaxKneeAngle: number | null = null
  private lastCompletedRepKneeHardFrames: number | null = null
  private lastCompletedRepKneeSampleFrames: number | null = null
  private lastCompletedRepFrontViewFrames: number | null = null
  private lastCompletedRepSideViewFrames: number | null = null
  private lastCompletedRepAlignmentSampleFrames: number | null = null
  private enteredTop = false
  private stableS1Frames = 0
  private frameCount = 0
  private repValidFrameCount = 0
  private repFrontBadFrames = 0
  private repMaxTorsoAngle = 0
  private repTorsoHardFrames = 0
  private repMaxKneeAngle = 0
  private repKneeHardFrames = 0
  private repKneeSampleFrames = 0
  private repPeakSymmetryGap = 0
  private repSymmetryHardFrames = 0
  private repMaxRowAngle = 0
  private repMinElbowAngle = 180
  private repPeakFrontAlignment = 0
  private repPeakElbowGap = 0
  private repElbowGapHardFrames = 0
  private repAlignmentSampleFrames = 0
  private repFrontViewFrames = 0
  private repSideViewFrames = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private viewInvalidRepCount = 0
  private torsoLeanWarnFrames = 0
  private symmetryWarnFrames = 0
  private topRangeWarnFrames = 0
  private kneeStraightWarnFrames = 0
  private analyzerFps = DEFAULT_NATIVE_ANALYZER_FPS
  private tuning: BentOverRowTuning = { ...DEFAULT_BENT_OVER_ROW_TUNING }
  private tempo: BentOverRowTempo = { ...DEFAULT_BENT_OVER_ROW_TEMPO }

  setTuning(next: Partial<BentOverRowTuning>) {
    this.tuning = {
      ...this.tuning,
      ...next
    }
  }

  setAnalyzerFps(nextFps: number) {
    if (!Number.isFinite(nextFps)) return
    this.analyzerFps = Math.max(10, Math.min(120, nextFps))
  }

  setTempo(next: Partial<BentOverRowTempo>) {
    const repFastSec =
      typeof next.repFastSec === 'number' && Number.isFinite(next.repFastSec) ? Math.max(0.2, Math.min(8, next.repFastSec)) : this.tempo.repFastSec
    const repSlowSec =
      typeof next.repSlowSec === 'number' && Number.isFinite(next.repSlowSec) ? Math.max(0.3, Math.min(12, next.repSlowSec)) : this.tempo.repSlowSec
    this.tempo = {
      repFastSec,
      repSlowSec: Math.max(repSlowSec, repFastSec + 0.1)
    }
  }

  analyzeNative(keypoints: MoveNetKeypoint[]): PoseAnalyzerFeedback {
    const map = this.byName(keypoints)
    const lShoulder = map.left_shoulder
    const rShoulder = map.right_shoulder
    const lElbow = map.left_elbow
    const rElbow = map.right_elbow
    const lWrist = map.left_wrist
    const rWrist = map.right_wrist
    const lHip = map.left_hip
    const rHip = map.right_hip
    const lKnee = map.left_knee
    const rKnee = map.right_knee
    const lAnkle = map.left_ankle
    const rAnkle = map.right_ankle

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)

    const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist)
    const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist)
    const elbowAngleRaw = this.avgNumber(leftElbowAngle, rightElbowAngle)
    const elbowGap = leftElbowAngle !== null && rightElbowAngle !== null ? Math.abs(leftElbowAngle - rightElbowAngle) : null

    const leftRowAngle = this.rowAngleDeg(lShoulder, lElbow, lHip)
    const rightRowAngle = this.rowAngleDeg(rShoulder, rElbow, rHip)
    const rowAngle = this.avgNumber(leftRowAngle, rightRowAngle)

    const symmetryGap = leftRowAngle !== null && rightRowAngle !== null ? Math.abs(leftRowAngle - rightRowAngle) : null
    const torsoAngle = this.angleFromHorizontalDeg(midShoulder, midHip)
    const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder)
    const trackingQuality = this.trackingQuality(map)
    const leftKneeAngle = this.angleDegWithMinScore(lHip, lKnee, lAnkle, 0.08)
    const rightKneeAngle = this.angleDegWithMinScore(rHip, rKnee, rAnkle, 0.08)
    const kneeAngleRaw = this.avgNumber(leftKneeAngle, rightKneeAngle)

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []

    const isCountingPaused =
      trackingQuality < this.tuning.trackingQualityMin || elbowAngleRaw === null

    const frontViewBad = frontAlignment !== null && frontAlignment > NATIVE_FRONT_VIEW_OK_ANGLE
    if (frontViewBad) warnings.push('Use a clear side view — turn about 90° and keep your whole body in frame from shoulders to ankles.')
    if (trackingQuality < 0.45) warnings.push('Low keypoint confidence. Improve lighting and keep shoulders, elbows, wrists, and hips visible.')

    const nextState = isCountingPaused ? this.currentState : this.detectState({ elbowAngle: elbowAngleRaw, rowAngle, frontAlignment })
    const isSideView = frontAlignment !== null && frontAlignment <= NATIVE_SIDE_VIEW_MAX_ALIGNMENT
    const stateForTorso = nextState ?? this.currentState
    const isActiveRowing = stateForTorso === 's2' || stateForTorso === 's3'
    if (!isCountingPaused && isActiveRowing && torsoAngle !== null && torsoAngle > this.tuning.torsoLeanWarnDeg) {
      this.torsoLeanWarnFrames += 1
    } else {
      this.torsoLeanWarnFrames = 0
    }
    if (this.torsoLeanWarnFrames >= 8) warnings.push('Torso became too upright — hinge at the hips and keep your chest over your knees.')

    if (!isCountingPaused && isSideView && isActiveRowing && kneeAngleRaw !== null && kneeAngleRaw >= this.tuning.kneeStraightWarnDeg) {
      this.kneeStraightWarnFrames += 1
    } else {
      this.kneeStraightWarnFrames = 0
    }
    if (this.kneeStraightWarnFrames >= 3) warnings.push('Knees were too straight — keep a soft bend instead of locking out your legs.')
    if (frontAlignment !== null && frontAlignment >= NATIVE_FRONT_VIEW_ALT_RANGE_MIN) {
      if (elbowGap !== null && elbowGap > NATIVE_FRONT_VIEW_ALT_ELBOW_GAP_WARN) {
        warnings.push('Pull both arms evenly to improve symmetry.')
      }
      this.symmetryWarnFrames = 0
    } else {
      if (symmetryGap !== null && symmetryGap > this.tuning.symmetryWarnDeg) {
        this.symmetryWarnFrames += 1
      } else {
        this.symmetryWarnFrames = 0
      }
      if (this.symmetryWarnFrames >= 5) {
        warnings.push('Pull both arms evenly to improve symmetry.')
      }
    }

    const stateForRange = nextState ?? this.currentState
    if (!isCountingPaused && isSideView && stateForRange === 's3' && elbowAngleRaw !== null && elbowAngleRaw > NATIVE_SIDE_TOP_RANGE_WARN_ELBOW_MAX_DEG) {
      this.topRangeWarnFrames += 1
    } else {
      this.topRangeWarnFrames = 0
    }
    if (this.topRangeWarnFrames >= 4) {
      warnings.push('Pull the dumbbells closer to your hips for a full contraction.')
    }
    this.updateState(nextState, {
      isCountingPaused,
      elbowAngle: elbowAngleRaw,
      elbowGap,
      rowAngle,
      torsoAngle,
      kneeAngle: kneeAngleRaw,
      symmetryGap,
      frontViewBad,
      frontAlignment
    })

    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    const feedback: PoseAnalyzerFeedback = {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: rowAngle !== null ? Math.round(rowAngle) : null,
      hipAngle: elbowAngleRaw !== null ? Math.round(elbowAngleRaw) : null,
      torsoAngle: torsoAngle !== null ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: symmetryGap !== null ? Math.round(symmetryGap) : null,
      offsetAngle: frontAlignment !== null ? Math.round(frontAlignment) : null,
      trackingQuality: Math.round(trackingQuality * 100) / 100,
      isCountingPaused,
      warnings,
      issues,
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
        depthInsufficientCount: this.rangeMissCount,
        kneeOverToeCount: this.symmetryCount,
        forwardLeanCount: this.torsoLeanCount,
        backwardLeanCount: 0,
        sideViewWarningCount: this.viewInvalidRepCount,
        avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
        fastRepCount: this.fastRepCount,
        slowRepCount: this.slowRepCount
      }
    }
    if (this.debugEnabled) {
      feedback.debug = {
        kneeAngleDeg: kneeAngleRaw !== null ? Math.round(kneeAngleRaw) : null,
        kneeStraightWarnFrames: this.kneeStraightWarnFrames,
        repMaxKneeAngle: this.repMaxKneeAngle > 0 ? Math.round(this.repMaxKneeAngle) : null,
        repKneeHardFrames: this.repKneeHardFrames,
        repKneeSampleFrames: this.repKneeSampleFrames,
        lastCompletedRepMaxKneeAngle: this.lastCompletedRepMaxKneeAngle !== null ? Math.round(this.lastCompletedRepMaxKneeAngle) : null,
        lastCompletedRepKneeHardFrames: this.lastCompletedRepKneeHardFrames,
        lastCompletedRepKneeSampleFrames: this.lastCompletedRepKneeSampleFrames,
        lastCompletedRepFrontViewFrames: this.lastCompletedRepFrontViewFrames,
        lastCompletedRepSideViewFrames: this.lastCompletedRepSideViewFrames,
        lastCompletedRepAlignmentSamples: this.lastCompletedRepAlignmentSampleFrames
      }
    }
    return feedback
  }

  resetSession() {
    this.repCount = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.unassessedCount = 0
    this.rangeMissCount = 0
    this.symmetryCount = 0
    this.torsoLeanCount = 0
    this.kneeStraightCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.lastCompletedRepMaxKneeAngle = null
    this.lastCompletedRepKneeHardFrames = null
    this.lastCompletedRepKneeSampleFrames = null
    this.lastCompletedRepFrontViewFrames = null
    this.lastCompletedRepSideViewFrames = null
    this.lastCompletedRepAlignmentSampleFrames = null
    this.enteredTop = false
    this.stableS1Frames = 0
    this.frameCount = 0
    this.repValidFrameCount = 0
    this.repFrontBadFrames = 0
    this.repMaxTorsoAngle = 0
    this.repTorsoHardFrames = 0
    this.repMaxKneeAngle = 0
    this.repKneeHardFrames = 0
    this.repKneeSampleFrames = 0
    this.repPeakSymmetryGap = 0
    this.repSymmetryHardFrames = 0
    this.repMaxRowAngle = 0
    this.repMinElbowAngle = 180
    this.repPeakFrontAlignment = 0
    this.repPeakElbowGap = 0
    this.repElbowGapHardFrames = 0
    this.repAlignmentSampleFrames = 0
    this.repFrontViewFrames = 0
    this.repSideViewFrames = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.viewInvalidRepCount = 0
    this.torsoLeanWarnFrames = 0
    this.symmetryWarnFrames = 0
    this.topRangeWarnFrames = 0
    this.kneeStraightWarnFrames = 0
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      elbowAngle: number | null
      elbowGap: number | null
      rowAngle: number | null
      torsoAngle: number | null
      kneeAngle: number | null
      symmetryGap: number | null
      frontViewBad: boolean
      frontAlignment: number | null
    }
  ) {
    if (nextState === null) return

    if (nextState === 's1' && !input.isCountingPaused) {
      this.stableS1Frames += 1
    } else if (nextState !== 's1') {
      this.stableS1Frames = 0
    }

    const startedRep = this.currentState === 's1' && nextState === 's2' && this.stableS1Frames >= 1
    if (startedRep) {
      this.frameCount = 0
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repMaxTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repMaxKneeAngle = 0
      this.repKneeHardFrames = 0
      this.repKneeSampleFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMaxRowAngle = 0
      this.repMinElbowAngle = 180
      this.repPeakFrontAlignment = 0
      this.repPeakElbowGap = 0
      this.repElbowGapHardFrames = 0
      this.repAlignmentSampleFrames = 0
      this.repFrontViewFrames = 0
      this.repSideViewFrames = 0
    }

    this.frameCount += 1
    if (!input.isCountingPaused && typeof input.frontAlignment === 'number' && Number.isFinite(input.frontAlignment)) {
      this.repAlignmentSampleFrames += 1
      this.repPeakFrontAlignment = Math.max(this.repPeakFrontAlignment, input.frontAlignment)
      if (input.frontAlignment >= NATIVE_FRONT_VIEW_ALT_RANGE_MIN) this.repFrontViewFrames += 1
      if (input.frontAlignment <= NATIVE_SIDE_VIEW_MAX_ALIGNMENT) this.repSideViewFrames += 1
    }
    if (!input.isCountingPaused) this.repValidFrameCount += 1
    if (!input.isCountingPaused && input.frontViewBad) this.repFrontBadFrames += 1
    if (!input.isCountingPaused && typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle)) {
      this.repMinElbowAngle = Math.min(this.repMinElbowAngle, input.elbowAngle)
    }
    if (!input.isCountingPaused && typeof input.elbowGap === 'number' && Number.isFinite(input.elbowGap) && input.elbowGap > 0) {
      this.repPeakElbowGap = Math.max(this.repPeakElbowGap, input.elbowGap)
      if (input.elbowGap >= NATIVE_FRONT_VIEW_ALT_ELBOW_GAP_FAIL) this.repElbowGapHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle)) {
      this.repMaxTorsoAngle = Math.max(this.repMaxTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= this.tuning.torsoLeanFailDeg) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.kneeAngle === 'number' && Number.isFinite(input.kneeAngle)) {
      this.repKneeSampleFrames += 1
      this.repMaxKneeAngle = Math.max(this.repMaxKneeAngle, input.kneeAngle)
      if (input.kneeAngle >= this.tuning.kneeStraightFailDeg) this.repKneeHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.symmetryGap === 'number' && Number.isFinite(input.symmetryGap) && input.symmetryGap > 0) {
      this.repPeakSymmetryGap = Math.max(this.repPeakSymmetryGap, input.symmetryGap)
      if (input.symmetryGap >= this.tuning.symmetryFailDeg) this.repSymmetryHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.rowAngle === 'number' && Number.isFinite(input.rowAngle)) {
      this.repMaxRowAngle = Math.max(this.repMaxRowAngle, input.rowAngle)
    }

    if (nextState === 's3') this.enteredTop = true

    if (this.currentState !== 's1' && nextState === 's1' && !this.enteredTop) {
      this.lastRepResult = null
      if (this.frameCount < NATIVE_REP_COUNT_MIN_FRAMES) {
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Complete a full rep: pull toward your hips, squeeze briefly at the top, then lower under control without swinging.']
      } else {
        this.lastRepMessage = 'Rep ignored: range of motion was too small to count.'
        this.lastRepReasonCodes = ['MOVE_TOO_SMALL']
        this.lastRepReasonLabels = ['Range of motion was too small']
        this.lastRepCorrections = ['Pull all the way back until dumbbells are close to your hips/lower ribs, keep your torso angle fixed, then lower slowly.']
      }
      this.lastRepFrameCount = this.frameCount
      this.repCount += 1
      this.unassessedCount += 1
      const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repMaxTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repMaxKneeAngle = 0
      this.repKneeHardFrames = 0
      this.repKneeSampleFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMaxRowAngle = 0
      this.currentState = nextState
      return
    }

    if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
      const enoughFrames = this.frameCount >= NATIVE_REP_COUNT_MIN_FRAMES
      if (!enoughFrames) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Complete a full rep: pull toward your hips, squeeze briefly at the top, then lower under control without swinging.']
        this.lastRepFrameCount = this.frameCount
        this.repCount += 1
        this.unassessedCount += 1
        const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)
        this.repDurationTotalSec += repDurationSec
        this.repDurationCount += 1
        this.frameCount = 0
        this.enteredTop = false
        this.repValidFrameCount = 0
        this.repFrontBadFrames = 0
        this.repMaxTorsoAngle = 0
        this.repTorsoHardFrames = 0
        this.repMaxKneeAngle = 0
        this.repKneeHardFrames = 0
        this.repKneeSampleFrames = 0
        this.repPeakSymmetryGap = 0
        this.repSymmetryHardFrames = 0
        this.repMaxRowAngle = 0
        this.currentState = nextState
        return
      }

      const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const frontBadRatio = this.frameCount > 0 ? this.repFrontBadFrames / this.frameCount : 0
      const assessable =
        this.repValidFrameCount >= NATIVE_REP_VALID_MIN_FRAMES && validRatio >= NATIVE_REP_VALID_RATIO_MIN

      this.repCount += 1
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      const tempoTooFast = repDurationSec < this.tempo.repFastSec
      const tempoTooSlow = repDurationSec > this.tempo.repSlowSec
      if (tempoTooFast) this.fastRepCount += 1
      if (tempoTooSlow) this.slowRepCount += 1
      if (frontBadRatio > NATIVE_FRONT_VIEW_FAIL_RATIO) this.viewInvalidRepCount += 1

      if (!assessable) {
        this.unassessedCount += 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to unstable or incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting, keep shoulders/elbows/wrists/hips visible, and avoid blocking joints with clothing or objects.']
      } else {
        const isFrontView =
          this.repAlignmentSampleFrames >= 5 && this.repFrontViewFrames / Math.max(1, this.repAlignmentSampleFrames) >= 0.5
        const isSideView =
          this.repAlignmentSampleFrames >= 5 && this.repSideViewFrames / Math.max(1, this.repAlignmentSampleFrames) >= 0.5
        const rangeInsufficient = isSideView && this.repMaxRowAngle < this.tuning.topRangeMinDeg
        const torsoLeanFailed =
          this.repMaxTorsoAngle >= this.tuning.torsoLeanFailDeg && this.repTorsoHardFrames >= this.tuning.torsoLeanFailMinFrames
        const kneeStraightFailed = (() => {
          if (!isSideView) return false
          if (!(this.repMaxKneeAngle > 0)) return false
          if (this.repMaxKneeAngle < this.tuning.kneeStraightFailDeg) return false
          if (this.repKneeSampleFrames >= 2) return this.repKneeHardFrames >= this.tuning.kneeStraightFailMinFrames
          if (this.repKneeSampleFrames === 1) return this.repMaxKneeAngle >= this.tuning.kneeStraightFailDeg + 5
          return false
        })()
        const symmetryFailed = isSideView && this.repPeakSymmetryGap >= this.tuning.symmetryFailDeg && this.repSymmetryHardFrames >= this.tuning.symmetryFailMinFrames

        if (rangeInsufficient || torsoLeanFailed || kneeStraightFailed || symmetryFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []

          if (rangeInsufficient) {
            this.rangeMissCount += 1
            reasonCodes.push('ROW_RANGE_INSUFFICIENT')
            reasonLabels.push('Arms did not pull close enough to hips')
            corrections.push('Pull the dumbbells closer to your hips for a full contraction.')
          }
          if (torsoLeanFailed) {
            this.torsoLeanCount += 1
            reasonCodes.push('TORSO_LEAN_EXCESSIVE')
            reasonLabels.push('Torso became too upright')
            corrections.push('Hinge at the hips and keep your torso stable through the pull.')
          }
          if (kneeStraightFailed) {
            this.kneeStraightCount += 1
            reasonCodes.push('KNEES_TOO_STRAIGHT')
            reasonLabels.push('Knees were too straight')
            corrections.push('Keep a soft bend in the knees throughout the set.')
          }
          if (symmetryFailed) {
            this.symmetryCount += 1
            reasonCodes.push('ARM_ASYMMETRY')
            reasonLabels.push('Arms were not pulled evenly')
            corrections.push('Pull both arms together and match left-right at the top.')
          }

          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage = reasonLabels.length > 1 ? 'Rep failed: multiple form issues detected.' : 'Rep failed: form needs correction.'
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep shoulders down and movement smooth.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      }

      if (this.debugEnabled) {
        this.lastCompletedRepMaxKneeAngle = this.repMaxKneeAngle > 0 ? this.repMaxKneeAngle : null
        this.lastCompletedRepKneeHardFrames = this.repKneeSampleFrames > 0 ? this.repKneeHardFrames : null
        this.lastCompletedRepKneeSampleFrames = this.repKneeSampleFrames > 0 ? this.repKneeSampleFrames : null
        this.lastCompletedRepFrontViewFrames = this.repAlignmentSampleFrames > 0 ? this.repFrontViewFrames : null
        this.lastCompletedRepSideViewFrames = this.repAlignmentSampleFrames > 0 ? this.repSideViewFrames : null
        this.lastCompletedRepAlignmentSampleFrames = this.repAlignmentSampleFrames > 0 ? this.repAlignmentSampleFrames : null
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repMaxTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repMaxKneeAngle = 0
      this.repKneeHardFrames = 0
      this.repKneeSampleFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMaxRowAngle = 0
      this.repAlignmentSampleFrames = 0
      this.repFrontViewFrames = 0
      this.repSideViewFrames = 0
    }

    this.currentState = nextState
  }

  private detectState(input: { elbowAngle: number | null; rowAngle: number | null; frontAlignment: number | null }): 's1' | 's2' | 's3' | null {
    const hasRowAngle =
      typeof input.frontAlignment === 'number' &&
      Number.isFinite(input.frontAlignment) &&
      input.frontAlignment <= NATIVE_SIDE_VIEW_MAX_ALIGNMENT &&
      typeof input.rowAngle === 'number' &&
      Number.isFinite(input.rowAngle)
    const elbowAngle = input.elbowAngle
    const rowAngle = hasRowAngle ? (input.rowAngle as number) : null

    const byRow = (): 's1' | 's2' | 's3' | null => {
      if (rowAngle === null) return null
      if (this.currentState === 's1') {
        if (rowAngle <= NATIVE_SIDE_S1_EXIT_ROW_DEG) return 's1'
        if (rowAngle >= NATIVE_SIDE_S3_ENTER_ROW_DEG) return 's3'
        return 's2'
      }
      if (this.currentState === 's3') {
        if (rowAngle >= NATIVE_SIDE_S3_EXIT_ROW_DEG) return 's3'
        if (rowAngle <= NATIVE_SIDE_S1_ENTER_ROW_DEG) return 's1'
        return 's2'
      }
      if (rowAngle <= NATIVE_SIDE_S1_ENTER_ROW_DEG) return 's1'
      if (rowAngle >= NATIVE_SIDE_S3_ENTER_ROW_DEG) return 's3'
      return 's2'
    }

    const byElbow = (): 's1' | 's2' | 's3' | null => {
      if (elbowAngle === null) return null
      if (this.currentState === 's1') {
        if (elbowAngle >= NATIVE_S1_EXIT_ROW_DEG) return 's1'
        if (elbowAngle <= NATIVE_S3_ENTER_ROW_DEG) return 's3'
        return 's2'
      }
      if (this.currentState === 's3') {
        if (elbowAngle <= NATIVE_S3_EXIT_ROW_DEG) return 's3'
        if (elbowAngle >= NATIVE_S1_ENTER_ROW_DEG) return 's1'
        return 's2'
      }
      if (elbowAngle >= NATIVE_S1_ENTER_ROW_DEG) return 's1'
      if (elbowAngle <= NATIVE_S3_ENTER_ROW_DEG) return 's3'
      return 's2'
    }

    if (hasRowAngle) {
      if (this.currentState === 's3') {
        const row = byRow()
        if (row === 's1') return 's1'
        const elbow = byElbow()
        if (elbow === 's1') return 's1'
        if (row === 's3') return 's3'
        if (elbow === 's3') return 's3'
        return row ?? elbow ?? 's2'
      }
      if (this.currentState === 's1') {
        const row = byRow()
        if (row === 's3') return 's3'
        const elbow = byElbow()
        if (elbow === 's3') return 's3'
        if (row === 's1') return 's1'
        if (elbow === 's1') return 's1'
        return row ?? elbow ?? 's2'
      }
      const row = byRow()
      const elbow = byElbow()
      if (row === 's1' || elbow === 's1') return 's1'
      if (row === 's3' || elbow === 's3') return 's3'
      return row ?? elbow ?? 's2'
    }

    return byElbow()
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): PoseAnalyzerFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's3') return 'bottom'
    return this.enteredTop ? 'descent' : 'ascent'
  }

  private trackingQuality(map: NamedKeypoints) {
    return this.avgScore(map, ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip'])
  }

  private byName(keypoints: MoveNetKeypoint[]): NamedKeypoints {
    const out = {} as NamedKeypoints
    for (const k of keypoints) out[k.name] = k
    return out
  }

  private avgScore(map: NamedKeypoints, names: MoveNetName[]) {
    let total = 0
    let count = 0
    for (const name of names) {
      const p = map[name]
      if (!p) continue
      total += p.score
      count += 1
    }
    return count > 0 ? total / count : 0
  }

  private midpoint(a?: MoveNetKeypoint, b?: MoveNetKeypoint) {
    if (!a || !b) return null
    if (Math.min(a.score, b.score) < 0.15) return null
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: Math.min(a.score, b.score) }
  }

  private angleDeg(a?: MoveNetKeypoint, b?: MoveNetKeypoint, c?: MoveNetKeypoint) {
    if (!a || !b || !c) return null
    if (Math.min(a.score, b.score, c.score) < 0.15) return null
    const abx = a.x - b.x
    const aby = a.y - b.y
    const cbx = c.x - b.x
    const cby = c.y - b.y
    const ab = Math.hypot(abx, aby)
    const cb = Math.hypot(cbx, cby)
    if (!ab || !cb) return null
    const dot = abx * cbx + aby * cby
    const cos = Math.min(1, Math.max(-1, dot / (ab * cb)))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleDegWithMinScore(a: MoveNetKeypoint | undefined, b: MoveNetKeypoint | undefined, c: MoveNetKeypoint | undefined, minScore: number) {
    if (!a || !b || !c) return null
    if (Math.min(a.score, b.score, c.score) < minScore) return null
    const abx = a.x - b.x
    const aby = a.y - b.y
    const cbx = c.x - b.x
    const cby = c.y - b.y
    const ab = Math.hypot(abx, aby)
    const cb = Math.hypot(cbx, cby)
    if (!ab || !cb) return null
    const dot = abx * cbx + aby * cby
    const cos = Math.min(1, Math.max(-1, dot / (ab * cb)))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private rowAngleDeg(shoulder?: MoveNetKeypoint, elbow?: MoveNetKeypoint, hip?: MoveNetKeypoint) {
    if (!shoulder || !hip) return null
    if (Math.min(shoulder.score, hip.score) < 0.15) return null
    if (!elbow) return null
    if (elbow.score < 0.15) return null
    const vArm = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }
    const vTorso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y }
    const armLen = Math.hypot(vArm.x, vArm.y)
    const torsoLen = Math.hypot(vTorso.x, vTorso.y)
    if (!armLen || !torsoLen) return null
    const dot = vArm.x * vTorso.x + vArm.y * vTorso.y
    const cos = Math.min(1, Math.max(-1, dot / (armLen * torsoLen)))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleFromHorizontalDeg(top?: { x: number; y: number; score: number } | null, bottom?: { x: number; y: number; score: number } | null) {
    if (!top || !bottom) return null
    const dx = Math.abs(top.x - bottom.x)
    const dy = Math.abs(top.y - bottom.y)
    if (!dx && !dy) return null
    return (Math.atan2(dy, dx) * 180) / Math.PI
  }

  private frontAlignmentDeg(leftShoulder?: MoveNetKeypoint, rightShoulder?: MoveNetKeypoint) {
    if (!leftShoulder || !rightShoulder) return null
    if (Math.min(leftShoulder.score, rightShoulder.score) < 0.15) return null
    const shoulderSpanX = Math.abs(leftShoulder.x - rightShoulder.x)
    const shoulderSpanY = Math.abs(leftShoulder.y - rightShoulder.y) + 1e-6
    return (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
  }

  private avgNumber(a: number | null | undefined, b: number | null | undefined) {
    const av = typeof a === 'number' && Number.isFinite(a) ? a : null
    const bv = typeof b === 'number' && Number.isFinite(b) ? b : null
    if (av === null && bv === null) return null
    if (av === null) return bv
    if (bv === null) return av
    return (av + bv) / 2
  }
}
