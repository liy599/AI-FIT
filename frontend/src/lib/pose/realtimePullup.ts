// LEGACY (MediaPipe 33 landmarks): kept for reference; not used by current PoseTool chain.
// import type { NormalizedLandmark } from './mediapipePose'
import type { RealtimeFeedback } from './realtimeSquat'
import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'

const ASSUMED_ANALYZER_FPS = 24
const REP_FAST_SEC = 0.85
const REP_SLOW_SEC = 5.5
const REP_IGNORE_FAST_SEC = 0.55
const REP_COUNT_MIN_FRAMES = 6
const REP_VALID_MIN_FRAMES = 8
const REP_VALID_RATIO_MIN = 0.45
const TRACKING_QUALITY_MIN = 0.32

const S1_ENTER_ELBOW_ANGLE = 160
const S1_EXIT_ELBOW_ANGLE = 150
const S3_ENTER_ELBOW_ANGLE = 95
const S3_EXIT_ELBOW_ANGLE = 110

const TORSO_SWING_WARN_DEG = 25
const TORSO_SWING_FAIL_DEG = 42
const TORSO_SWING_FAIL_MIN_FRAMES = 3
const BODY_LINE_WARN_DEG = 140
const BODY_LINE_FAIL_DEG = 125
const BODY_LINE_FAIL_MIN_FRAMES = 3
const ARM_ASYM_WARN_DEG = 18
const ARM_ASYM_FAIL_DEG = 32
const ARM_ASYM_FAIL_MIN_FRAMES = 3
const TOP_HOLD_MIN_FRAMES = 1

/*
export class RealtimePullupLegacyAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private enteredTop = false
  private frameCount = 0
  private barY: number | null = null
  private barSamples = 0
  private repValidFrameCount = 0
  private repPeakTorsoAngle = 0
  private repTorsoHardFrames = 0
  private repMinBodyLineAngle = 180
  private repBodyLineHardFrames = 0
  private repPeakArmAsymDeg = 0
  private repArmAsymHardFrames = 0
  private repMinElbowAngle = 180
  private repChinOverBarFrames = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0

  analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]
    const leftElbow = landmarks[13]
    const rightElbow = landmarks[14]
    const leftWrist = landmarks[15]
    const rightWrist = landmarks[16]
    const leftHip = landmarks[23]
    const rightHip = landmarks[24]
    const leftKnee = landmarks[25]
    const rightKnee = landmarks[26]
    const leftAnkle = landmarks[27]
    const rightAnkle = landmarks[28]
    const nose = landmarks[0]

    const leftElbowAngle = this.angleDeg(leftShoulder, leftElbow, leftWrist)
    const rightElbowAngle = this.angleDeg(rightShoulder, rightElbow, rightWrist)
    const elbowAngle = this.avgNumber(leftElbowAngle, rightElbowAngle)
    const bodyLineAngle = this.angleDeg(this.midpoint(leftShoulder, rightShoulder), this.midpoint(leftHip, rightHip), this.midpoint(leftAnkle, rightAnkle))
    const torsoAngle = this.angleFromVerticalDeg(this.midpoint(leftShoulder, rightShoulder), this.midpoint(leftHip, rightHip))
    const frontAlignment = this.frontAlignmentDeg(leftShoulder, rightShoulder)
    const trackingQuality = this.avgVisibility(landmarks, [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28])
    const elbowAsymDeg =
      leftElbowAngle !== null && rightElbowAngle !== null ? Math.abs(leftElbowAngle - rightElbowAngle) : null

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []
    const isCountingPaused = trackingQuality < TRACKING_QUALITY_MIN || elbowAngle === null
    if (!isCountingPaused) this.tryUpdateBarEstimate({ leftShoulder, rightShoulder, leftWrist, rightWrist, leftElbowAngle, rightElbowAngle })
    const chinOverBar = this.chinOverBar(nose, this.barY)
    const nextState = isCountingPaused ? this.currentState : this.detectState({ elbowAngle, chinOverBar })

    if (trackingQuality < 0.45) {
      warnings.push('Low keypoint confidence. Keep your full body in frame with stronger lighting.')
    }
    if (frontAlignment !== null && frontAlignment < 55) {
      warnings.push('Face the camera so both arms and shoulders stay visible for pull-up tracking.')
    }
    if (torsoAngle !== null && torsoAngle > TORSO_SWING_WARN_DEG) {
      issues.push({ message: 'Excessive torso swing detected', joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] })
    }
    if (bodyLineAngle !== null && bodyLineAngle < BODY_LINE_WARN_DEG) {
      warnings.push('Keep a straighter body line and avoid excessive knee swing.')
    }
    if (elbowAsymDeg !== null && elbowAsymDeg > ARM_ASYM_WARN_DEG) {
      warnings.push('Try to keep both arms moving evenly at the top and bottom.')
    }

    this.updateState(nextState, {
      isCountingPaused,
      elbowAngle,
      torsoAngle,
      bodyLineAngle,
      elbowAsymDeg,
      chinOverBar
    })
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: elbowAngle ? Math.round(elbowAngle) : null,
      hipAngle: bodyLineAngle ? Math.round(bodyLineAngle) : null,
      torsoAngle: torsoAngle ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: null,
      offsetAngle: frontAlignment ? Math.round(frontAlignment) : null,
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
        depthInsufficientCount: 0,
        kneeOverToeCount: 0,
        forwardLeanCount: 0,
        backwardLeanCount: 0,
        sideViewWarningCount: 0,
        avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
        fastRepCount: this.fastRepCount,
        slowRepCount: this.slowRepCount
      }
    }
  }

  resetSession() {
    this.repCount = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepFrameCount = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.enteredTop = false
    this.frameCount = 0
    this.barY = null
    this.barSamples = 0
    this.repValidFrameCount = 0
    this.repPeakTorsoAngle = 0
    this.repTorsoHardFrames = 0
    this.repMinBodyLineAngle = 180
    this.repBodyLineHardFrames = 0
    this.repPeakArmAsymDeg = 0
    this.repArmAsymHardFrames = 0
    this.repMinElbowAngle = 180
    this.repChinOverBarFrames = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      elbowAngle: number | null
      torsoAngle: number | null
      bodyLineAngle: number | null
      elbowAsymDeg: number | null
      chinOverBar: boolean
    }
  ) {
    if (nextState === null) return
    const startedRep = this.currentState === 's1' && nextState === 's2'
    if (startedRep) {
      this.frameCount = 0
      this.repValidFrameCount = 0
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repMinBodyLineAngle = 180
      this.repBodyLineHardFrames = 0
      this.repPeakArmAsymDeg = 0
      this.repArmAsymHardFrames = 0
      this.repMinElbowAngle = 180
      this.repChinOverBarFrames = 0
    }
    this.frameCount += 1
    if (!input.isCountingPaused) this.repValidFrameCount += 1
    if (!input.isCountingPaused && typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle)) {
      this.repMinElbowAngle = Math.min(this.repMinElbowAngle, input.elbowAngle)
    }
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle) && input.torsoAngle > 0) {
      this.repPeakTorsoAngle = Math.max(this.repPeakTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= TORSO_SWING_FAIL_DEG) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.bodyLineAngle === 'number' && Number.isFinite(input.bodyLineAngle) && input.bodyLineAngle > 0) {
      this.repMinBodyLineAngle = Math.min(this.repMinBodyLineAngle, input.bodyLineAngle)
      if (input.bodyLineAngle <= BODY_LINE_FAIL_DEG) this.repBodyLineHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.elbowAsymDeg === 'number' && Number.isFinite(input.elbowAsymDeg) && input.elbowAsymDeg > 0) {
      this.repPeakArmAsymDeg = Math.max(this.repPeakArmAsymDeg, input.elbowAsymDeg)
      if (input.elbowAsymDeg >= ARM_ASYM_FAIL_DEG) this.repArmAsymHardFrames += 1
    }
    if (!input.isCountingPaused && input.chinOverBar) this.repChinOverBarFrames += 1

    if (nextState === 's3') this.enteredTop = true
    if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
      const enoughForCounting = this.frameCount >= REP_COUNT_MIN_FRAMES
      if (!enoughForCounting) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Start from a dead hang, pull smoothly to the top, then return to full extension.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredTop = false
        this.currentState = nextState
        return
      }

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const hasReliableTracking = this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN
      this.repCount += 1

      const repDurationSec = Math.max(0.1, this.frameCount / ASSUMED_ANALYZER_FPS)
      if (repDurationSec < REP_IGNORE_FAST_SEC) {
        this.repCount -= 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too fast to count.'
        this.lastRepReasonCodes = ['REP_TOO_FAST_IGNORE']
        this.lastRepReasonLabels = ['Movement was too fast to count']
        this.lastRepCorrections = ['Slow down: pause briefly at the top, then lower under control.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredTop = false
        this.repValidFrameCount = 0
        this.repPeakTorsoAngle = 0
        this.repTorsoHardFrames = 0
        this.repMinBodyLineAngle = 180
        this.repBodyLineHardFrames = 0
        this.repPeakArmAsymDeg = 0
        this.repArmAsymHardFrames = 0
        this.repMinElbowAngle = 180
        this.repChinOverBarFrames = 0
        this.currentState = nextState
        return
      }
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < REP_FAST_SEC) this.fastRepCount += 1
      if (repDurationSec > REP_SLOW_SEC) this.slowRepCount += 1

      if (hasReliableTracking) {
        const torsoSwingFailed = this.repPeakTorsoAngle >= TORSO_SWING_FAIL_DEG && this.repTorsoHardFrames >= TORSO_SWING_FAIL_MIN_FRAMES
        const bodyLineFailed = this.repMinBodyLineAngle <= BODY_LINE_FAIL_DEG && this.repBodyLineHardFrames >= BODY_LINE_FAIL_MIN_FRAMES
        const armAsymFailed = this.repPeakArmAsymDeg >= ARM_ASYM_FAIL_DEG && this.repArmAsymHardFrames >= ARM_ASYM_FAIL_MIN_FRAMES
        const topInsufficient =
          this.barSamples >= 10 ? this.repChinOverBarFrames < TOP_HOLD_MIN_FRAMES : this.repMinElbowAngle > 105
        const tempoTooFast = repDurationSec < REP_FAST_SEC
        const tempoTooSlow = repDurationSec > REP_SLOW_SEC

        if (torsoSwingFailed || bodyLineFailed || armAsymFailed || topInsufficient || tempoTooFast || tempoTooSlow) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []

          if (topInsufficient) {
            reasonCodes.push('TOP_POSITION_MISSED')
            reasonLabels.push('Top position not reached (chin did not clear bar)')
            corrections.push('Pull higher so your chin clears the bar, then lower under control.')
          }
          if (torsoSwingFailed) {
            reasonCodes.push('TORSO_SWING_EXCESSIVE')
            reasonLabels.push('Excessive torso swing (kipping)')
            corrections.push('Brace your core and reduce swing; pause briefly before each pull.')
          }
          if (bodyLineFailed) {
            reasonCodes.push('BODY_LINE_BROKEN')
            reasonLabels.push('Body line broke (knees swinging)')
            corrections.push('Keep legs together and maintain a hollow body position to minimize knee swing.')
          }
          if (armAsymFailed) {
            reasonCodes.push('ARM_ASYMMETRY')
            reasonLabels.push('Arms moved unevenly')
            corrections.push('Pull with both arms evenly; keep shoulders level and avoid twisting.')
          }
          if (tempoTooFast) {
            reasonCodes.push('REP_TOO_FAST')
            reasonLabels.push('Rep tempo too fast')
            corrections.push('Slow down: 1s up, brief pause, 2s down.')
          }
          if (tempoTooSlow) {
            reasonCodes.push('REP_TOO_SLOW')
            reasonLabels.push('Rep tempo too slow')
            corrections.push('Keep control, but avoid long stalls; use a smoother continuous rhythm.')
          }

          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage = reasonLabels.length > 1 ? 'Rep failed: multiple form issues detected.' : 'Rep failed: form needs correction.'
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep the tempo controlled.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      } else {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting and keep both hands, head, shoulders, and hips visible.']
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repMinBodyLineAngle = 180
      this.repBodyLineHardFrames = 0
      this.repPeakArmAsymDeg = 0
      this.repArmAsymHardFrames = 0
      this.repMinElbowAngle = 180
      this.repChinOverBarFrames = 0
    }
    this.currentState = nextState
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's2') return 'ascent'
    if (state === 's3') return 'bottom'
    return 'up'
  }

  private detectState(input: { elbowAngle: number | null; chinOverBar: boolean }): 's1' | 's2' | 's3' | null {
    const elbowAngle = input.elbowAngle
    if (elbowAngle === null) return null
    const chinOverBar = input.chinOverBar

    if (this.currentState === 's1') {
      if (elbowAngle >= S1_EXIT_ELBOW_ANGLE) return 's1'
      if (chinOverBar || elbowAngle <= S3_ENTER_ELBOW_ANGLE) return 's3'
      return 's2'
    }
    if (this.currentState === 's3') {
      if (chinOverBar || elbowAngle <= S3_EXIT_ELBOW_ANGLE) return 's3'
      if (elbowAngle < S1_ENTER_ELBOW_ANGLE) return 's2'
      return 's1'
    }
    if (elbowAngle >= S1_ENTER_ELBOW_ANGLE) return 's1'
    if (chinOverBar || elbowAngle <= S3_ENTER_ELBOW_ANGLE) return 's3'
    return 's2'
  }

  private angleDeg(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null, c?: NormalizedLandmark | null): number | null {
    if (!a || !b || !c) return null
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
    const dx = top.x - bottom.x
    const dy = top.y - bottom.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private chinOverBar(nose: NormalizedLandmark | undefined, barY: number | null) {
    const noseY = nose?.y
    return typeof barY === 'number' && typeof noseY === 'number' && Number.isFinite(noseY) && noseY < barY - 0.02
  }

  private frontAlignmentDeg(leftShoulder?: NormalizedLandmark | null, rightShoulder?: NormalizedLandmark | null): number | null {
    if (!leftShoulder || !rightShoulder) return null
    const shoulderSpanX = Math.abs(leftShoulder.x - rightShoulder.x)
    const shoulderSpanY = Math.abs(leftShoulder.y - rightShoulder.y) + 1e-6
    return (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
  }

  private midpoint(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null): NormalizedLandmark | null {
    if (!a || !b) return null
    if (Math.min(a.visibility ?? 0, b.visibility ?? 0) < 0.15) return null
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
      visibility: this.avgNumber(a.visibility ?? 0, b.visibility ?? 0) ?? 0
    }
  }

  private avgNumber(a: number | null | undefined, b: number | null | undefined): number | null {
    const av = typeof a === 'number' && Number.isFinite(a) ? a : null
    const bv = typeof b === 'number' && Number.isFinite(b) ? b : null
    if (av === null && bv === null) return null
    if (av === null) return bv
    if (bv === null) return av
    return (av + bv) / 2
  }

  private tryUpdateBarEstimate(input: {
    leftShoulder?: NormalizedLandmark | null
    rightShoulder?: NormalizedLandmark | null
    leftWrist?: NormalizedLandmark | null
    rightWrist?: NormalizedLandmark | null
    leftElbowAngle: number | null
    rightElbowAngle: number | null
  }) {
    const shoulderMid = this.midpoint(input.leftShoulder, input.rightShoulder)
    const wristMid = this.midpoint(input.leftWrist, input.rightWrist)
    if (!shoulderMid || !wristMid) return
    const elbowAvg = this.avgNumber(input.leftElbowAngle, input.rightElbowAngle)
    if (elbowAvg === null || elbowAvg < 160) return
    if (!(wristMid.y < shoulderMid.y - 0.02)) return
    const sample = wristMid.y
    if (this.barY === null) {
      this.barY = sample
      this.barSamples = 1
      return
    }
    const alpha = this.barSamples < 12 ? 0.25 : 0.08
    this.barY = this.barY * (1 - alpha) + sample * alpha
    this.barSamples = Math.min(60, this.barSamples + 1)
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
}
*/

const DEFAULT_NATIVE_ANALYZER_FPS = 40
const FRONT_VIEW_OK_ANGLE = 55
const FRONT_VIEW_FAIL_RATIO = 0.45

export type PullupTuning = {
  trackingQualityMin: number
  torsoSwingWarnDeg: number
  torsoSwingFailDeg: number
  torsoSwingFailMinFrames: number
  armAsymWarnDeg: number
  armAsymFailDeg: number
  armAsymFailMinFrames: number
  topHoldMinFrames: number
  chinOverBarMargin: number
  barCalibElbowMinDeg: number
}

export type PullupTempo = {
  repFastSec: number
  repSlowSec: number
}

export const DEFAULT_PULLUP_TUNING: PullupTuning = {
  trackingQualityMin: 0.28,
  torsoSwingWarnDeg: 24,
  torsoSwingFailDeg: 42,
  torsoSwingFailMinFrames: 3,
  armAsymWarnDeg: 18,
  armAsymFailDeg: 32,
  armAsymFailMinFrames: 3,
  topHoldMinFrames: 1,
  chinOverBarMargin: 0.02,
  barCalibElbowMinDeg: 160
}

export const REALTIME_DEFAULT_PULLUP_TEMPO: PullupTempo = {
  repFastSec: 0.9,
  repSlowSec: 2.6
}

export const VIDEO_DEFAULT_PULLUP_TEMPO: PullupTempo = {
  repFastSec: 0.95,
  repSlowSec: 3.0
}

type NamedKeypoints = Record<MoveNetName, MoveNetKeypoint | undefined>

export class RealtimePullupAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private topMissCount = 0
  private swingCount = 0
  private armAsymCount = 0
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
  private repPeakArmAsymDeg = 0
  private repArmAsymHardFrames = 0
  private repMinElbowAngle = 180
  private repChinOverBarFrames = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private viewInvalidRepCount = 0
  private analyzerFps = DEFAULT_NATIVE_ANALYZER_FPS
  private tuning: PullupTuning = { ...DEFAULT_PULLUP_TUNING }
  private tempo: PullupTempo = { ...REALTIME_DEFAULT_PULLUP_TEMPO }
  private barY: number | null = null
  private barSamples = 0

  setTuning(next: Partial<PullupTuning>) {
    this.tuning = {
      ...this.tuning,
      ...next
    }
  }

  setAnalyzerFps(nextFps: number) {
    if (!Number.isFinite(nextFps)) return
    this.analyzerFps = Math.max(10, Math.min(120, nextFps))
  }

  setTempo(next: Partial<PullupTempo>) {
    const repFastSec =
      typeof next.repFastSec === 'number' && Number.isFinite(next.repFastSec) ? Math.max(0.2, Math.min(8, next.repFastSec)) : this.tempo.repFastSec
    const repSlowSec =
      typeof next.repSlowSec === 'number' && Number.isFinite(next.repSlowSec) ? Math.max(0.3, Math.min(12, next.repSlowSec)) : this.tempo.repSlowSec
    this.tempo = {
      repFastSec,
      repSlowSec: Math.max(repSlowSec, repFastSec + 0.1)
    }
  }

  analyzeNative(keypoints: MoveNetKeypoint[]): RealtimeFeedback {
    const map = this.byName(keypoints)
    const lShoulder = map.left_shoulder
    const rShoulder = map.right_shoulder
    const lElbow = map.left_elbow
    const rElbow = map.right_elbow
    const lWrist = map.left_wrist
    const rWrist = map.right_wrist
    const lHip = map.left_hip
    const rHip = map.right_hip
    const nose = map.nose

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)

    const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist)
    const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist)
    const elbowAngleRaw = this.avgNumber(leftElbowAngle, rightElbowAngle)
    const elbowAngle = elbowAngleRaw
    const torsoAngle = this.angleFromVerticalDeg(midShoulder, midHip)
    const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder)
    const trackingQuality = this.trackingQuality(map)
    const elbowAsymDeg =
      leftElbowAngle !== null && rightElbowAngle !== null ? Math.abs(leftElbowAngle - rightElbowAngle) : null

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []

    const isCountingPaused =
      trackingQuality < this.tuning.trackingQualityMin || elbowAngleRaw === null || torsoAngle === null || frontAlignment === null

    const frontViewBad = frontAlignment !== null && frontAlignment < FRONT_VIEW_OK_ANGLE
    if (frontViewBad) warnings.push('Face the camera so both arms and shoulders remain visible for pull-up tracking.')
    if (torsoAngle !== null && torsoAngle > this.tuning.torsoSwingWarnDeg) {
      issues.push({ message: 'Excessive torso swing detected', joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] })
    }
    if (elbowAsymDeg !== null && elbowAsymDeg > this.tuning.armAsymWarnDeg) {
      warnings.push('Try to keep both arms moving evenly throughout the pull.')
    }
    if (trackingQuality < 0.45) warnings.push('Low keypoint confidence. Improve lighting and keep hands, shoulders, and hips visible.')

    if (!isCountingPaused) this.tryUpdateBarEstimate(map, elbowAngleRaw)
    const chinOverBar = this.chinOverBar(nose, this.barY)
    const nextState = isCountingPaused ? this.currentState : this.detectState({ elbowAngle: elbowAngleRaw, chinOverBar })

    this.updateState(nextState, {
      isCountingPaused,
      elbowAngle: elbowAngleRaw,
      torsoAngle,
      elbowAsymDeg,
      chinOverBar,
      frontViewBad
    })

    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: elbowAngle !== null ? Math.round(elbowAngle) : null,
      hipAngle: null,
      torsoAngle: torsoAngle !== null ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: elbowAsymDeg !== null ? Math.round(elbowAsymDeg) : null,
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
        depthInsufficientCount: this.topMissCount,
        kneeOverToeCount: this.armAsymCount,
        forwardLeanCount: this.swingCount,
        backwardLeanCount: 0,
        sideViewWarningCount: this.viewInvalidRepCount,
        avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
        fastRepCount: this.fastRepCount,
        slowRepCount: this.slowRepCount
      }
    }
  }

  resetSession() {
    this.repCount = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.unassessedCount = 0
    this.topMissCount = 0
    this.swingCount = 0
    this.armAsymCount = 0
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
    this.repPeakArmAsymDeg = 0
    this.repArmAsymHardFrames = 0
    this.repMinElbowAngle = 180
    this.repChinOverBarFrames = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.viewInvalidRepCount = 0
    this.barY = null
    this.barSamples = 0
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      elbowAngle: number | null
      torsoAngle: number | null
      elbowAsymDeg: number | null
      chinOverBar: boolean
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
      this.repPeakArmAsymDeg = 0
      this.repArmAsymHardFrames = 0
      this.repMinElbowAngle = 180
      this.repChinOverBarFrames = 0
    }

    this.frameCount += 1
    if (!input.isCountingPaused) this.repValidFrameCount += 1
    if (!input.isCountingPaused && input.frontViewBad) this.repFrontBadFrames += 1
    if (!input.isCountingPaused && typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle)) {
      this.repMinElbowAngle = Math.min(this.repMinElbowAngle, input.elbowAngle)
    }
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle) && input.torsoAngle > 0) {
      this.repPeakTorsoAngle = Math.max(this.repPeakTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= this.tuning.torsoSwingFailDeg) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.elbowAsymDeg === 'number' && Number.isFinite(input.elbowAsymDeg) && input.elbowAsymDeg > 0) {
      this.repPeakArmAsymDeg = Math.max(this.repPeakArmAsymDeg, input.elbowAsymDeg)
      if (input.elbowAsymDeg >= this.tuning.armAsymFailDeg) this.repArmAsymHardFrames += 1
    }
    if (!input.isCountingPaused && input.chinOverBar) this.repChinOverBarFrames += 1

    if (nextState === 's3') this.enteredTop = true

    if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
      const enoughFrames = this.frameCount >= REP_COUNT_MIN_FRAMES
      if (!enoughFrames) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Start from a dead hang, pull to the top, then return to full extension.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredTop = false
        this.currentState = nextState
        return
      }

      const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)
      const tempoTooFast = repDurationSec < this.tempo.repFastSec
      const tempoTooSlow = repDurationSec > this.tempo.repSlowSec
      if (tempoTooFast || tempoTooSlow) {
        if (tempoTooFast) this.fastRepCount += 1
        if (tempoTooSlow) this.slowRepCount += 1
        this.lastRepResult = null
        this.lastRepMessage = tempoTooFast ? 'Rep ignored: movement was too fast to count.' : 'Rep ignored: movement was too slow to count.'
        this.lastRepReasonCodes = [tempoTooFast ? 'REP_TOO_FAST_IGNORE' : 'REP_TOO_SLOW_IGNORE']
        this.lastRepReasonLabels = [tempoTooFast ? 'Movement was too fast to count' : 'Movement was too slow to count']
        this.lastRepCorrections = [
          tempoTooFast ? 'Slow down: pause briefly at the top, then lower under control.' : 'Keep control, but avoid long stalls; use a smoother continuous rhythm.'
        ]
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredTop = false
        this.currentState = nextState
        return
      }

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const frontBadRatio = this.frameCount > 0 ? this.repFrontBadFrames / this.frameCount : 0
      const assessable =
        this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN && frontBadRatio <= FRONT_VIEW_FAIL_RATIO

      this.repCount += 1
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (frontBadRatio > FRONT_VIEW_FAIL_RATIO) this.viewInvalidRepCount += 1

      if (!assessable) {
        this.unassessedCount += 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to unstable or incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting and keep both hands, head, shoulders, and hips visible.']
      } else {
        const torsoSwingFailed =
          this.repPeakTorsoAngle >= this.tuning.torsoSwingFailDeg && this.repTorsoHardFrames >= this.tuning.torsoSwingFailMinFrames
        const armAsymFailed =
          this.repPeakArmAsymDeg >= this.tuning.armAsymFailDeg && this.repArmAsymHardFrames >= this.tuning.armAsymFailMinFrames
        const topInsufficient =
          this.barSamples >= 10 ? this.repChinOverBarFrames < this.tuning.topHoldMinFrames : this.repMinElbowAngle > 105

        if (topInsufficient || torsoSwingFailed || armAsymFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []

          if (topInsufficient) {
            this.topMissCount += 1
            reasonCodes.push('TOP_POSITION_MISSED')
            reasonLabels.push('Top position not reached (chin did not clear bar)')
            corrections.push('Pull higher so your chin clears the bar, then lower under control.')
          }
          if (torsoSwingFailed) {
            this.swingCount += 1
            reasonCodes.push('TORSO_SWING_EXCESSIVE')
            reasonLabels.push('Excessive torso swing (kipping)')
            corrections.push('Brace your core and reduce swing; pause briefly before each pull.')
          }
          if (armAsymFailed) {
            this.armAsymCount += 1
            reasonCodes.push('ARM_ASYMMETRY')
            reasonLabels.push('Arms moved unevenly')
            corrections.push('Pull with both arms evenly; keep shoulders level and avoid twisting.')
          }

          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage = reasonLabels.length > 1 ? 'Rep failed: multiple form issues detected.' : 'Rep failed: form needs correction.'
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep the pull smooth and lower under control.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repPeakTorsoAngle = 0
      this.repTorsoHardFrames = 0
      this.repPeakArmAsymDeg = 0
      this.repArmAsymHardFrames = 0
      this.repMinElbowAngle = 180
      this.repChinOverBarFrames = 0
    }

    this.currentState = nextState
  }

  private detectState(input: { elbowAngle: number | null; chinOverBar: boolean }): 's1' | 's2' | 's3' | null {
    const elbowAngle = input.elbowAngle
    if (elbowAngle === null) return null
    const chinOverBar = input.chinOverBar

    if (this.currentState === 's1') {
      if (elbowAngle >= S1_EXIT_ELBOW_ANGLE) return 's1'
      if (chinOverBar || elbowAngle <= S3_ENTER_ELBOW_ANGLE) return 's3'
      return 's2'
    }
    if (this.currentState === 's3') {
      if (chinOverBar || elbowAngle <= S3_EXIT_ELBOW_ANGLE) return 's3'
      if (elbowAngle < S1_ENTER_ELBOW_ANGLE) return 's2'
      return 's1'
    }

    if (elbowAngle >= S1_ENTER_ELBOW_ANGLE) return 's1'
    if (chinOverBar || elbowAngle <= S3_ENTER_ELBOW_ANGLE) return 's3'
    return 's2'
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's3') return 'bottom'
    return this.enteredTop ? 'descent' : 'ascent'
  }

  private tryUpdateBarEstimate(map: NamedKeypoints, elbowAngle: number | null) {
    if (elbowAngle === null || elbowAngle < this.tuning.barCalibElbowMinDeg) return
    const lw = map.left_wrist
    const rw = map.right_wrist
    const ls = map.left_shoulder
    const rs = map.right_shoulder
    if (!lw || !rw || !ls || !rs) return
    if (Math.min(lw.score, rw.score, ls.score, rs.score) < 0.2) return
    const shoulderMidY = (ls.y + rs.y) / 2
    const wristMidY = (lw.y + rw.y) / 2
    if (!(wristMidY < shoulderMidY - 0.02)) return
    const sample = wristMidY
    if (this.barY === null) {
      this.barY = sample
      this.barSamples = 1
      return
    }
    const alpha = this.barSamples < 12 ? 0.25 : 0.08
    this.barY = this.barY * (1 - alpha) + sample * alpha
    this.barSamples = Math.min(60, this.barSamples + 1)
  }

  private chinOverBar(nose: MoveNetKeypoint | undefined, barY: number | null) {
    if (!nose || typeof barY !== 'number') return false
    if (nose.score < 0.25) return false
    return nose.y < barY - this.tuning.chinOverBarMargin
  }

  private trackingQuality(map: NamedKeypoints) {
    return this.avgScore(map, [
      'nose',
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip'
    ])
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

  private angleFromVerticalDeg(top?: { x: number; y: number; score: number } | null, bottom?: { x: number; y: number; score: number } | null) {
    if (!top || !bottom) return null
    const dx = top.x - bottom.x
    const dy = top.y - bottom.y
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
}
