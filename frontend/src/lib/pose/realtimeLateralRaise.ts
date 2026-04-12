import type { NormalizedLandmark } from './mediapipePose'
import type { RealtimeFeedback } from './realtimeSquat'

const ASSUMED_ANALYZER_FPS = 24
const REP_COUNT_MIN_FRAMES = 8
const REP_VALID_MIN_FRAMES = 8
const REP_VALID_RATIO_MIN = 0.45
const TRACKING_QUALITY_MIN = 0.32

const S1_ENTER_RAISE_DEG = 20
const S1_EXIT_RAISE_DEG = 26
const S3_ENTER_RAISE_DEG = 78
const S3_EXIT_RAISE_DEG = 70

const SYMMETRY_WARN_DEG = 22
const SYMMETRY_FAIL_DEG = 32
const SYMMETRY_FAIL_MIN_FRAMES = 3
const TORSO_SWAY_WARN_DEG = 20
const TORSO_SWAY_FAIL_DEG = 30
const TORSO_SWAY_FAIL_MIN_FRAMES = 3
const ELBOW_CURL_WARN_DEG = 125
const ELBOW_CURL_FAIL_DEG = 112
const ELBOW_CURL_FAIL_MIN_FRAMES = 3

const REP_FAST_SEC = 1.0
const REP_SLOW_SEC = 6.0
const REP_IGNORE_FAST_SEC = 0.6

export class RealtimeLateralRaiseAnalyzer {
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
  private repValidFrameCount = 0
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
  private smoothLeftRaise: number | null = null
  private smoothRightRaise: number | null = null

  analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
    const lShoulder = landmarks[11]
    const rShoulder = landmarks[12]
    const lElbow = landmarks[13]
    const rElbow = landmarks[14]
    const lWrist = landmarks[15]
    const rWrist = landmarks[16]
    const lHip = landmarks[23]
    const rHip = landmarks[24]

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)

    const leftRaiseRaw = this.raiseDegFromTorso(lShoulder, lElbow, lWrist, lHip)
    const rightRaiseRaw = this.raiseDegFromTorso(rShoulder, rElbow, rWrist, rHip)
    this.smoothLeftRaise = this.emaAngle(this.smoothLeftRaise, leftRaiseRaw, 0.35)
    this.smoothRightRaise = this.emaAngle(this.smoothRightRaise, rightRaiseRaw, 0.35)
    const leftRaise = this.smoothLeftRaise
    const rightRaise = this.smoothRightRaise
    const armRaise = this.avg([leftRaise, rightRaise])

    const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist)
    const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist)
    const elbowAngle = this.avg([leftElbowAngle, rightElbowAngle])

    const symmetryGap = leftRaise !== null && rightRaise !== null ? Math.abs(leftRaise - rightRaise) : null
    const torsoAngle = this.angleFromVerticalDeg(midShoulder, midHip)
    const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder)
    const trackingQuality = this.avgVisibility(landmarks, [11, 12, 13, 14, 15, 16, 23, 24])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const isCountingPaused = trackingQuality < TRACKING_QUALITY_MIN || armRaise === null
    const nextState = isCountingPaused ? this.currentState : this.detectState({ armRaise, leftRaise, rightRaise })

    if (trackingQuality < 0.45) {
      warnings.push('Low keypoint confidence. Keep your full upper body in frame with better lighting.')
    }
    if (torsoAngle !== null && torsoAngle > TORSO_SWAY_WARN_DEG) {
      issues.push({ message: 'Torso sway detected', joints: [11, 12, 23, 24] })
    }
    if (symmetryGap !== null && symmetryGap > SYMMETRY_WARN_DEG) {
      issues.push({ message: 'Raise both arms evenly to improve symmetry.', joints: [11, 12, 13, 14] })
    }
    if (elbowAngle !== null && elbowAngle < ELBOW_CURL_WARN_DEG) {
      warnings.push('Keep elbows softly fixed. Avoid turning this into an elbow curl.')
    }
    if (frontAlignment !== null && frontAlignment > 20) {
      warnings.push('Face the camera more directly for better left-right comparison.')
    }

    this.updateState(nextState, {
      isCountingPaused,
      armRaise,
      torsoAngle,
      symmetryGap,
      elbowAngle
    })
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: armRaise ? Math.round(armRaise) : null,
      hipAngle: elbowAngle ? Math.round(elbowAngle) : null,
      torsoAngle: torsoAngle ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: symmetryGap ? Math.round(symmetryGap) : null,
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
    this.repValidFrameCount = 0
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
    this.smoothLeftRaise = null
    this.smoothRightRaise = null
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      armRaise: number | null
      torsoAngle: number | null
      symmetryGap: number | null
      elbowAngle: number | null
    }
  ) {
    if (nextState === null) return
    const startedRep = this.currentState === 's1' && nextState === 's2'
    if (startedRep) {
      this.frameCount = 0
      this.repValidFrameCount = 0
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
    if (!input.isCountingPaused && typeof input.armRaise === 'number' && Number.isFinite(input.armRaise)) {
      this.repMaxRaise = Math.max(this.repMaxRaise, input.armRaise)
    }
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle) && input.torsoAngle > 0) {
      this.repPeakTorsoAngle = Math.max(this.repPeakTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= TORSO_SWAY_FAIL_DEG) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.symmetryGap === 'number' && Number.isFinite(input.symmetryGap) && input.symmetryGap > 0) {
      this.repPeakSymmetryGap = Math.max(this.repPeakSymmetryGap, input.symmetryGap)
      if (input.symmetryGap >= SYMMETRY_FAIL_DEG) this.repSymmetryHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle) && input.elbowAngle > 0) {
      this.repMinElbowAngle = Math.min(this.repMinElbowAngle, input.elbowAngle)
      if (input.elbowAngle <= ELBOW_CURL_FAIL_DEG) this.repElbowHardFrames += 1
    }
    if (nextState === 's3') this.enteredTop = true
    if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
      const enoughForCounting = this.frameCount >= REP_COUNT_MIN_FRAMES
      if (!enoughForCounting) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Raise to about shoulder height, pause briefly, then lower under control.']
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
        this.lastRepCorrections = ['Slow down: lift up under control, brief pause, then lower slowly.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredTop = false
        this.currentState = nextState
        return
      }

      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < REP_FAST_SEC) this.fastRepCount += 1
      if (repDurationSec > REP_SLOW_SEC) this.slowRepCount += 1

      if (!hasReliableTracking) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting and keep shoulders, elbows, wrists, and torso visible.']
      } else {
        const topInsufficient = this.repMaxRaise < S3_EXIT_RAISE_DEG
        const torsoSwayFailed = this.repPeakTorsoAngle >= TORSO_SWAY_FAIL_DEG && this.repTorsoHardFrames >= TORSO_SWAY_FAIL_MIN_FRAMES
        const symmetryFailed = this.repPeakSymmetryGap >= SYMMETRY_FAIL_DEG && this.repSymmetryHardFrames >= SYMMETRY_FAIL_MIN_FRAMES
        const elbowCurlFailed = this.repMinElbowAngle <= ELBOW_CURL_FAIL_DEG && this.repElbowHardFrames >= ELBOW_CURL_FAIL_MIN_FRAMES
        const tempoTooFast = repDurationSec < REP_FAST_SEC
        const tempoTooSlow = repDurationSec > REP_SLOW_SEC

        if (topInsufficient || torsoSwayFailed || symmetryFailed || elbowCurlFailed || tempoTooFast || tempoTooSlow) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []

          if (topInsufficient) {
            reasonCodes.push('TOP_RANGE_INSUFFICIENT')
            reasonLabels.push('Arms did not reach shoulder height')
            corrections.push('Lift to about shoulder height, then lower under control.')
          }
          if (torsoSwayFailed) {
            reasonCodes.push('TORSO_SWAY')
            reasonLabels.push('Torso sway detected')
            corrections.push('Lower the load and keep your torso stable without swinging.')
          }
          if (symmetryFailed) {
            reasonCodes.push('ASYMMETRY')
            reasonLabels.push('Arms were not raised evenly')
            corrections.push('Raise both arms together and match left-right height at the top.')
          }
          if (elbowCurlFailed) {
            reasonCodes.push('ELBOW_CURL')
            reasonLabels.push('Elbows bent too much (turned into a curl)')
            corrections.push('Keep a soft elbow bend and move from the shoulder joint.')
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
          this.lastRepMessage = 'Rep completed. Keep shoulders down and movement smooth.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
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
      if (armRaise <= S1_EXIT_RAISE_DEG) return 's1'
      if (bothHigh && armRaise >= S3_ENTER_RAISE_DEG) return 's3'
      return 's2'
    }
    if (this.currentState === 's3') {
      if (bothHigh && armRaise >= S3_EXIT_RAISE_DEG) return 's3'
      if (armRaise <= S1_ENTER_RAISE_DEG) return 's1'
      return 's2'
    }
    if (armRaise <= S1_ENTER_RAISE_DEG) return 's1'
    if (bothHigh && armRaise >= S3_ENTER_RAISE_DEG) return 's3'
    return 's2'
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's2') return 'ascent'
    if (state === 's3') return 'bottom'
    return 'up'
  }

  private raiseDegFromTorso(shoulder?: NormalizedLandmark | null, elbow?: NormalizedLandmark | null, wrist?: NormalizedLandmark | null, hip?: NormalizedLandmark | null) {
    if (!shoulder || !hip) return null
    const pivot = this.bestPoint(elbow, wrist)
    if (!pivot) return null
    const vArm = { x: pivot.x - shoulder.x, y: pivot.y - shoulder.y }
    const vTorso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y }
    const armLen = Math.hypot(vArm.x, vArm.y)
    const torsoLen = Math.hypot(vTorso.x, vTorso.y)
    if (!armLen || !torsoLen) return null
    const dot = vArm.x * vTorso.x + vArm.y * vTorso.y
    const cos = Math.min(1, Math.max(-1, dot / (armLen * torsoLen)))
    return (Math.acos(cos) * 180) / Math.PI
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

  private frontAlignmentDeg(leftShoulder?: NormalizedLandmark | null, rightShoulder?: NormalizedLandmark | null): number | null {
    if (!leftShoulder || !rightShoulder) return null
    const dx = Math.abs(rightShoulder.x - leftShoulder.x)
    const dy = Math.abs(rightShoulder.y - leftShoulder.y) + 1e-6
    return (Math.atan2(dy, dx + 1e-6) * 180) / Math.PI
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

  private avgVisibility(landmarks: NormalizedLandmark[], indices: number[]) {
    let total = 0
    for (const idx of indices) total += this.visibilityOf(landmarks[idx])
    return indices.length > 0 ? total / indices.length : 0
  }

  private visibilityOf(point: NormalizedLandmark | undefined) {
    if (!point) return 0
    const v = typeof point.visibility === 'number' ? point.visibility : 0.5
    if (!Number.isFinite(v)) return 0
    return Math.max(0, Math.min(1, v))
  }

  private avg(values: Array<number | null>) {
    const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (valid.length === 0) return null
    return valid.reduce((sum, v) => sum + v, 0) / valid.length
  }

  private bestPoint(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null) {
    const av = typeof a?.visibility === 'number' ? a.visibility : 0
    const bv = typeof b?.visibility === 'number' ? b.visibility : 0
    if (a && av >= 0.2) return a
    if (b && bv >= 0.2) return b
    return null
  }

  private emaAngle(prev: number | null, next: number | null, alpha: number) {
    if (next === null) return prev
    if (prev === null) return next
    return prev + (next - prev) * alpha
  }
}

