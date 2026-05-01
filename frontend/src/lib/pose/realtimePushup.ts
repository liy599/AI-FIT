import type { RealtimeFeedback } from './realtimeSquat'
import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'

const ASSUMED_ANALYZER_FPS = 24
const REP_FAST_SEC = 0.85
const REP_SLOW_SEC = 3.2
const REP_ARM_MIN_TOP_FRAMES = 6
const REP_COUNT_MIN_FRAMES = 7
const REP_COUNT_MIN_ACTIVE_FRAMES = 5
const REP_COUNT_MIN_BOTTOM_FRAMES = 3
const REP_COUNT_MIN_ELBOW_ANGLE = 125
const REP_VALID_MIN_FRAMES = 2
const REP_VALID_RATIO_MIN = 0.2
const TRACKING_QUALITY_MIN_FOR_COUNT = 0.22
const TRACKING_QUALITY_MIN_FOR_ASSESS = 0.3

const S1_ENTER_ELBOW_ANGLE = 150
const S1_EXIT_ELBOW_ANGLE = 142
const S3_ENTER_ELBOW_ANGLE = 130
const S3_EXIT_ELBOW_ANGLE = 138

const DEPTH_REQUIRED_ELBOW_ANGLE = 130
const DEPTH_GOOD_MIN_FRAMES = 1

const SIDE_VIEW_WARN_DEG = 55
const SIDE_VIEW_ASSESS_DEG = 85
const SIDE_VIEW_HARD_DEG = 65
const SIDE_VIEW_HARD_MIN_FRAMES = 3

const BODY_LINE_FAIL_ANGLE = 145
const BODY_LINE_FAIL_MIN_FRAMES = 10
const HIP_SAG_HARD_DEG = 28
const HIP_SAG_HARD_MIN_FRAMES = 10
const HIP_PIKE_HARD_DEG = 28
const HIP_PIKE_HARD_MIN_FRAMES = 10

export class RealtimePushupAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private depthInsufficientCount = 0
  private forwardLeanCount = 0
  private backwardLeanCount = 0
  private sideViewWarningCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private enteredBottom = false
  private frameCount = 0
  private stableTopFrames = 0
  private repArmed = false
  private repActive = false
  private repActiveFrames = 0
  private repMinElbowAngle: number | null = null
  private repDepthGoodFrames = 0
  private repReliableFrameCount = 0
  private repBottomFrames = 0
  private repSideViewHardFrames = 0
  private repBodyLineHardFrames = 0
  private repHipSagHardFrames = 0
  private repHipPikeHardFrames = 0
  private repLowConfidenceFrames = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0

  analyzeNative(keypoints: MoveNetKeypoint[]): RealtimeFeedback {
    const map = this.byName(keypoints)
    const side = this.chooseSide(map)
    const shoulder = map[side === 'right' ? 'right_shoulder' : 'left_shoulder']
    const elbow = map[side === 'right' ? 'right_elbow' : 'left_elbow']
    const wrist = map[side === 'right' ? 'right_wrist' : 'left_wrist']
    const hip = map[side === 'right' ? 'right_hip' : 'left_hip']
    const knee = map[side === 'right' ? 'right_knee' : 'left_knee']
    const ankle = map[side === 'right' ? 'right_ankle' : 'left_ankle']
    const otherShoulder = map[side === 'right' ? 'left_shoulder' : 'right_shoulder']

    const elbowAngle = this.angleDeg(shoulder, elbow, wrist)
    const torsoTiltSigned = this.signedAngleFromHorizontalDeg(shoulder, hip)
    const torsoAngle = torsoTiltSigned !== null ? Math.round(Math.abs(torsoTiltSigned)) : null
    const bodyLineAngle = this.angleDeg(shoulder, hip, ankle)
    const sideAlignment = this.sideAlignmentDeg(shoulder, otherShoulder)
    const trackingQuality = this.avgScore(map, [
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'left_ankle',
      'right_ankle'
    ])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []
    const isCountingPaused = trackingQuality < TRACKING_QUALITY_MIN_FOR_COUNT || elbowAngle === null
    const nextState = isCountingPaused || elbowAngle === null ? this.currentState : this.detectState(elbowAngle)

    if (trackingQuality < TRACKING_QUALITY_MIN_FOR_ASSESS) {
      warnings.push('Low keypoint confidence. Keep your full body in frame with better lighting.')
    }
    if (sideAlignment !== null && sideAlignment > SIDE_VIEW_WARN_DEG) {
      warnings.push('Side view unstable. Rotate to a clearer side view for more stable push-up tracking.')
    }
    const hipsSaggingNow = torsoTiltSigned !== null && torsoTiltSigned > HIP_SAG_HARD_DEG
    const bodyLineBadNow = bodyLineAngle !== null && bodyLineAngle < BODY_LINE_FAIL_ANGLE
    if (hipsSaggingNow || bodyLineBadNow) {
      issues.push({
        message: 'Hips sagging detected. Keep shoulders, hips, and ankles aligned in one line.',
        joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle']
      })
    } else if (bodyLineAngle !== null && bodyLineAngle < 168) {
      warnings.push('Body line not stable. Keep shoulders, hips, and ankles aligned in one line.')
    }
    if (torsoTiltSigned !== null && torsoTiltSigned < -HIP_PIKE_HARD_DEG) {
      warnings.push('Hips too high detected. Lower hips slightly to keep a stable plank line during reps.')
    }
    if (nextState === 's3' && elbowAngle !== null && elbowAngle > DEPTH_REQUIRED_ELBOW_ANGLE) {
      warnings.push('Depth insufficient. Bend elbows more at the bottom position.')
    }

    this.updateState({
      nextState,
      isCountingPaused,
      elbowAngle: elbowAngle ?? null,
      bodyLineAngle,
      torsoTiltSigned,
      sideAlignment,
      trackingQuality
    })
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: elbowAngle !== null ? Math.round(elbowAngle) : null,
      hipAngle: bodyLineAngle ? Math.round(bodyLineAngle) : null,
      torsoAngle,
      kneeVerticalAngle: null,
      offsetAngle: sideAlignment ? Math.round(sideAlignment) : null,
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
        accuracyPct: this.repCount > 0 ? Math.round((this.correctCount / this.repCount) * 100) : 0,
        unassessedReps: this.unassessedCount,
        depthInsufficientCount: this.depthInsufficientCount,
        kneeOverToeCount: 0,
        forwardLeanCount: this.forwardLeanCount,
        backwardLeanCount: this.backwardLeanCount,
        sideViewWarningCount: this.sideViewWarningCount,
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
    this.depthInsufficientCount = 0
    this.forwardLeanCount = 0
    this.backwardLeanCount = 0
    this.sideViewWarningCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.enteredBottom = false
    this.frameCount = 0
    this.stableTopFrames = 0
    this.repArmed = false
    this.repActive = false
    this.repActiveFrames = 0
    this.repMinElbowAngle = null
    this.repDepthGoodFrames = 0
    this.repReliableFrameCount = 0
    this.repBottomFrames = 0
    this.repSideViewHardFrames = 0
    this.repBodyLineHardFrames = 0
    this.repHipSagHardFrames = 0
    this.repHipPikeHardFrames = 0
    this.repLowConfidenceFrames = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
  }

  private updateState(input: {
    nextState: 's1' | 's2' | 's3' | null
    isCountingPaused: boolean
    elbowAngle: number | null
    bodyLineAngle: number | null
    torsoTiltSigned: number | null
    sideAlignment: number | null
    trackingQuality: number
  }) {
    const nextState = input.nextState
    if (nextState === null) return
    const isTopStable =
      !this.repActive &&
      !input.isCountingPaused &&
      nextState === 's1' &&
      typeof input.elbowAngle === 'number' &&
      Number.isFinite(input.elbowAngle) &&
      input.elbowAngle >= S1_ENTER_ELBOW_ANGLE

    if (isTopStable) {
      this.stableTopFrames += 1
    } else if (!this.repActive) {
      this.stableTopFrames = 0
    }
    if (!this.repActive && this.stableTopFrames >= REP_ARM_MIN_TOP_FRAMES) {
      this.repArmed = true
    }

    if (!this.repActive) {
      if (this.repArmed && this.currentState === 's1' && nextState !== 's1') {
        this.repActive = true
        this.frameCount = 0
        this.repActiveFrames = 0
        this.enteredBottom = false
        this.repMinElbowAngle = null
        this.repDepthGoodFrames = 0
        this.repReliableFrameCount = 0
        this.repBottomFrames = 0
        this.repSideViewHardFrames = 0
        this.repBodyLineHardFrames = 0
        this.repHipSagHardFrames = 0
        this.repHipPikeHardFrames = 0
        this.repLowConfidenceFrames = 0
      } else {
        this.currentState = nextState
        return
      }
    }

    this.frameCount += 1

    if (!input.isCountingPaused) {
      if (nextState !== 's1') this.repActiveFrames += 1
      if (typeof input.elbowAngle === 'number' && Number.isFinite(input.elbowAngle)) {
        this.repMinElbowAngle = this.repMinElbowAngle === null ? input.elbowAngle : Math.min(this.repMinElbowAngle, input.elbowAngle)
        if (input.elbowAngle <= DEPTH_REQUIRED_ELBOW_ANGLE) this.repDepthGoodFrames += 1
      }
      const isReliable =
        input.trackingQuality >= TRACKING_QUALITY_MIN_FOR_ASSESS && (input.sideAlignment === null || input.sideAlignment <= SIDE_VIEW_ASSESS_DEG)
      if (isReliable) this.repReliableFrameCount += 1
      if (input.sideAlignment !== null && input.sideAlignment > SIDE_VIEW_HARD_DEG) this.repSideViewHardFrames += 1
      if (input.trackingQuality < TRACKING_QUALITY_MIN_FOR_ASSESS) this.repLowConfidenceFrames += 1
      if (input.bodyLineAngle !== null && input.bodyLineAngle < BODY_LINE_FAIL_ANGLE) this.repBodyLineHardFrames += 1
      if (input.torsoTiltSigned !== null && input.torsoTiltSigned > HIP_SAG_HARD_DEG) this.repHipSagHardFrames += 1
      if (input.torsoTiltSigned !== null && input.torsoTiltSigned < -HIP_PIKE_HARD_DEG) this.repHipPikeHardFrames += 1
    }

    if (nextState === 's3') {
      this.repBottomFrames += 1
      if (this.repBottomFrames >= REP_COUNT_MIN_BOTTOM_FRAMES) this.enteredBottom = true
    } else {
      this.repBottomFrames = 0
    }
    if (this.currentState !== 's1' && nextState === 's1') {
      if (!this.enteredBottom) {
        this.repActive = false
        this.repArmed = false
        this.stableTopFrames = 0
        this.frameCount = 0
        this.repActiveFrames = 0
        this.repMinElbowAngle = null
        this.repDepthGoodFrames = 0
        this.repReliableFrameCount = 0
        this.repBottomFrames = 0
        this.repSideViewHardFrames = 0
        this.repBodyLineHardFrames = 0
        this.repHipSagHardFrames = 0
        this.repHipPikeHardFrames = 0
        this.repLowConfidenceFrames = 0
        this.currentState = nextState
        return
      }
      const enoughForCounting = this.frameCount >= REP_COUNT_MIN_FRAMES
      if (!enoughForCounting) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Use a full range and finish the top position before the next rep.']
        this.lastRepFrameCount = this.frameCount
        this.repActive = false
        this.repArmed = false
        this.stableTopFrames = 0
        this.frameCount = 0
        this.repActiveFrames = 0
        this.enteredBottom = false
        this.repMinElbowAngle = null
        this.repDepthGoodFrames = 0
        this.repReliableFrameCount = 0
        this.repBottomFrames = 0
        this.repSideViewHardFrames = 0
        this.repBodyLineHardFrames = 0
        this.repHipSagHardFrames = 0
        this.repHipPikeHardFrames = 0
        this.repLowConfidenceFrames = 0
        this.currentState = nextState
        return
      }

      if (this.repActiveFrames < REP_COUNT_MIN_ACTIVE_FRAMES) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too small to count.'
        this.lastRepReasonCodes = ['MOVE_TOO_SMALL']
        this.lastRepReasonLabels = ['Movement was too small to count']
        this.lastRepCorrections = ['Lower further and complete a full press to lockout before the next rep.']
        this.lastRepFrameCount = this.frameCount
        this.repActive = false
        this.repArmed = false
        this.stableTopFrames = 0
        this.frameCount = 0
        this.repActiveFrames = 0
        this.enteredBottom = false
        this.repMinElbowAngle = null
        this.repDepthGoodFrames = 0
        this.repReliableFrameCount = 0
        this.repBottomFrames = 0
        this.repSideViewHardFrames = 0
        this.repBodyLineHardFrames = 0
        this.repHipSagHardFrames = 0
        this.repHipPikeHardFrames = 0
        this.repLowConfidenceFrames = 0
        this.currentState = nextState
        return
      }

      const reachedEnoughRange =
        this.repMinElbowAngle !== null && Number.isFinite(this.repMinElbowAngle) && this.repMinElbowAngle <= REP_COUNT_MIN_ELBOW_ANGLE
      if (!reachedEnoughRange) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: range of motion was too small to count.'
        this.lastRepReasonCodes = ['RANGE_TOO_SMALL']
        this.lastRepReasonLabels = ['Range of motion was too small']
        this.lastRepCorrections = ['Lower further to bend elbows more, then press back up to complete the rep.']
        this.lastRepFrameCount = this.frameCount
        this.repActive = false
        this.repArmed = false
        this.stableTopFrames = 0
        this.frameCount = 0
        this.repActiveFrames = 0
        this.enteredBottom = false
        this.repMinElbowAngle = null
        this.repDepthGoodFrames = 0
        this.repReliableFrameCount = 0
        this.repBottomFrames = 0
        this.repSideViewHardFrames = 0
        this.repBodyLineHardFrames = 0
        this.repHipSagHardFrames = 0
        this.repHipPikeHardFrames = 0
        this.repLowConfidenceFrames = 0
        this.currentState = nextState
        return
      }

      const validRatio = this.frameCount > 0 ? this.repReliableFrameCount / this.frameCount : 0
      const hasReliableTracking = this.repReliableFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN
      this.repCount += 1
      const repDurationSec = Math.max(0.1, this.frameCount / ASSUMED_ANALYZER_FPS)
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < REP_FAST_SEC) this.fastRepCount += 1
      if (repDurationSec > REP_SLOW_SEC) this.slowRepCount += 1

      if (this.repSideViewHardFrames >= SIDE_VIEW_HARD_MIN_FRAMES) this.sideViewWarningCount += 1

      if (hasReliableTracking) {
        const depthOk = this.repDepthGoodFrames >= DEPTH_GOOD_MIN_FRAMES
        const hipsSagFailed = this.repHipSagHardFrames >= HIP_SAG_HARD_MIN_FRAMES
        const hipsPikeFailed = this.repHipPikeHardFrames >= HIP_PIKE_HARD_MIN_FRAMES
        const bodyLineFailed = this.repBodyLineHardFrames >= BODY_LINE_FAIL_MIN_FRAMES

        if (!depthOk || hipsSagFailed || hipsPikeFailed || bodyLineFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []
          if (!depthOk) {
            this.depthInsufficientCount += 1
            reasonCodes.push('DEPTH_INSUFFICIENT')
            reasonLabels.push('Depth was insufficient')
            corrections.push('Lower further until elbows bend clearly, then press back up under control.')
          }
          if (hipsSagFailed || bodyLineFailed) {
            this.forwardLeanCount += 1
            reasonCodes.push('HIPS_SAGGING')
            reasonLabels.push('Hips dropped during the rep')
            corrections.push('Brace your core and keep shoulders, hips, and ankles in one line.')
          }
          if (hipsPikeFailed) {
            this.backwardLeanCount += 1
            reasonCodes.push('HIPS_TOO_HIGH')
            reasonLabels.push('Hips were too high during the rep')
            corrections.push('Lower hips slightly to maintain a stable plank line.')
          }
          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          this.lastRepMessage =
            reasonLabels.length > 1 ? 'Rep failed: depth and alignment were inconsistent.' : `Rep failed: ${reasonLabels[0] ?? 'form issue'}.`
        } else {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Rep completed. Keep your core braced and tempo steady.'
          this.lastRepReasonCodes = []
          this.lastRepReasonLabels = []
          this.lastRepCorrections = []
        }
      } else {
        this.unassessedCount += 1
        this.lastRepResult = null
        const reasonCodes: string[] = []
        const reasonLabels: string[] = []
        const corrections: string[] = []
        if (this.repLowConfidenceFrames >= 1) {
          reasonCodes.push('LOW_CONFIDENCE')
          reasonLabels.push('Keypoint confidence was too low')
          corrections.push('Improve lighting and keep your full body visible before continuing.')
        }
        if (this.repSideViewHardFrames >= SIDE_VIEW_HARD_MIN_FRAMES) {
          reasonCodes.push('NOT_SIDE_VIEW')
          reasonLabels.push('Camera was not in a stable side view')
          corrections.push('Rotate to a clearer side view so depth and body line can be evaluated.')
        }
        if (reasonCodes.length === 0) {
          reasonCodes.push('KEYPOINTS_INCOMPLETE')
          reasonLabels.push('Keypoints were incomplete')
          corrections.push('Keep shoulders, hips, knees, and ankles in frame with steady lighting.')
        }
        this.lastRepReasonCodes = reasonCodes
        this.lastRepReasonLabels = reasonLabels
        this.lastRepCorrections = corrections
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to unstable keypoints.'
      }

      this.lastRepFrameCount = this.frameCount
      this.repActive = false
      this.repArmed = false
      this.stableTopFrames = 0
      this.frameCount = 0
      this.repActiveFrames = 0
      this.enteredBottom = false
      this.repMinElbowAngle = null
      this.repDepthGoodFrames = 0
      this.repReliableFrameCount = 0
      this.repBottomFrames = 0
      this.repSideViewHardFrames = 0
      this.repBodyLineHardFrames = 0
      this.repHipSagHardFrames = 0
      this.repHipPikeHardFrames = 0
      this.repLowConfidenceFrames = 0
    }
    this.currentState = nextState
  }

  private detectState(elbowAngle: number): 's1' | 's2' | 's3' {
    if (this.currentState === 's1') {
      if (elbowAngle >= S1_EXIT_ELBOW_ANGLE) return 's1'
      if (elbowAngle > S3_ENTER_ELBOW_ANGLE) return 's2'
      return 's3'
    }
    if (this.currentState === 's3') {
      if (elbowAngle <= S3_EXIT_ELBOW_ANGLE) return 's3'
      if (elbowAngle < S1_ENTER_ELBOW_ANGLE) return 's2'
      return 's1'
    }
    if (elbowAngle >= S1_ENTER_ELBOW_ANGLE) return 's1'
    if (elbowAngle > S3_ENTER_ELBOW_ANGLE) return 's2'
    return 's3'
  }

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's2') return 'descent'
    if (state === 's3') return 'bottom'
    return 'up'
  }

  private chooseSide(map: Partial<Record<MoveNetName, MoveNetKeypoint>>): 'left' | 'right' {
    const left = this.avgScore(map, ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_knee', 'left_ankle'])
    const right = this.avgScore(map, ['right_shoulder', 'right_elbow', 'right_wrist', 'right_hip', 'right_knee', 'right_ankle'])
    return right > left ? 'right' : 'left'
  }

  private angleDeg(a?: MoveNetKeypoint | null, b?: MoveNetKeypoint | null, c?: MoveNetKeypoint | null): number | null {
    if (!a || !b || !c) return null
    if (Math.min(this.score(a), this.score(b), this.score(c)) < 0.15) return null
    const ba = { x: a.x - b.x, y: a.y - b.y }
    const bc = { x: c.x - b.x, y: c.y - b.y }
    const dot = ba.x * bc.x + ba.y * bc.y
    const mag = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dot / mag))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleFromHorizontalDeg(a?: MoveNetKeypoint | null, b?: MoveNetKeypoint | null): number | null {
    if (!a || !b) return null
    if (Math.min(this.score(a), this.score(b)) < 0.15) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    return Math.abs((Math.asin(dy / mag) * 180) / Math.PI)
  }

  private signedAngleFromHorizontalDeg(a?: MoveNetKeypoint | null, b?: MoveNetKeypoint | null): number | null {
    if (!a || !b) return null
    if (Math.min(this.score(a), this.score(b)) < 0.15) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    return (Math.asin(dy / mag) * 180) / Math.PI
  }

  private sideAlignmentDeg(shoulder?: MoveNetKeypoint | null, otherShoulder?: MoveNetKeypoint | null): number | null {
    if (!shoulder || !otherShoulder) return null
    if (Math.min(this.score(shoulder), this.score(otherShoulder)) < 0.15) return null
    const shoulderSpanX = Math.abs(shoulder.x - otherShoulder.x)
    const shoulderSpanY = Math.abs(shoulder.y - otherShoulder.y) + 1e-6
    return (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
  }

  private byName(keypoints: MoveNetKeypoint[]) {
    const map: Partial<Record<MoveNetName, MoveNetKeypoint>> = {}
    for (const p of keypoints) map[p.name] = p
    return map
  }

  private avgScore(map: Partial<Record<MoveNetName, MoveNetKeypoint>>, names: MoveNetName[]) {
    let total = 0
    let count = 0
    for (const name of names) {
      const p = map[name]
      if (!p) continue
      total += this.score(p)
      count += 1
    }
    return count > 0 ? total / count : 0
  }

  private score(p: MoveNetKeypoint) {
    const v = typeof p.score === 'number' ? p.score : 0
    if (!Number.isFinite(v)) return 0
    return Math.max(0, Math.min(1, v))
  }
}
