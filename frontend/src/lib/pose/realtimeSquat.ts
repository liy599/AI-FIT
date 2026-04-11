import type { NormalizedLandmark } from './mediapipePose'

export type RealtimeFeedback = {
  phase: 'up' | 'descent' | 'bottom' | 'ascent'
  state: 's1' | 's2' | 's3' | null
  mode: 'beginner' | 'pro'
  kneeAngle: number | null
  hipAngle: number | null
  torsoAngle: number | null
  kneeVerticalAngle: number | null
  offsetAngle: number | null
  trackingQuality: number
  isCountingPaused: boolean
  warnings: string[]
  issues: Array<{ message: string; joints: number[] }>
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
    forwardLeanCount: number
    backwardLeanCount: number
    sideViewWarningCount: number
    avgRepDurationSec?: number | null
    fastRepCount?: number
    slowRepCount?: number
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
const REP_COUNT_MIN_FRAMES = 5
const REP_VALID_MIN_FRAMES = 8
const REP_VALID_RATIO_MIN = 0.45
const TRACKING_QUALITY_MIN = 0.28
const S1_ENTER_KNEE_ANGLE = 150
const S1_EXIT_KNEE_ANGLE = 145
const S3_ENTER_KNEE_ANGLE = 103
const S3_EXIT_KNEE_ANGLE = 111
const FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL = 35

export class RealtimeSquatAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private kneeOverToeRepCount = 0
  private forwardLeanRepCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
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
  private repValidFrameCount = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0

  analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
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

    const kneeAngle = this.angleDeg(midHip ?? hip, midKnee ?? knee, midAnkle ?? ankle)
    const hipAngle = this.angleDeg(midShoulder ?? shoulder, midHip ?? hip, midKnee ?? knee)
    const torsoAngle = this.angleFromVerticalDeg(midShoulder ?? shoulder, midHip ?? hip)
    const kneeVerticalAngle = this.lineToVerticalDeg(midHip ?? hip, midKnee ?? knee)
    const offsetAngle = this.offsetAngleDeg(nose, shoulder, otherShoulder)
    const trackingQuality = this.avgVisibility(landmarks, [idx.nose, idx.shoulder, idx.hip, idx.knee, idx.ankle, idx.footIndex])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const isCountingPaused = trackingQuality < TRACKING_QUALITY_MIN || kneeVerticalAngle === null || torsoAngle === null
    // Count state is based on motion phase transitions; quality gating is handled separately.
    const nextState = this.detectState(kneeAngle)
    let kneeOverToeRatio: number | null = null

    if (offsetAngle !== null && offsetAngle > 55) {
      warnings.push('Try to stay in a clear side view for more stable tracking.')
    }
    if (torsoAngle !== null && torsoAngle > FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL) {
      issues.push({ message: 'Excessive forward torso lean', joints: [11, 12, 23, 24] })
    }
    if (knee !== undefined && footIndex !== undefined && hip !== undefined && ankle !== undefined) {
      const dir = Math.sign((ankle.x - hip.x) || 1)
      kneeOverToeRatio = (knee.x - footIndex.x) * dir
      if (kneeOverToeRatio > KNEE_OVER_TOE_WARN_RATIO) {
        warnings.push('Knee is moving past toes. Push hips back first and keep shins more vertical.')
      }
      if (kneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO) {
        issues.push({ message: 'Knee is noticeably past the toes', joints: [idx.knee, idx.footIndex] })
      }
    }

    this.updateState(nextState, kneeOverToeRatio, torsoAngle, isCountingPaused)
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: kneeAngle !== null ? Math.round(kneeAngle) : null,
      hipAngle: hipAngle !== null ? Math.round(hipAngle) : null,
      torsoAngle: torsoAngle !== null ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: kneeVerticalAngle !== null ? Math.round(kneeVerticalAngle) : null,
      offsetAngle: offsetAngle !== null ? Math.round(offsetAngle) : null,
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
        depthInsufficientCount: 0,
        kneeOverToeCount: this.kneeOverToeRepCount,
        forwardLeanCount: this.forwardLeanRepCount,
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
    this.unassessedCount = 0
    this.kneeOverToeRepCount = 0
    this.forwardLeanRepCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.enteredBottom = false
    this.frameCount = 0
    this.repPeakKneeOverToeRatio = 0
    this.repKneeOverToeHardFrames = 0
    this.repPeakTorsoLeanAngle = 0
    this.repForwardLeanHardFrames = 0
    this.repValidFrameCount = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
  }

  private updateState(nextState: 's1' | 's2' | 's3' | null, kneeOverToeRatio: number | null, torsoAngle: number | null, isCountingPaused: boolean) {
    if (nextState === null) return
    const startedRep = this.currentState === 's1' && nextState === 's2'
    if (startedRep) {
      // Start a fresh per-rep window when descent begins from standing.
      this.frameCount = 0
      this.repPeakKneeOverToeRatio = 0
      this.repKneeOverToeHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repValidFrameCount = 0
    }
    this.frameCount += 1
    if (!isCountingPaused) this.repValidFrameCount += 1
    if (!isCountingPaused && typeof kneeOverToeRatio === 'number' && Number.isFinite(kneeOverToeRatio) && kneeOverToeRatio > 0) {
      this.repPeakKneeOverToeRatio = Math.max(this.repPeakKneeOverToeRatio, kneeOverToeRatio)
      if (kneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO) this.repKneeOverToeHardFrames += 1
    }
    if (!isCountingPaused && typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) && torsoAngle > 0) {
      this.repPeakTorsoLeanAngle = Math.max(this.repPeakTorsoLeanAngle, torsoAngle)
      if (torsoAngle >= FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL) this.repForwardLeanHardFrames += 1
    }
    if (nextState === 's3') this.enteredBottom = true
    if (this.currentState !== 's1' && nextState === 's1' && this.enteredBottom) {
      const enoughForCounting = this.frameCount >= REP_COUNT_MIN_FRAMES
      if (!enoughForCounting) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Use a full range and finish the standing phase before the next rep.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredBottom = false
        this.repPeakKneeOverToeRatio = 0
        this.repKneeOverToeHardFrames = 0
        this.repPeakTorsoLeanAngle = 0
        this.repForwardLeanHardFrames = 0
        this.repValidFrameCount = 0
        this.currentState = nextState
        return
      }

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const hasReliableTracking = this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN
      this.repCount += 1
      const repDurationSec = Math.max(0.1, this.frameCount / ASSUMED_ANALYZER_FPS)
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < REP_FAST_SEC) this.fastRepCount += 1
      if (repDurationSec > REP_SLOW_SEC) this.slowRepCount += 1
      if (hasReliableTracking) {
        const kneeOverToeFailed =
          this.repPeakKneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO && this.repKneeOverToeHardFrames >= KNEE_OVER_TOE_FAIL_MIN_FRAMES
        const forwardLeanFailed =
          this.repPeakTorsoLeanAngle >= FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL &&
          this.repForwardLeanHardFrames >= FORWARD_LEAN_FAIL_MIN_FRAMES

        if (kneeOverToeFailed || forwardLeanFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []
          if (kneeOverToeFailed) {
            this.kneeOverToeRepCount += 1
            reasonCodes.push('KNEE_OVER_TOE_EXCESSIVE')
            reasonLabels.push('Knees drifted too far past toes')
            corrections.push('Push hips back first and keep shins more vertical.')
          }
          if (forwardLeanFailed) {
            this.forwardLeanRepCount += 1
            reasonCodes.push('FORWARD_LEAN_EXCESSIVE')
            reasonLabels.push('Torso leaned too far forward')
            corrections.push('Keep chest up and brace your core as you descend.')
          }
          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage =
            reasonLabels.length > 1
              ? 'Rep failed: knees drifted forward and torso leaned too far.'
              : reasonLabels[0] === 'Torso leaned too far forward'
                ? 'Rep failed: torso leaned too far forward.'
                : 'Rep failed: knees drifted too far past toes.'
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep the tempo steady.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      } else {
        this.unassessedCount += 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting and keep your full body in frame before continuing.']
      }
      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredBottom = false
      this.repPeakKneeOverToeRatio = 0
      this.repKneeOverToeHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repValidFrameCount = 0
    }
    this.currentState = nextState
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
