import { NormalizedLandmark } from './mediapipePose'

export type SquatMode = 'beginner' | 'pro'
type SquatState = 's1' | 's2' | 's3' | null
type TrajectoryReasonCode = 'DEPTH_INSUFFICIENT' | 'FORWARD_LEAN_EXCESSIVE' | 'RHYTHM_BREAK' | 'PHASE_INCOMPLETE'

export type RealtimeFeedback = {
  phase: 'up' | 'descent' | 'bottom' | 'ascent'
  state: SquatState
  mode: SquatMode
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
  lastRepReasonCodes: TrajectoryReasonCode[]
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
    depthInsufficientCount: number
    kneeOverToeCount: number
    forwardLeanCount: number
    backwardLeanCount: number
    sideViewWarningCount: number
  }
}

const TRAJECTORY_REASON_LABELS: Record<TrajectoryReasonCode, string> = {
  DEPTH_INSUFFICIENT: 'Depth insufficient',
  FORWARD_LEAN_EXCESSIVE: 'Excessive forward lean',
  RHYTHM_BREAK: 'Rhythm break',
  PHASE_INCOMPLETE: 'Incomplete phases'
}

const TRAJECTORY_REASON_CORRECTIONS: Record<TrajectoryReasonCode, string> = {
  DEPTH_INSUFFICIENT: 'Go lower to the bottom position while keeping your hips stable.',
  FORWARD_LEAN_EXCESSIVE: 'Brace your core and keep your chest up to reduce excessive forward lean.',
  RHYTHM_BREAK: 'Slow down and keep the descent/ascent continuous and steady.',
  PHASE_INCOMPLETE: 'Complete the full loop: stand → descend → bottom → ascend → stand.'
}

const LM = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, footIndex: 31, nose: 0, rShoulder: 12 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, footIndex: 32, nose: 0, rShoulder: 11 }
}

const MODE_THRESHOLDS: Record<
  SquatMode,
  {
    s1Max: number
    s2Min: number
    s2Max: number
    s3Min: number
    s3Max: number
    fwdMin: number
    backMax: number
    kneeOverToeMax: number
  }
> = {
  beginner: {
    s1Max: 32,
    s2Min: 35,
    s2Max: 65,
    s3Min: 75,
    s3Max: 95,
    fwdMin: 20,
    backMax: 45,
    kneeOverToeMax: 0.06
  },
  pro: {
    s1Max: 30,
    s2Min: 35,
    s2Max: 70,
    s3Min: 78,
    s3Max: 100,
    fwdMin: 18,
    backMax: 42,
    kneeOverToeMax: 0.05
  }
}

export class RealtimeSquatAnalyzer {
  private mode: SquatMode
  private correctCount = 0
  private incorrectCount = 0
  private repCount = 0
  private stateSequence: Array<'s2' | 's3'> = []
  private currentState: SquatState = null
  private lastActiveTs = Date.now()
  private lastMotionTs = Date.now()
  private lastKneeVerticalAngle: number | null = null
  private inactivityResetSec = 20
  private minTrackingQuality = 0.45
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: TrajectoryReasonCode[] = []
  private lastRepFrameCount: number | null = null
  private smoothAngles = {
    torso: null as number | null,
    kneeVertical: null as number | null,
    offset: null as number | null
  }
  private sessionStats = {
    depthInsufficientCount: 0,
    kneeOverToeCount: 0,
    forwardLeanCount: 0,
    backwardLeanCount: 0,
    sideViewWarningCount: 0
  }
  private currentRepFlags = {
    depthInsufficient: false,
    kneeOverToe: false,
    forwardLean: false,
    backwardLean: false,
    sideViewWarning: false
  }
  private repCooldownMs = 260
  private minRepDurationMs = 650
  private lastRepEndTs = 0
  private activeRep: {
    started: boolean
    startedAt: number
    seenS2: boolean
    seenS3: boolean
    seenReturnS2: boolean
    frameCount: number
    outOfRange: { knee: number; hip: number; torso: number }
    outStreak: { knee: number; hip: number; torso: number }
    maxOutStreak: { knee: number; hip: number; torso: number }
    prevAngles: { knee: number | null; hip: number | null; torso: number | null }
    rhythmBreak: boolean
  } = this.createEmptyActiveRep()

  constructor(mode: SquatMode = 'beginner') {
    this.mode = mode
  }

  public setMode(mode: SquatMode) {
    this.mode = mode
  }

  public analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
    const now = Date.now()
    const side = this.chooseSide(landmarks)
    const idx = LM[side]
    const th = MODE_THRESHOLDS[this.mode]

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
    const heel = landmarks[idx.heel]
    const footIndex = landmarks[idx.footIndex]
    const nose = landmarks[idx.nose]
    const otherShoulder = landmarks[idx.rShoulder]

    const kneeAngle = this.angleDeg(midHip ?? undefined, midKnee ?? undefined, midAnkle ?? undefined) ?? this.angleDeg(hip, knee, ankle)
    const hipAngle =
      this.angleDeg(midShoulder ?? undefined, midHip ?? undefined, midKnee ?? undefined) ?? this.angleDeg(shoulder, hip, knee)
    const torsoAngleRaw = this.angleFromVerticalDeg(midShoulder ?? undefined, midHip ?? undefined) ?? this.angleFromVerticalDeg(shoulder, hip)
    const kneeVerticalRaw = this.lineToVerticalDeg(midHip ?? undefined, midKnee ?? undefined) ?? this.lineToVerticalDeg(hip, knee)
    const offsetRaw = this.offsetAngleDeg(nose, shoulder, otherShoulder)
    const torsoAngle = this.smooth('torso', torsoAngleRaw, 0.35)
    const kneeVerticalAngle = this.smooth('kneeVertical', kneeVerticalRaw, 0.35)
    const offsetAngle = this.smooth('offset', offsetRaw, 0.28)

    const trackingQuality = this.avgVisibility(landmarks, [
      idx.shoulder,
      idx.hip,
      idx.knee,
      idx.ankle,
      idx.footIndex,
      idx.nose
    ])

    let heelLiftRatio = null
    if (heel && ankle) heelLiftRatio = Math.max(0, (heel.y - ankle.y) * -1)

    let kneeOverToeRatio = null
    if (knee && footIndex && hip && ankle) {
      const dir = Math.sign((ankle.x - hip.x) || 1)
      kneeOverToeRatio = (knee.x - footIndex.x) * dir
    }

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const sideViewBad = offsetAngle !== null && offsetAngle > 55
    const isCountingPaused = trackingQuality < this.minTrackingQuality || kneeVerticalAngle === null || torsoAngle === null

    if (sideViewBad) {
      warnings.push('Switch to a clearer side view (you are too front-facing) for more accurate analysis.')
      this.currentRepFlags.sideViewWarning = true
    }
    if (trackingQuality < this.minTrackingQuality) {
      warnings.push('Low keypoint confidence. Counting is paused — step to the center and keep your full body in frame.')
    }

    const nextState = isCountingPaused ? this.currentState : this.detectState(kneeAngle)
    if (!isCountingPaused) this.updateStateMachine(nextState, now, kneeAngle, hipAngle, torsoAngle)

    if (nextState !== null) this.lastActiveTs = now
    if (kneeVerticalAngle !== null) {
      if (this.lastKneeVerticalAngle === null || Math.abs(kneeVerticalAngle - this.lastKneeVerticalAngle) > 2) {
        this.lastMotionTs = now
      }
      this.lastKneeVerticalAngle = kneeVerticalAngle
    }
    const inactiveSeconds = Math.max(0, Math.floor((now - Math.max(this.lastActiveTs, this.lastMotionTs)) / 1000))
    if (inactiveSeconds >= this.inactivityResetSec) {
      this.resetCounts()
      this.lastActiveTs = now
      this.lastMotionTs = now
      warnings.push('No movement detected for a while. Counters have been reset.')
    }

    if (!isCountingPaused && torsoAngle !== null && torsoAngle < th.fwdMin) {
      issues.push({ message: 'Leaning forward', joints: [11, 12, 23, 24] })
      this.currentRepFlags.forwardLean = true
    } else if (!isCountingPaused && torsoAngle !== null && torsoAngle > th.backMax) {
      issues.push({ message: 'Leaning backward', joints: [11, 12, 23, 24] })
      this.currentRepFlags.backwardLean = true
    }

    if (!isCountingPaused && kneeOverToeRatio !== null && kneeOverToeRatio > th.kneeOverToeMax) {
      issues.push({ message: 'Knee significantly over toes', joints: [idx.knee, idx.footIndex] })
      this.currentRepFlags.kneeOverToe = true
    }
    if (!isCountingPaused && heelLiftRatio !== null && heelLiftRatio > 0.04) {
      issues.push({ message: 'Heels lifted', joints: [idx.ankle, idx.heel] })
    }

    if (!isCountingPaused && nextState === 's1' && this.stateSequence.length === 0) {
      issues.push({ message: 'Squat', joints: [23, 24, 25, 26, 27, 28] })
    }
    if (this.lastRepResult === 'incorrect' && this.lastRepMessage) {
      issues.push({ message: this.lastRepMessage, joints: [23, 24, 25, 26, 27, 28] })
    }

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: this.mode,
      kneeAngle: kneeAngle ? Math.round(kneeAngle) : null,
      hipAngle: hipAngle ? Math.round(hipAngle) : null,
      torsoAngle: torsoAngle ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: kneeVerticalAngle ? Math.round(kneeVerticalAngle) : null,
      offsetAngle: offsetAngle ? Math.round(offsetAngle) : null,
      trackingQuality: Math.round(trackingQuality * 100) / 100,
      isCountingPaused,
      warnings,
      issues,
      stateSequence: [...this.stateSequence],
      lastRepResult: this.lastRepResult,
      lastRepMessage: this.lastRepMessage,
      lastRepReasonCodes: [...this.lastRepReasonCodes],
      lastRepReasonLabels: this.lastRepReasonCodes.map((code) => TRAJECTORY_REASON_LABELS[code]),
      lastRepCorrections: this.lastRepReasonCodes.map((code) => TRAJECTORY_REASON_CORRECTIONS[code]),
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      repCount: this.repCount,
      lastRepFrameCount: this.lastRepFrameCount,
      inactiveSeconds,
      session: {
        totalReps: this.repCount,
        correctReps: this.correctCount,
        incorrectReps: this.incorrectCount,
        accuracyPct: this.repCount > 0 ? Math.round((this.correctCount / this.repCount) * 100) : 0,
        depthInsufficientCount: this.sessionStats.depthInsufficientCount,
        kneeOverToeCount: this.sessionStats.kneeOverToeCount,
        forwardLeanCount: this.sessionStats.forwardLeanCount,
        backwardLeanCount: this.sessionStats.backwardLeanCount,
        sideViewWarningCount: this.sessionStats.sideViewWarningCount
      }
    }
  }

  private detectState(kneeAngle: number | null): SquatState {
    if (kneeAngle === null) return null
    if (kneeAngle >= 155) return 's1'
    if (kneeAngle >= 95) return 's2'
    if (kneeAngle < 95) return 's3'
    return this.currentState
  }

  private updateStateMachine(nextState: SquatState, now: number, kneeAngle: number | null, hipAngle: number | null, torsoAngle: number | null) {
    if (nextState === null) return
    const isStateChanged = nextState !== this.currentState

    if (nextState === 's2' || nextState === 's3') {
      this.captureRepFrame(nextState, kneeAngle, hipAngle, torsoAngle)
      if (isStateChanged) {
        const prev = this.stateSequence[this.stateSequence.length - 1]
        if (prev !== nextState) this.stateSequence.push(nextState)
        if (this.stateSequence.length > 4) this.stateSequence = this.stateSequence.slice(this.stateSequence.length - 4)
      }
    }

    if (!isStateChanged) return

    if (nextState === 's1' && this.stateSequence.length > 0) {
      const canCloseLoop = this.activeRep.started && this.activeRep.seenS2 && this.activeRep.seenS3 && this.activeRep.seenReturnS2
      const repDurationMs = this.activeRep.started ? now - this.activeRep.startedAt : 0
      const passDuration = repDurationMs >= this.minRepDurationMs
      const passCooldown = now - this.lastRepEndTs >= this.repCooldownMs

      if (canCloseLoop && passDuration && passCooldown) {
        const reasons = this.evaluateTrajectoryReasons()
        this.repCount += 1
        this.lastRepFrameCount = this.activeRep.frameCount
        this.lastRepEndTs = now
        this.lastRepReasonCodes = reasons
        if (reasons.length === 0) {
          this.correctCount += 1
          this.lastRepResult = 'correct'
          this.lastRepMessage = 'Good rep.'
        } else {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          this.lastRepMessage = this.composeIncorrectReasonFromCodes(reasons)
        }
        this.flushRepFlags()
      } else {
        const reasons: TrajectoryReasonCode[] = []
        if (!canCloseLoop) reasons.push('PHASE_INCOMPLETE')
        if (!passDuration || !passCooldown) reasons.push('RHYTHM_BREAK')
        this.lastRepResult = 'incorrect'
        this.lastRepReasonCodes = reasons
        this.lastRepMessage = this.composeIncorrectReasonFromCodes(reasons)
        this.lastRepFrameCount = null
      }
      this.stateSequence = []
      this.activeRep = this.createEmptyActiveRep()
    }

    this.currentState = nextState
  }

  private createEmptyActiveRep() {
    return {
      started: false,
      startedAt: 0,
      seenS2: false,
      seenS3: false,
      seenReturnS2: false,
      frameCount: 0,
      outOfRange: { knee: 0, hip: 0, torso: 0 },
      outStreak: { knee: 0, hip: 0, torso: 0 },
      maxOutStreak: { knee: 0, hip: 0, torso: 0 },
      prevAngles: { knee: null, hip: null, torso: null },
      rhythmBreak: false
    }
  }

  private captureRepFrame(state: Exclude<SquatState, null | 's1'>, kneeAngle: number | null, hipAngle: number | null, torsoAngle: number | null) {
    if (!this.activeRep.started) {
      this.activeRep.started = true
      this.activeRep.startedAt = Date.now()
    }
    this.activeRep.frameCount += 1
    if (state === 's2') {
      if (this.activeRep.seenS3) this.activeRep.seenReturnS2 = true
      this.activeRep.seenS2 = true
    } else if (state === 's3') {
      this.activeRep.seenS3 = true
    }
    this.trackAngleContinuity(state, 'knee', kneeAngle)
    this.trackAngleContinuity(state, 'hip', hipAngle)
    this.trackAngleContinuity(state, 'torso', torsoAngle)
    this.trackJump('knee', kneeAngle, 16)
    this.trackJump('hip', hipAngle, 16)
    this.trackJump('torso', torsoAngle, 14)
    if (torsoAngle !== null && torsoAngle > 52) this.currentRepFlags.forwardLean = true
  }

  private trackAngleContinuity(state: Exclude<SquatState, null | 's1'>, axis: 'knee' | 'hip' | 'torso', value: number | null) {
    if (value === null || !Number.isFinite(value)) return
    const inRange = this.isAngleInRange(state, axis, value)
    if (inRange) {
      this.activeRep.outStreak[axis] = 0
      return
    }
    this.activeRep.outOfRange[axis] += 1
    this.activeRep.outStreak[axis] += 1
    if (this.activeRep.outStreak[axis] > this.activeRep.maxOutStreak[axis]) {
      this.activeRep.maxOutStreak[axis] = this.activeRep.outStreak[axis]
    }
  }

  private trackJump(axis: 'knee' | 'hip' | 'torso', value: number | null, jumpLimit: number) {
    if (value === null || !Number.isFinite(value)) return
    const prev = this.activeRep.prevAngles[axis]
    if (prev !== null && Math.abs(value - prev) > jumpLimit) this.activeRep.rhythmBreak = true
    this.activeRep.prevAngles[axis] = value
  }

  private isAngleInRange(state: Exclude<SquatState, null | 's1'>, axis: 'knee' | 'hip' | 'torso', value: number) {
    if (state === 's2') {
      if (axis === 'knee') return value >= 95 && value <= 175
      if (axis === 'hip') return value >= 85 && value <= 170
      return value >= 8 && value <= 55
    }
    if (axis === 'knee') return value >= 70 && value <= 132
    if (axis === 'hip') return value >= 65 && value <= 138
    return value >= 10 && value <= 60
  }

  private evaluateTrajectoryReasons() {
    const reasons: TrajectoryReasonCode[] = []
    const total = Math.max(1, this.activeRep.frameCount)
    const kneeRatio = this.activeRep.outOfRange.knee / total
    const hipRatio = this.activeRep.outOfRange.hip / total
    const torsoRatio = this.activeRep.outOfRange.torso / total
    const maxOutStreak = Math.max(this.activeRep.maxOutStreak.knee, this.activeRep.maxOutStreak.hip, this.activeRep.maxOutStreak.torso)
    if (!this.activeRep.seenS3) {
      reasons.push('DEPTH_INSUFFICIENT')
      this.currentRepFlags.depthInsufficient = true
    }
    if (torsoRatio > 0.28 || this.activeRep.outOfRange.torso >= 4) {
      reasons.push('FORWARD_LEAN_EXCESSIVE')
      this.currentRepFlags.forwardLean = true
    }
    if (this.activeRep.rhythmBreak || maxOutStreak >= 4) reasons.push('RHYTHM_BREAK')
    if (!(this.activeRep.seenS2 && this.activeRep.seenS3 && this.activeRep.seenReturnS2)) reasons.push('PHASE_INCOMPLETE')
    if (kneeRatio > 0.34 || hipRatio > 0.34) {
      if (!reasons.includes('DEPTH_INSUFFICIENT')) reasons.push('DEPTH_INSUFFICIENT')
      this.currentRepFlags.depthInsufficient = true
    }
    return reasons
  }

  private composeIncorrectReasonFromCodes(reasons: TrajectoryReasonCode[]) {
    const deduped = Array.from(new Set(reasons))
    if (deduped.length === 0) return 'Not standard. Slow down and keep a clear side view.'
    return `Not standard: ${deduped.map((code) => TRAJECTORY_REASON_LABELS[code]).join(', ')}.`
  }

  private flushRepFlags() {
    if (this.currentRepFlags.depthInsufficient) this.sessionStats.depthInsufficientCount += 1
    if (this.currentRepFlags.kneeOverToe) this.sessionStats.kneeOverToeCount += 1
    if (this.currentRepFlags.forwardLean) this.sessionStats.forwardLeanCount += 1
    if (this.currentRepFlags.backwardLean) this.sessionStats.backwardLeanCount += 1
    if (this.currentRepFlags.sideViewWarning) this.sessionStats.sideViewWarningCount += 1
    this.currentRepFlags = {
      depthInsufficient: false,
      kneeOverToe: false,
      forwardLean: false,
      backwardLean: false,
      sideViewWarning: false
    }
  }

  private resetCounts() {
    this.correctCount = 0
    this.incorrectCount = 0
    this.repCount = 0
    this.stateSequence = []
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepFrameCount = null
    this.lastKneeVerticalAngle = null
    this.lastRepEndTs = 0
    this.activeRep = this.createEmptyActiveRep()
    this.smoothAngles = { torso: null, kneeVertical: null, offset: null }
    this.sessionStats = {
      depthInsufficientCount: 0,
      kneeOverToeCount: 0,
      forwardLeanCount: 0,
      backwardLeanCount: 0,
      sideViewWarningCount: 0
    }
    this.currentRepFlags = {
      depthInsufficient: false,
      kneeOverToe: false,
      forwardLean: false,
      backwardLean: false,
      sideViewWarning: false
    }
  }

  public resetSession() {
    this.resetCounts()
    this.lastActiveTs = Date.now()
    this.lastMotionTs = Date.now()
  }

  private stateToPhase(state: SquatState): RealtimeFeedback['phase'] {
    if (state === 's1') return 'up'
    if (state === 's2') return 'descent'
    if (state === 's3') return 'bottom'
    return this.currentState === 's2' ? 'ascent' : 'up'
  }

  private chooseSide(landmarks: NormalizedLandmark[]): 'left' | 'right' {
    let leftVis = 0
    let rightVis = 0
    const leftKeys = [11, 23, 25, 27]
    const rightKeys = [12, 24, 26, 28]
    for (const k of leftKeys) leftVis += landmarks[k]?.visibility ?? 0
    for (const k of rightKeys) rightVis += landmarks[k]?.visibility ?? 0
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
    if (v < 0) return 0
    if (v > 1) return 1
    return v
  }

  private smooth(key: keyof RealtimeSquatAnalyzer['smoothAngles'], next: number | null, alpha: number) {
    if (next === null || !Number.isFinite(next)) return this.smoothAngles[key]
    const prev = this.smoothAngles[key]
    if (prev === null || !Number.isFinite(prev)) {
      this.smoothAngles[key] = next
      return next
    }
    const merged = prev + (next - prev) * alpha
    this.smoothAngles[key] = merged
    return merged
  }

  private angleDeg(a: NormalizedLandmark | undefined, b: NormalizedLandmark | undefined, c: NormalizedLandmark | undefined): number | null {
    if (!a || !b || !c) return null
    const ba = { x: a.x - b.x, y: a.y - b.y }
    const bc = { x: c.x - b.x, y: c.y - b.y }
    const dot = ba.x * bc.x + ba.y * bc.y
    const mag = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dot / mag))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleFromVerticalDeg(top: NormalizedLandmark | undefined, bottom: NormalizedLandmark | undefined): number | null {
    if (!top || !bottom) return null
    const dx = top.x - bottom.x
    const dy = top.y - bottom.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private lineToVerticalDeg(a: NormalizedLandmark | undefined, b: NormalizedLandmark | undefined): number | null {
    if (!a || !b) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private offsetAngleDeg(
    nose: NormalizedLandmark | undefined,
    shoulder: NormalizedLandmark | undefined,
    otherShoulder: NormalizedLandmark | undefined
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

  private midpoint(a: NormalizedLandmark | undefined, b: NormalizedLandmark | undefined): NormalizedLandmark | null {
    if (!a || !b) return null
    if (Math.min(a.visibility ?? 0, b.visibility ?? 0) < 0.15) return null
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0) }
  }
}
