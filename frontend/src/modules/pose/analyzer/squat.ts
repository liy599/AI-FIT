import type { MoveNetKeypoint } from '../vision/movenetTracker'
import type { RealtimeFeedback } from './types'

const KNEE_FORWARD_WARN_RATIO = 0.048
const KNEE_FORWARD_FAIL_RATIO = 0.053
const KNEE_FORWARD_FAIL_MIN_FRAMES = 1
const FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL = 32
const FORWARD_LEAN_FAIL_MIN_FRAMES = 2
const DEFAULT_ANALYZER_FPS = 40
const LIVE_REP_FAST_SEC = 1.2
const LIVE_REP_SLOW_SEC = 4.2
const VIDEO_REP_FAST_SEC = 1.5
const VIDEO_REP_SLOW_SEC = 4.2
const REP_COUNT_MIN_FRAMES = 4
const REP_VALID_MIN_FRAMES = 8
const REP_VALID_RATIO_MIN = 0.45
const TRACKING_QUALITY_MIN = 0.28
const LOWER_BODY_QUALITY_MIN = 0.35
const GEOMETRY_MIN_SCORE = 0.18
const START_STABLE_S1_FRAMES = 6
const START_STABLE_VALID_FRAMES = 6
const S1_ENTER_KNEE_ANGLE = 150
const S1_EXIT_KNEE_ANGLE = 145
const S3_ENTER_KNEE_ANGLE = 110
const S3_EXIT_KNEE_ANGLE = 118
const FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL = 30
const SIDE_VIEW_WARN_ANGLE = 65
const SIDE_VIEW_BAD_RATIO_MAX = 0.55
const SYNTHETIC_FOOT_AHEAD_X = 0.04
const TORSO_BLEND_MAX_DIFF_DEG = 6
const JOINT_BLEND_MAX_DIFF_DEG = 8
const KNEE_ANGLE_CORRECTION_DEG = 8
const TORSO_PEAK_HOLD_MS = 300

function torsoPeakHoldFramesForFps(fps: number) {
  return Math.max(2, Math.round((TORSO_PEAK_HOLD_MS / 1000) * Math.max(10, fps)))
}

type KeypointMap = Partial<Record<MoveNetKeypoint['name'], MoveNetKeypoint>>

export type SquatTuning = {
  kneeForwardWarnRatio: number
  kneeForwardFailRatio: number
  kneeForwardFailMinFrames: number
  forwardLeanWarnDeg: number
  forwardLeanFailDeg: number
  forwardLeanFailMinFrames: number
  trackingQualityMin: number
}

export type SquatTempo = {
  repFastSec: number
  repSlowSec: number
}

export const DEFAULT_SQUAT_TUNING: SquatTuning = {
  kneeForwardWarnRatio: KNEE_FORWARD_WARN_RATIO,
  kneeForwardFailRatio: KNEE_FORWARD_FAIL_RATIO,
  kneeForwardFailMinFrames: KNEE_FORWARD_FAIL_MIN_FRAMES,
  forwardLeanWarnDeg: FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL,
  forwardLeanFailDeg: FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL,
  forwardLeanFailMinFrames: FORWARD_LEAN_FAIL_MIN_FRAMES,
  trackingQualityMin: TRACKING_QUALITY_MIN
}

export const REALTIME_DEFAULT_SQUAT_TUNING: SquatTuning = { ...DEFAULT_SQUAT_TUNING }
export const REALTIME_DEFAULT_SQUAT_TEMPO: SquatTempo = {
  repFastSec: LIVE_REP_FAST_SEC,
  repSlowSec: LIVE_REP_SLOW_SEC
}
export const VIDEO_DEFAULT_SQUAT_TEMPO: SquatTempo = {
  repFastSec: VIDEO_REP_FAST_SEC,
  repSlowSec: VIDEO_REP_SLOW_SEC
}

export class RealtimeSquatAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private kneeForwardRepCount = 0
  private forwardLeanRepCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepReasonCodes: string[] = []
  private lastRepReasonLabels: string[] = []
  private lastRepCorrections: string[] = []
  private lastRepFrameCount: number | null = null
  private enteredBottom = false
  private enteredBottomReliable = false
  private repActive = false
  private stableS1Frames = 0
  private stableValidFrames = 0
  private frameCount = 0
  private repPeakKneeForwardRatio = 0
  private repKneeForwardHardFrames = 0
  private repPeakTorsoLeanAngle = 0
  private repForwardLeanHardFrames = 0
  private repValidFrameCount = 0
  private repSideViewBadFrames = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private sideViewInvalidRepCount = 0
  private recentTorsoAngles: number[] = []
  private analyzerFps = DEFAULT_ANALYZER_FPS
  private torsoPeakHoldFrames = torsoPeakHoldFramesForFps(DEFAULT_ANALYZER_FPS)
  private tuning: SquatTuning = { ...DEFAULT_SQUAT_TUNING }
  private tempo: SquatTempo = { ...REALTIME_DEFAULT_SQUAT_TEMPO }

  setTuning(next: Partial<SquatTuning>) {
    this.tuning = {
      ...this.tuning,
      ...next
    }
  }

  setAnalyzerFps(nextFps: number) {
    if (!Number.isFinite(nextFps)) return
    this.analyzerFps = Math.max(10, Math.min(120, nextFps))
    this.torsoPeakHoldFrames = torsoPeakHoldFramesForFps(this.analyzerFps)
  }

  setTempo(next: Partial<SquatTempo>) {
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
    const leftBodyVis = this.avgScore(map, ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'])
    const rightBodyVis = this.avgScore(map, ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'])
    const side: 'left' | 'right' = rightBodyVis > leftBodyVis ? 'right' : 'left'

    const lShoulder = map.left_shoulder
    const rShoulder = map.right_shoulder
    const lHip = map.left_hip
    const rHip = map.right_hip
    const lKnee = map.left_knee
    const rKnee = map.right_knee
    const lAnkle = map.left_ankle
    const rAnkle = map.right_ankle
    const nose = map.nose

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)
    const midKnee = this.midpoint(lKnee, rKnee)
    const midAnkle = this.midpoint(lAnkle, rAnkle)

    const shoulder = side === 'right' ? rShoulder : lShoulder
    const hip = side === 'right' ? rHip : lHip
    const knee = side === 'right' ? rKnee : lKnee
    const ankle = side === 'right' ? rAnkle : lAnkle
    const otherShoulder = side === 'right' ? lShoulder : rShoulder

    const kneeAngleRaw = this.selectKneeAngle({
      side,
      lHip,
      rHip,
      lKnee,
      rKnee,
      lAnkle,
      rAnkle,
      midHip,
      midKnee,
      midAnkle
    })
    const kneeAngle = this.correctKneeAngle(kneeAngleRaw)
    const hipAngle = this.selectHipAngle({
      side,
      lShoulder,
      rShoulder,
      lHip,
      rHip,
      lKnee,
      rKnee,
      midShoulder,
      midHip,
      midKnee
    })
    const torsoAngle = this.selectTorsoAngle({
      side,
      lShoulder,
      rShoulder,
      lHip,
      rHip,
      midShoulder,
      midHip
    })
    const kneeVerticalAngle = this.lineToVerticalDeg(midHip ?? hip, midKnee ?? knee)
    const offsetAngle = this.offsetAngleDeg(nose, shoulder, otherShoulder)
    const trackingQuality = this.trackingQualityForSide(map, side)
    const lowerBodyQuality = this.avgScore(map, side === 'left' ? ['left_hip', 'left_knee', 'left_ankle'] : ['right_hip', 'right_knee', 'right_ankle'])

    const heldTorsoAngle = this.updateTorsoPeakHold(torsoAngle)
    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetKeypoint['name'][] }> = []
    const isCountingPaused = trackingQuality < this.tuning.trackingQualityMin || lowerBodyQuality < LOWER_BODY_QUALITY_MIN || kneeVerticalAngle === null || torsoAngle === null
    const nextState = this.detectState(kneeAngleRaw)
    let kneeForwardRatio: number | null = null

    const sideViewWarning = offsetAngle !== null && offsetAngle > SIDE_VIEW_WARN_ANGLE
    if (sideViewWarning) {
      warnings.push('Try to stay in a clear side view for more stable tracking.')
    }
    if (heldTorsoAngle !== null && heldTorsoAngle > this.tuning.forwardLeanWarnDeg) {
      issues.push({
        message: 'Excessive forward torso lean',
        joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip']
      })
    }

    if (knee && ankle && hip) {
      const dir = Math.sign((ankle.x - hip.x) || 1)
      const shinDx = ankle.x - knee.x
      const shinDy = ankle.y - knee.y
      const shinMag = Math.hypot(shinDx, shinDy) || 1
      const footAheadComp = Math.abs(shinDx / shinMag) * SYNTHETIC_FOOT_AHEAD_X
      kneeForwardRatio = (knee.x - ankle.x) * dir - footAheadComp
      if (kneeForwardRatio > this.tuning.kneeForwardWarnRatio) {
        warnings.push('Knee is moving too far forward. Push hips back first and keep shins more vertical.')
      }
      if (kneeForwardRatio >= this.tuning.kneeForwardFailRatio) {
        issues.push({
          message: 'Knee drifted too far ahead of ankle',
          joints: [side === 'right' ? 'right_knee' : 'left_knee', side === 'right' ? 'right_ankle' : 'left_ankle']
        })
      }
    }

    this.updateState(nextState, kneeForwardRatio, torsoAngle, isCountingPaused, sideViewWarning)
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: kneeAngle !== null ? Math.round(kneeAngle) : null,
      hipAngle: hipAngle !== null ? Math.round(hipAngle) : null,
      torsoAngle: heldTorsoAngle !== null ? Math.round(heldTorsoAngle) : null,
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
        kneeOverToeCount: this.kneeForwardRepCount,
        forwardLeanCount: this.forwardLeanRepCount,
        backwardLeanCount: 0,
        sideViewWarningCount: this.sideViewInvalidRepCount,
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
    this.kneeForwardRepCount = 0
    this.forwardLeanRepCount = 0
    this.currentState = null
    this.lastRepResult = null
    this.lastRepMessage = null
    this.lastRepReasonCodes = []
    this.lastRepReasonLabels = []
    this.lastRepCorrections = []
    this.lastRepFrameCount = null
    this.enteredBottom = false
    this.enteredBottomReliable = false
    this.repActive = false
    this.stableS1Frames = 0
    this.stableValidFrames = 0
    this.frameCount = 0
    this.repPeakKneeForwardRatio = 0
    this.repKneeForwardHardFrames = 0
    this.repPeakTorsoLeanAngle = 0
    this.repForwardLeanHardFrames = 0
    this.repValidFrameCount = 0
    this.repSideViewBadFrames = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.sideViewInvalidRepCount = 0
    this.recentTorsoAngles = []
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    kneeForwardRatio: number | null,
    torsoAngle: number | null,
    isCountingPaused: boolean,
    sideViewWarning: boolean
  ) {
    if (!isCountingPaused) {
      this.stableValidFrames += 1
    } else {
      this.stableValidFrames = 0
    }
    if (nextState === null) {
      this.stableS1Frames = 0
      return
    }
    const canStartRep = this.stableS1Frames >= START_STABLE_S1_FRAMES && this.stableValidFrames >= START_STABLE_VALID_FRAMES
    const startedRep = this.currentState === 's1' && nextState === 's2' && canStartRep
    if (nextState === 's1' && !isCountingPaused) {
      this.stableS1Frames += 1
    } else {
      this.stableS1Frames = 0
    }
    if (startedRep) {
      this.repActive = true
      this.frameCount = 0
      this.enteredBottom = false
      this.enteredBottomReliable = false
      this.repPeakKneeForwardRatio = 0
      this.repKneeForwardHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repValidFrameCount = 0
      this.repSideViewBadFrames = 0
    }
    if (this.repActive) {
      this.frameCount += 1
      if (!isCountingPaused && sideViewWarning) this.repSideViewBadFrames += 1
      if (!isCountingPaused) this.repValidFrameCount += 1
      if (!isCountingPaused && typeof kneeForwardRatio === 'number' && Number.isFinite(kneeForwardRatio) && kneeForwardRatio > 0) {
        this.repPeakKneeForwardRatio = Math.max(this.repPeakKneeForwardRatio, kneeForwardRatio)
        if (kneeForwardRatio >= this.tuning.kneeForwardFailRatio) this.repKneeForwardHardFrames += 1
      }
      if (!isCountingPaused && typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) && torsoAngle > 0) {
        this.repPeakTorsoLeanAngle = Math.max(this.repPeakTorsoLeanAngle, torsoAngle)
        if (torsoAngle >= this.tuning.forwardLeanFailDeg) this.repForwardLeanHardFrames += 1
      }
      if (nextState === 's3') {
        this.enteredBottom = true
        if (!isCountingPaused) this.enteredBottomReliable = true
      }
    }

    if (this.repActive && this.currentState !== 's1' && nextState === 's1' && this.enteredBottom) {
      const enoughForCounting = this.repValidFrameCount >= REP_COUNT_MIN_FRAMES && this.enteredBottomReliable
      if (!enoughForCounting) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: tracking was not stable enough to count.'
        this.lastRepReasonCodes = ['LOW_CONFIDENCE_REP_IGNORED']
        this.lastRepReasonLabels = ['Tracking was not stable enough to count']
        this.lastRepCorrections = ['Step back until your full body is visible and keep key joints in frame.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredBottom = false
        this.enteredBottomReliable = false
        this.repActive = false
        this.repPeakKneeForwardRatio = 0
        this.repKneeForwardHardFrames = 0
        this.repPeakTorsoLeanAngle = 0
        this.repForwardLeanHardFrames = 0
        this.repValidFrameCount = 0
        this.repSideViewBadFrames = 0
        this.currentState = nextState
        return
      }

      const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0
      const hasReliableTracking = this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN
      const sideViewBadRatio = this.repValidFrameCount > 0 ? this.repSideViewBadFrames / this.repValidFrameCount : 1
      const hasReliableSideView = sideViewBadRatio <= SIDE_VIEW_BAD_RATIO_MAX
      if (!hasReliableTracking) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: keypoints were incomplete or unstable.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE_REP_IGNORED']
        this.lastRepReasonLabels = ['Keypoints were incomplete or unstable']
        this.lastRepCorrections = ['Step back slightly and keep shoulders, hips, knees, and ankles visible.']
        this.lastRepFrameCount = this.frameCount
        this.frameCount = 0
        this.enteredBottom = false
        this.enteredBottomReliable = false
        this.repActive = false
        this.repPeakKneeForwardRatio = 0
        this.repKneeForwardHardFrames = 0
        this.repPeakTorsoLeanAngle = 0
        this.repForwardLeanHardFrames = 0
        this.repValidFrameCount = 0
        this.repSideViewBadFrames = 0
        this.currentState = nextState
        return
      }
      this.repCount += 1
      const repDurationSec = Math.max(0.1, this.frameCount / this.analyzerFps)
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (repDurationSec < this.tempo.repFastSec) this.fastRepCount += 1
      if (repDurationSec > this.tempo.repSlowSec) this.slowRepCount += 1

      if (hasReliableSideView) {
        const tempoFastFailed = repDurationSec < this.tempo.repFastSec
        const tempoSlowFailed = repDurationSec > this.tempo.repSlowSec
        const kneeForwardFailed =
          this.repPeakKneeForwardRatio >= this.tuning.kneeForwardFailRatio &&
          this.repKneeForwardHardFrames >= this.tuning.kneeForwardFailMinFrames
        const forwardLeanFailed =
          this.repPeakTorsoLeanAngle >= this.tuning.forwardLeanFailDeg &&
          this.repForwardLeanHardFrames >= this.tuning.forwardLeanFailMinFrames

        if (kneeForwardFailed || forwardLeanFailed || tempoFastFailed || tempoSlowFailed) {
          this.incorrectCount += 1
          this.lastRepResult = 'incorrect'
          const reasonCodes: string[] = []
          const reasonLabels: string[] = []
          const corrections: string[] = []
          if (kneeForwardFailed) {
            this.kneeForwardRepCount += 1
            reasonCodes.push('KNEE_FORWARD_EXCESSIVE')
            reasonLabels.push('Knees drifted too far forward')
            corrections.push('Push hips back first and keep shins more vertical.')
          }
          if (forwardLeanFailed) {
            this.forwardLeanRepCount += 1
            reasonCodes.push('FORWARD_LEAN_EXCESSIVE')
            reasonLabels.push('Torso leaned too far forward')
            corrections.push('Keep chest up and brace your core as you descend.')
          }
          if (tempoFastFailed) {
            reasonCodes.push('TEMPO_TOO_FAST')
            reasonLabels.push('Rep tempo was too fast')
            corrections.push('Slow down each rep: about 2s down, brief pause, then controlled ascent.')
          }
          if (tempoSlowFailed) {
            reasonCodes.push('TEMPO_TOO_SLOW')
            reasonLabels.push('Rep tempo was too slow')
            corrections.push('Keep tension but avoid long pauses; use a smoother continuous rep tempo.')
          }
          this.lastRepReasonCodes = reasonCodes
          this.lastRepReasonLabels = reasonLabels
          this.lastRepCorrections = corrections
          if (reasonLabels.length > 1) {
            this.lastRepMessage = `Rep failed: ${reasonLabels.join(', ')}.`
          } else {
            this.lastRepMessage =
              reasonLabels[0] === 'Torso leaned too far forward'
                ? 'Rep failed: torso leaned too far forward.'
                : reasonLabels[0] === 'Rep tempo was too fast'
                  ? 'Rep failed: tempo was too fast.'
                  : reasonLabels[0] === 'Rep tempo was too slow'
                    ? 'Rep failed: tempo was too slow.'
                    : 'Rep failed: knees drifted too far forward.'
          }
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
        if (!hasReliableSideView) {
          this.sideViewInvalidRepCount += 1
          this.lastRepMessage = 'Rep counted, but excluded from valid assessment because side-view alignment was unstable.'
          this.lastRepReasonCodes = ['SIDE_VIEW_UNSTABLE']
          this.lastRepReasonLabels = ['Side-view alignment was unstable']
          this.lastRepCorrections = ['Keep a clearer side view across the full rep to count it as valid.']
        } else {
          this.lastRepMessage = 'Rep counted, but quality was not assessed due to incomplete keypoints.'
          this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
          this.lastRepReasonLabels = ['Keypoints were incomplete']
          this.lastRepCorrections = ['Improve lighting and keep your full body in frame before continuing.']
        }
      }

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredBottom = false
      this.enteredBottomReliable = false
      this.repActive = false
      this.repPeakKneeForwardRatio = 0
      this.repKneeForwardHardFrames = 0
      this.repPeakTorsoLeanAngle = 0
      this.repForwardLeanHardFrames = 0
      this.repValidFrameCount = 0
      this.repSideViewBadFrames = 0
    }
    this.currentState = nextState
  }

  private detectState(kneeAngle: number | null): 's1' | 's2' | 's3' | null {
    if (kneeAngle === null) return null
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

  private byName(keypoints: MoveNetKeypoint[]) {
    const map: KeypointMap = {}
    for (const p of keypoints) map[p.name] = p
    return map
  }

  private avgScore(map: KeypointMap, names: MoveNetKeypoint['name'][]) {
    if (names.length === 0) return 0
    let sum = 0
    for (const name of names) sum += this.score(map[name])
    return sum / names.length
  }

  private trackingQualityForSide(map: KeypointMap, side: 'left' | 'right') {
    const primary =
      side === 'left'
        ? this.avgScore(map, ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'])
        : this.avgScore(map, ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'])
    const secondary =
      side === 'left'
        ? this.avgScore(map, ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'])
        : this.avgScore(map, ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'])
    const face = this.avgScore(map, ['nose'])
    return primary * 0.75 + secondary * 0.15 + face * 0.1
  }

  private score(p?: MoveNetKeypoint) {
    if (!p || !Number.isFinite(p.score)) return 0
    return Math.max(0, Math.min(1, p.score))
  }

  private selectKneeAngle(args: {
    side: 'left' | 'right'
    lHip?: MoveNetKeypoint
    rHip?: MoveNetKeypoint
    lKnee?: MoveNetKeypoint
    rKnee?: MoveNetKeypoint
    lAnkle?: MoveNetKeypoint
    rAnkle?: MoveNetKeypoint
    midHip: MoveNetKeypoint | null
    midKnee: MoveNetKeypoint | null
    midAnkle: MoveNetKeypoint | null
  }) {
    const left = this.angleDeg(args.lHip, args.lKnee, args.lAnkle)
    const right = this.angleDeg(args.rHip, args.rKnee, args.rAnkle)
    const primary = args.side === 'left' ? left : right
    const secondary = args.side === 'left' ? right : left
    if (primary !== null && secondary !== null && Math.abs(primary - secondary) <= JOINT_BLEND_MAX_DIFF_DEG) {
      return primary * 0.75 + secondary * 0.25
    }
    if (primary !== null) return primary
    if (secondary !== null) return secondary
    return this.angleDeg(args.midHip, args.midKnee, args.midAnkle)
  }

  private selectHipAngle(args: {
    side: 'left' | 'right'
    lShoulder?: MoveNetKeypoint
    rShoulder?: MoveNetKeypoint
    lHip?: MoveNetKeypoint
    rHip?: MoveNetKeypoint
    lKnee?: MoveNetKeypoint
    rKnee?: MoveNetKeypoint
    midShoulder: MoveNetKeypoint | null
    midHip: MoveNetKeypoint | null
    midKnee: MoveNetKeypoint | null
  }) {
    const left = this.angleDeg(args.lShoulder, args.lHip, args.lKnee)
    const right = this.angleDeg(args.rShoulder, args.rHip, args.rKnee)
    const primary = args.side === 'left' ? left : right
    const secondary = args.side === 'left' ? right : left
    if (primary !== null && secondary !== null && Math.abs(primary - secondary) <= JOINT_BLEND_MAX_DIFF_DEG) {
      return primary * 0.75 + secondary * 0.25
    }
    if (primary !== null) return primary
    if (secondary !== null) return secondary
    return this.angleDeg(args.midShoulder, args.midHip, args.midKnee)
  }

  private selectTorsoAngle(args: {
    side: 'left' | 'right'
    lShoulder?: MoveNetKeypoint
    rShoulder?: MoveNetKeypoint
    lHip?: MoveNetKeypoint
    rHip?: MoveNetKeypoint
    midShoulder: MoveNetKeypoint | null
    midHip: MoveNetKeypoint | null
  }) {
    const left = this.angleFromVerticalDeg(args.lShoulder, args.lHip)
    const right = this.angleFromVerticalDeg(args.rShoulder, args.rHip)
    const primary = args.side === 'left' ? left : right
    const secondary = args.side === 'left' ? right : left

    if (primary !== null && secondary !== null && Math.abs(primary - secondary) <= TORSO_BLEND_MAX_DIFF_DEG) {
      return primary * 0.75 + secondary * 0.25
    }
    if (primary !== null) return primary
    if (secondary !== null) return secondary
    return this.angleFromVerticalDeg(args.midShoulder, args.midHip)
  }

  private updateTorsoPeakHold(torsoAngle: number | null) {
    if (typeof torsoAngle !== 'number' || !Number.isFinite(torsoAngle) || torsoAngle <= 0) {
      this.recentTorsoAngles = []
      return null
    }
    this.recentTorsoAngles.push(torsoAngle)
    if (this.recentTorsoAngles.length > this.torsoPeakHoldFrames) this.recentTorsoAngles.shift()
    let peak = torsoAngle
    for (const value of this.recentTorsoAngles) peak = Math.max(peak, value)
    return peak
  }

  private correctKneeAngle(rawAngle: number | null) {
    if (rawAngle === null || !Number.isFinite(rawAngle)) return null
    const corrected = rawAngle - KNEE_ANGLE_CORRECTION_DEG
    return Math.max(0, Math.min(180, corrected))
  }

  private midpoint(a?: MoveNetKeypoint, b?: MoveNetKeypoint): MoveNetKeypoint | null {
    if (!a || !b) return null
    if (Math.min(this.score(a), this.score(b)) < 0.15) return null
    return {
      name: a.name,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      score: Math.min(this.score(a), this.score(b))
    }
  }

  private angleDeg(a?: MoveNetKeypoint | null, b?: MoveNetKeypoint | null, c?: MoveNetKeypoint | null): number | null {
    if (!a || !b || !c) return null
    if (Math.min(this.score(a), this.score(b), this.score(c)) < GEOMETRY_MIN_SCORE) return null
    const ba = { x: a.x - b.x, y: a.y - b.y }
    const bc = { x: c.x - b.x, y: c.y - b.y }
    const dot = ba.x * bc.x + ba.y * bc.y
    const mag = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dot / mag))
    return (Math.acos(cos) * 180) / Math.PI
  }

  private angleFromVerticalDeg(top?: MoveNetKeypoint | null, bottom?: MoveNetKeypoint | null): number | null {
    if (!top || !bottom) return null
    if (Math.min(this.score(top), this.score(bottom)) < GEOMETRY_MIN_SCORE) return null
    const dx = bottom.x - top.x
    const dy = bottom.y - top.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private lineToVerticalDeg(a?: MoveNetKeypoint | null, b?: MoveNetKeypoint | null): number | null {
    if (!a || !b) return null
    if (Math.min(this.score(a), this.score(b)) < GEOMETRY_MIN_SCORE) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    const cos = Math.min(1, Math.max(-1, dy / mag))
    return Math.abs((Math.acos(cos) * 180) / Math.PI)
  }

  private offsetAngleDeg(nose?: MoveNetKeypoint, shoulder?: MoveNetKeypoint, otherShoulder?: MoveNetKeypoint): number | null {
    if (!nose || !shoulder || !otherShoulder) return null
    if (Math.min(this.score(nose), this.score(shoulder), this.score(otherShoulder)) < GEOMETRY_MIN_SCORE) return null
    const shoulderSpanX = Math.abs(shoulder.x - otherShoulder.x)
    const shoulderSpanY = Math.abs(shoulder.y - otherShoulder.y) + 1e-6
    const frontalLikeDeg = (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
    const noseDx = Math.abs(nose.x - shoulder.x)
    const noseDy = Math.abs(nose.y - shoulder.y) + 1e-6
    const noseOffsetDeg = (Math.atan2(noseDx, noseDy) * 180) / Math.PI
    return (frontalLikeDeg + noseOffsetDeg) / 2
  }
}

