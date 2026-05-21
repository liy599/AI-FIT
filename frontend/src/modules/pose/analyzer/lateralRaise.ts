import type { PoseAnalyzerFeedback } from './types'
import type { MoveNetKeypoint, MoveNetName } from '../vision/movenetTracker'
import { isPoseDebugEnabled } from '../debugFlags'

const DEFAULT_NATIVE_ANALYZER_FPS = 40
const NATIVE_FRONT_VIEW_OK_ANGLE = 55
const NATIVE_FRONT_VIEW_FAIL_RATIO = 0.45

const NATIVE_REP_COUNT_MIN_FRAMES = 8
const NATIVE_REP_VALID_MIN_FRAMES = 8
const NATIVE_REP_VALID_RATIO_MIN = 0.45

const NATIVE_S1_ENTER_RAISE_DEG = 20
const NATIVE_S1_EXIT_RAISE_DEG = 26
const NATIVE_S3_ENTER_RAISE_DEG = 78
const NATIVE_S3_EXIT_RAISE_DEG = 70

export type LateralRaiseTuning = {
  trackingQualityMin: number
  torsoSwayWarnDeg: number
  torsoSwayFailDeg: number
  torsoSwayFailMinFrames: number
  symmetryWarnDeg: number
  symmetryFailDeg: number
  symmetryFailMinFrames: number
  elbowCurlWarnDeg: number
  elbowCurlFailDeg: number
  elbowCurlFailMinFrames: number
  topRangeMinDeg: number
}

export type LateralRaiseTempo = {
  repFastSec: number
  repSlowSec: number
}

export const DEFAULT_LATERAL_RAISE_TUNING: LateralRaiseTuning = {
  trackingQualityMin: 0.28,
  torsoSwayWarnDeg: 20,
  torsoSwayFailDeg: 30,
  torsoSwayFailMinFrames: 3,
  symmetryWarnDeg: 22,
  symmetryFailDeg: 32,
  symmetryFailMinFrames: 3,
  elbowCurlWarnDeg: 125,
  elbowCurlFailDeg: 112,
  elbowCurlFailMinFrames: 3,
  topRangeMinDeg: 70
}

export const DEFAULT_LATERAL_RAISE_TEMPO: LateralRaiseTempo = {
  repFastSec: 0.9,
  repSlowSec: 2.6
}

export const VIDEO_DEFAULT_LATERAL_RAISE_TEMPO: LateralRaiseTempo = {
  repFastSec: 0.95,
  repSlowSec: 3.6
}

type NamedKeypoints = Record<MoveNetName, MoveNetKeypoint | undefined>

export class LateralRaiseVideoAnalyzer {
  private debugEnabled = isPoseDebugEnabled()
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private rangeMissCount = 0
  private symmetryCount = 0
  private torsoSwayCount = 0
  private elbowCurlCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private enteredTop = false
  private stableS1Frames = 0
  private frameCount = 0
  private repValidFrameCount = 0
  private repFrontBadFrames = 0
  private repPeakTorsoAngle = 0
  private repTorsoHardFrames = 0
  private repPeakSymmetryGap = 0
  private repSymmetryHardFrames = 0
  private repMinElbowAngle = 180
  private repElbowHardFrames = 0
  private repMaxRaise = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private viewInvalidRepCount = 0
  private analyzerFps = DEFAULT_NATIVE_ANALYZER_FPS
  private tuning: LateralRaiseTuning = { ...DEFAULT_LATERAL_RAISE_TUNING }
  private tempo: LateralRaiseTempo = { ...VIDEO_DEFAULT_LATERAL_RAISE_TEMPO }
  private smoothLeftRaise: number | null = null
  private smoothRightRaise: number | null = null
  private lastCompletedRepMaxRaise: number | null = null
  private lastCompletedRepTorsoHardFrames: number | null = null
  private lastCompletedRepSymmetryHardFrames: number | null = null
  private lastCompletedRepElbowHardFrames: number | null = null
  private lastCompletedRepFrontBadFrames: number | null = null
  private lastCompletedRepValidFrames: number | null = null
  private lastCompletedRepFrames: number | null = null

  setTuning(next: Partial<LateralRaiseTuning>) {
    this.tuning = {
      ...this.tuning,
      ...next
    }
  }

  setAnalyzerFps(nextFps: number) {
    if (!Number.isFinite(nextFps)) return
    this.analyzerFps = Math.max(10, Math.min(120, nextFps))
  }

  setTempo(next: Partial<LateralRaiseTempo>) {
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

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)

    const leftRaiseRaw = this.raiseDegFromTorso(lShoulder, lElbow, lWrist, lHip)
    const rightRaiseRaw = this.raiseDegFromTorso(rShoulder, rElbow, rWrist, rHip)
    this.smoothLeftRaise = this.emaAngle(this.smoothLeftRaise, leftRaiseRaw, 0.35)
    this.smoothRightRaise = this.emaAngle(this.smoothRightRaise, rightRaiseRaw, 0.35)
    const leftRaise = this.smoothLeftRaise
    const rightRaise = this.smoothRightRaise
    const armRaise = this.avgNumber(leftRaise, rightRaise)

    const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist)
    const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist)
    const elbowAngle = this.avgNumber(leftElbowAngle, rightElbowAngle)
    const symmetryGap = leftRaise !== null && rightRaise !== null ? Math.abs(leftRaise - rightRaise) : null
    const torsoAngle = this.angleFromVerticalDeg(midShoulder, midHip)
    const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder)
    const trackingQuality = this.trackingQuality(map)

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []

    const isCountingPaused =
      trackingQuality < this.tuning.trackingQualityMin || armRaise === null || torsoAngle === null || frontAlignment === null

    const frontViewBad = frontAlignment !== null && frontAlignment < NATIVE_FRONT_VIEW_OK_ANGLE
    if (frontViewBad) warnings.push('Face the camera so both arms remain visible for lateral raise tracking.')
    if (trackingQuality < 0.45) warnings.push('Low keypoint confidence. Improve lighting and keep shoulders, elbows, wrists, and torso visible.')
    if (torsoAngle !== null && torsoAngle > this.tuning.torsoSwayWarnDeg) {
      issues.push({ message: 'Torso sway detected', joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] })
    }
    if (symmetryGap !== null && symmetryGap > this.tuning.symmetryWarnDeg) {
      issues.push({ message: 'Raise both arms evenly to improve symmetry.', joints: ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow'] })
    }
    if (elbowAngle !== null && elbowAngle < this.tuning.elbowCurlWarnDeg) {
      warnings.push('Keep elbows softly fixed. Avoid turning this into an elbow curl.')
    }

    const nextState = isCountingPaused ? this.currentState : this.detectState({ armRaise, leftRaise, rightRaise })
    this.updateState(nextState, {
      isCountingPaused,
      armRaise,
      torsoAngle,
      symmetryGap,
      elbowAngle,
      frontViewBad
    })

    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    const feedback: PoseAnalyzerFeedback = {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: armRaise !== null ? Math.round(armRaise) : null,
      hipAngle: elbowAngle !== null ? Math.round(elbowAngle) : null,
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
        forwardLeanCount: this.torsoSwayCount,
        backwardLeanCount: this.elbowCurlCount,
        sideViewWarningCount: this.viewInvalidRepCount,
        avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
        fastRepCount: this.fastRepCount,
        slowRepCount: this.slowRepCount
      }
    }
    if (this.debugEnabled) {
      feedback.debug = {
        leftRaiseDeg: leftRaise !== null ? Math.round(leftRaise) : null,
        rightRaiseDeg: rightRaise !== null ? Math.round(rightRaise) : null,
        raiseDeg: armRaise !== null ? Math.round(armRaise) : null,
        elbowAngleDeg: elbowAngle !== null ? Math.round(elbowAngle) : null,
        torsoAngleDeg: torsoAngle !== null ? Math.round(torsoAngle) : null,
        symmetryGapDeg: symmetryGap !== null ? Math.round(symmetryGap) : null,
        frontAlignmentDeg: frontAlignment !== null ? Math.round(frontAlignment) : null,
        stableS1Frames: this.stableS1Frames,
        repMaxRaiseDeg: this.repMaxRaise > 0 ? Math.round(this.repMaxRaise) : null,
        repPeakTorsoAngleDeg: this.repPeakTorsoAngle > 0 ? Math.round(this.repPeakTorsoAngle) : null,
        repTorsoHardFrames: this.repTorsoHardFrames,
        repPeakSymmetryGapDeg: this.repPeakSymmetryGap > 0 ? Math.round(this.repPeakSymmetryGap) : null,
        repSymmetryHardFrames: this.repSymmetryHardFrames,
        repMinElbowAngleDeg: this.repMinElbowAngle < 180 ? Math.round(this.repMinElbowAngle) : null,
        repElbowHardFrames: this.repElbowHardFrames,
        repFrontBadFrames: this.repFrontBadFrames,
        repValidFrameCount: this.repValidFrameCount,
        repFrameCount: this.frameCount,
        lastCompletedRepMaxRaiseDeg: this.lastCompletedRepMaxRaise !== null ? Math.round(this.lastCompletedRepMaxRaise) : null,
        lastCompletedRepTorsoHardFrames: this.lastCompletedRepTorsoHardFrames,
        lastCompletedRepSymmetryHardFrames: this.lastCompletedRepSymmetryHardFrames,
        lastCompletedRepElbowHardFrames: this.lastCompletedRepElbowHardFrames,
        lastCompletedRepFrontBadFrames: this.lastCompletedRepFrontBadFrames,
        lastCompletedRepValidFrames: this.lastCompletedRepValidFrames,
        lastCompletedRepFrames: this.lastCompletedRepFrames,
        tuningTopRangeMinDeg: this.tuning.topRangeMinDeg,
        tuningTorsoSwayFailDeg: this.tuning.torsoSwayFailDeg,
        tuningTorsoSwayFailMinFrames: this.tuning.torsoSwayFailMinFrames,
        tuningSymmetryFailDeg: this.tuning.symmetryFailDeg,
        tuningSymmetryFailMinFrames: this.tuning.symmetryFailMinFrames,
        tuningElbowCurlFailDeg: this.tuning.elbowCurlFailDeg,
        tuningElbowCurlFailMinFrames: this.tuning.elbowCurlFailMinFrames
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
    this.torsoSwayCount = 0
    this.elbowCurlCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.enteredTop = false
    this.stableS1Frames = 0
    this.frameCount = 0
    this.repValidFrameCount = 0
    this.repFrontBadFrames = 0
    this.repPeakTorsoAngle = 0
    this.repTorsoHardFrames = 0
    this.repPeakSymmetryGap = 0
    this.repSymmetryHardFrames = 0
    this.repMinElbowAngle = 180
    this.repElbowHardFrames = 0
    this.repMaxRaise = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.viewInvalidRepCount = 0
    this.smoothLeftRaise = null
    this.smoothRightRaise = null
    this.lastCompletedRepMaxRaise = null
    this.lastCompletedRepTorsoHardFrames = null
    this.lastCompletedRepSymmetryHardFrames = null
    this.lastCompletedRepElbowHardFrames = null
    this.lastCompletedRepFrontBadFrames = null
    this.lastCompletedRepValidFrames = null
    this.lastCompletedRepFrames = null
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      armRaise: number | null
      torsoAngle: number | null
      symmetryGap: number | null
      elbowAngle: number | null
      frontViewBad: boolean
    }
  ) {
    if (nextState === null) return

    if (nextState === 's1' && !input.isCountingPaused) {
      this.stableS1Frames += 1
    } else if (nextState !== 's1') {
      this.stableS1Frames = 0
    }

    const startedRep = this.currentState === 's1' && nextState === 's2' && this.stableS1Frames >= 2
    if (startedRep) {
      this.frameCount = 0
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMinElbowAngle = 180
      this.repElbowHardFrames = 0
      this.repMaxRaise = 0
    }

    this.frameCount += 1
    if (!input.isCountingPaused) this.repValidFrameCount += 1
    if (!input.isCountingPaused && input.frontViewBad) this.repFrontBadFrames += 1
    if (!input.isCountingPaused && typeof input.armRaise === 'number' && Number.isFinite(input.armRaise)) {
      this.repMaxRaise = Math.max(this.repMaxRaise, input.armRaise)
    }
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle) && input.torsoAngle > 0) {
      this.repPeakTorsoAngle = Math.max(this.repPeakTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= this.tuning.torsoSwayFailDeg) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.symmetryGap === 'number' && Number.isFinite(input.symmetryGap) && input.symmetryGap > 0) {
      this.repPeakSymmetryGap = Math.max(this.repPeakSymmetryGap, input.symmetryGap)
      if (input.symmetryGap >= this.tuning.symmetryFailDeg) this.repSymmetryHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle) && input.elbowAngle > 0) {
      this.repMinElbowAngle = Math.min(this.repMinElbowAngle, input.elbowAngle)
      if (input.elbowAngle <= this.tuning.elbowCurlFailDeg) this.repElbowHardFrames += 1
    }

    if (nextState === 's3') this.enteredTop = true

    if (this.currentState !== 's1' && nextState === 's1' && !this.enteredTop) {
      this.lastRepResult = null
      if (this.frameCount < NATIVE_REP_COUNT_MIN_FRAMES) {
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Complete a full rep: raise both dumbbells to shoulder height, pause briefly, then lower under control.']
      } else {
        this.lastRepMessage = 'Rep ignored: arms did not reach shoulder height.'
        this.lastRepReasonCodes = ['TOP_RANGE_INSUFFICIENT']
        this.lastRepReasonLabels = ['Arms did not reach shoulder height']
        this.lastRepCorrections = ['Raise to shoulder height (upper arms roughly parallel to the floor), keep elbows softly bent, then lower slowly without swinging.']
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
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMinElbowAngle = 180
      this.repElbowHardFrames = 0
      this.repMaxRaise = 0
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
        this.lastRepCorrections = ['Complete a full rep: raise both dumbbells to shoulder height, pause briefly, then lower under control.']
        this.lastRepFrameCount = this.frameCount
        this.repCount += 1
        this.unassessedCount += 1
        const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)
        this.repDurationTotalSec += repDurationSec
        this.repDurationCount += 1
        this.frameCount = 0
        this.enteredTop = false
        this.currentState = nextState
        return
      }

      const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const frontBadRatio = this.frameCount > 0 ? this.repFrontBadFrames / this.frameCount : 0
      const assessable =
        this.repValidFrameCount >= NATIVE_REP_VALID_MIN_FRAMES && validRatio >= NATIVE_REP_VALID_RATIO_MIN && frontBadRatio <= NATIVE_FRONT_VIEW_FAIL_RATIO

      this.repCount += 1
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      const tempoTooFast = repDurationSec < this.tempo.repFastSec
      if (tempoTooFast) this.fastRepCount += 1
      if (frontBadRatio > NATIVE_FRONT_VIEW_FAIL_RATIO) this.viewInvalidRepCount += 1

      if (!assessable) {
        this.unassessedCount += 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to unstable or incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting, keep shoulders/elbows/wrists/hips visible, and avoid blocking joints with clothing or objects.']
      } else {
        const topInsufficient = this.repMaxRaise < this.tuning.topRangeMinDeg
        const torsoSwayFailed =
          this.repPeakTorsoAngle >= this.tuning.torsoSwayFailDeg && this.repTorsoHardFrames >= this.tuning.torsoSwayFailMinFrames
        const symmetryFailed =
          this.repPeakSymmetryGap >= this.tuning.symmetryFailDeg && this.repSymmetryHardFrames >= this.tuning.symmetryFailMinFrames
        const elbowCurlFailed =
          this.repMinElbowAngle <= this.tuning.elbowCurlFailDeg && this.repElbowHardFrames >= this.tuning.elbowCurlFailMinFrames

        if (topInsufficient || torsoSwayFailed || symmetryFailed || elbowCurlFailed || tempoTooFast) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []

          if (topInsufficient) {
            this.rangeMissCount += 1
            reasonCodes.push('TOP_RANGE_INSUFFICIENT')
            reasonLabels.push('Arms did not reach shoulder height')
            corrections.push('Lift to about shoulder height, then lower under control.')
          }
          if (torsoSwayFailed) {
            this.torsoSwayCount += 1
            reasonCodes.push('TORSO_SWAY')
            reasonLabels.push('Torso sway detected')
            corrections.push('Lower the load and keep your torso stable without swinging.')
          }
          if (symmetryFailed) {
            this.symmetryCount += 1
            reasonCodes.push('ASYMMETRY')
            reasonLabels.push('Arms were not raised evenly')
            corrections.push('Raise both arms together and match left-right height at the top.')
          }
          if (elbowCurlFailed) {
            this.elbowCurlCount += 1
            reasonCodes.push('ELBOW_CURL')
            reasonLabels.push('Elbows bent too much (turned into a curl)')
            corrections.push('Keep a soft elbow bend and move from the shoulder joint.')
          }
          if (tempoTooFast) {
            reasonCodes.push('TEMPO_TOO_FAST')
            reasonLabels.push('Rep tempo was too fast')
            corrections.push('Slow down: lift up under control, brief pause at the top, then lower with control.')
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
        this.lastCompletedRepMaxRaise = this.repMaxRaise > 0 ? this.repMaxRaise : null
        this.lastCompletedRepTorsoHardFrames = this.repTorsoHardFrames
        this.lastCompletedRepSymmetryHardFrames = this.repSymmetryHardFrames
        this.lastCompletedRepElbowHardFrames = this.repElbowHardFrames
        this.lastCompletedRepFrontBadFrames = this.repFrontBadFrames
        this.lastCompletedRepValidFrames = this.repValidFrameCount
        this.lastCompletedRepFrames = this.frameCount
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMinElbowAngle = 180
      this.repElbowHardFrames = 0
      this.repMaxRaise = 0
    }

    this.currentState = nextState
  }

  private detectState(input: { armRaise: number | null; leftRaise: number | null; rightRaise: number | null }): 's1' | 's2' | 's3' | null {
    const armRaise = input.armRaise
    if (armRaise === null) return null
    const left = input.leftRaise
    const right = input.rightRaise
    const bothHigh = typeof left === 'number' && typeof right === 'number' && left >= 62 && right >= 62

    if (this.currentState === 's1') {
      if (armRaise <= NATIVE_S1_EXIT_RAISE_DEG) return 's1'
      if (bothHigh && armRaise >= NATIVE_S3_ENTER_RAISE_DEG) return 's3'
      return 's2'
    }
    if (this.currentState === 's3') {
      if (bothHigh && armRaise >= NATIVE_S3_EXIT_RAISE_DEG) return 's3'
      if (armRaise <= NATIVE_S1_ENTER_RAISE_DEG) return 's1'
      return 's2'
    }
    if (armRaise <= NATIVE_S1_ENTER_RAISE_DEG) return 's1'
    if (bothHigh && armRaise >= NATIVE_S3_ENTER_RAISE_DEG) return 's3'
    return 's2'
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

  private raiseDegFromTorso(shoulder?: MoveNetKeypoint, elbow?: MoveNetKeypoint, wrist?: MoveNetKeypoint, hip?: MoveNetKeypoint) {
    if (!shoulder || !hip) return null
    const pivot = this.bestPoint(elbow, wrist)
    if (!pivot) return null
    if (Math.min(shoulder.score, hip.score) < 0.15) return null
    const vArm = { x: pivot.x - shoulder.x, y: pivot.y - shoulder.y }
    const vTorso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y }
    const armLen = Math.hypot(vArm.x, vArm.y)
    const torsoLen = Math.hypot(vTorso.x, vTorso.y)
    if (!armLen || !torsoLen) return null
    const dot = vArm.x * vTorso.x + vArm.y * vTorso.y
    const cos = Math.min(1, Math.max(-1, dot / (armLen * torsoLen)))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private bestPoint(a?: MoveNetKeypoint, b?: MoveNetKeypoint) {
    const av = typeof a?.score === 'number' ? a.score : 0
    const bv = typeof b?.score === 'number' ? b.score : 0
    if (a && av >= 0.2) return a
    if (b && bv >= 0.2) return b
    return null
  }

  private angleFromVerticalDeg(top?: { x: number; y: number; score: number } | null, bottom?: { x: number; y: number; score: number } | null) {
    if (!top || !bottom) return null
    const dx = bottom.x - top.x
    const dy = bottom.y - top.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
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

  private emaAngle(prev: number | null, next: number | null, alpha: number) {
    if (next === null) return prev
    if (prev === null) return next
    return prev + (next - prev) * alpha
  }
}
