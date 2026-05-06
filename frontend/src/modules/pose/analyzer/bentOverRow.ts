import type { RealtimeFeedback } from './types'
import type { MoveNetKeypoint, MoveNetName } from '../vision/movenetTracker'

const DEFAULT_NATIVE_ANALYZER_FPS = 40
const NATIVE_FRONT_VIEW_OK_ANGLE = 55
const NATIVE_FRONT_VIEW_FAIL_RATIO = 0.45

const NATIVE_REP_COUNT_MIN_FRAMES = 8
const NATIVE_REP_VALID_MIN_FRAMES = 8
const NATIVE_REP_VALID_RATIO_MIN = 0.45

const NATIVE_S1_ENTER_ROW_DEG = 145
const NATIVE_S1_EXIT_ROW_DEG = 150
const NATIVE_S3_ENTER_ROW_DEG = 85
const NATIVE_S3_EXIT_ROW_DEG = 95

const REP_FAST_SEC = 0.8
const REP_SLOW_SEC = 4.0

export type BentOverRowTuning = {
  trackingQualityMin: number
  torsoLeanWarnDeg: number
  torsoLeanFailDeg: number
  torsoLeanFailMinFrames: number
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
  trackingQualityMin: 0.28,
  torsoLeanWarnDeg: 35,
  torsoLeanFailDeg: 50,
  torsoLeanFailMinFrames: 3,
  symmetryWarnDeg: 18,
  symmetryFailDeg: 28,
  symmetryFailMinFrames: 3,
  topRangeMinDeg: 90
}

export const REALTIME_DEFAULT_BENT_OVER_ROW_TEMPO: BentOverRowTempo = {
  repFastSec: 0.8,
  repSlowSec: 3.0
}

export const VIDEO_DEFAULT_BENT_OVER_ROW_TEMPO: BentOverRowTempo = {
  repFastSec: 0.85,
  repSlowSec: 3.5
}

type NamedKeypoints = Record<MoveNetName, MoveNetKeypoint | undefined>

export class RealtimeBentOverRowAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private unassessedCount = 0
  private rangeMissCount = 0
  private symmetryCount = 0
  private torsoLeanCount = 0
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
  private repMinTorsoAngle = 180
  private repTorsoHardFrames = 0
  private repPeakSymmetryGap = 0
  private repSymmetryHardFrames = 0
  private repMaxRowAngle = 0
  private repDurationTotalSec = 0
  private repDurationCount = 0
  private fastRepCount = 0
  private slowRepCount = 0
  private viewInvalidRepCount = 0
  private analyzerFps = DEFAULT_NATIVE_ANALYZER_FPS
  private tuning: BentOverRowTuning = { ...DEFAULT_BENT_OVER_ROW_TUNING }
  private tempo: BentOverRowTempo = { ...REALTIME_DEFAULT_BENT_OVER_ROW_TEMPO }

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

    const midShoulder = this.midpoint(lShoulder, rShoulder)
    const midHip = this.midpoint(lHip, rHip)

    const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist)
    const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist)
    const elbowAngleRaw = this.avgNumber(leftElbowAngle, rightElbowAngle)

    const leftRowAngle = this.rowAngleDeg(lShoulder, lElbow, lHip)
    const rightRowAngle = this.rowAngleDeg(rShoulder, rElbow, rHip)
    const rowAngle = this.avgNumber(leftRowAngle, rightRowAngle)

    const symmetryGap = leftRowAngle !== null && rightRowAngle !== null ? Math.abs(leftRowAngle - rightRowAngle) : null
    const torsoAngle = this.angleFromHorizontalDeg(midShoulder, midHip)
    const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder)
    const trackingQuality = this.trackingQuality(map)

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: MoveNetName[] }> = []

    const isCountingPaused =
      trackingQuality < this.tuning.trackingQualityMin || elbowAngleRaw === null || torsoAngle === null || frontAlignment === null

    const frontViewBad = frontAlignment !== null && frontAlignment < NATIVE_FRONT_VIEW_OK_ANGLE
    if (frontViewBad) warnings.push('Face the camera so both arms remain visible for row tracking.')
    if (trackingQuality < 0.45) warnings.push('Low keypoint confidence. Improve lighting and keep shoulders, elbows, wrists, and hips visible.')
    if (torsoAngle !== null && torsoAngle > this.tuning.torsoLeanWarnDeg) {
      issues.push({ message: 'Excessive torso lean detected', joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] })
    }
    if (symmetryGap !== null && symmetryGap > this.tuning.symmetryWarnDeg) {
      issues.push({ message: 'Pull both arms evenly to improve symmetry.', joints: ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow'] })
    }

    const nextState = isCountingPaused ? this.currentState : this.detectState({ elbowAngle: elbowAngleRaw, symmetryGap })
    this.updateState(nextState, {
      isCountingPaused,
      elbowAngle: elbowAngleRaw,
      rowAngle,
      torsoAngle,
      symmetryGap,
      frontViewBad
    })

    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
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
  }

  resetSession() {
    this.repCount = 0
    this.correctCount = 0
    this.incorrectCount = 0
    this.unassessedCount = 0
    this.rangeMissCount = 0
    this.symmetryCount = 0
    this.torsoLeanCount = 0
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
    this.repMinTorsoAngle = 180
    this.repTorsoHardFrames = 0
    this.repPeakSymmetryGap = 0
    this.repSymmetryHardFrames = 0
    this.repMaxRowAngle = 0
    this.repDurationTotalSec = 0
    this.repDurationCount = 0
    this.fastRepCount = 0
    this.slowRepCount = 0
    this.viewInvalidRepCount = 0
  }

  private updateState(
    nextState: 's1' | 's2' | 's3' | null,
    input: {
      isCountingPaused: boolean
      elbowAngle: number | null
      rowAngle: number | null
      torsoAngle: number | null
      symmetryGap: number | null
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
      this.repMinTorsoAngle = 180
      this.repTorsoHardFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMaxRowAngle = 0
    }

    this.frameCount += 1
    if (!input.isCountingPaused) this.repValidFrameCount += 1
    if (!input.isCountingPaused && input.frontViewBad) this.repFrontBadFrames += 1
    if (!input.isCountingPaused && typeof input.torsoAngle === 'number' && Number.isFinite(input.torsoAngle)) {
      this.repMinTorsoAngle = Math.min(this.repMinTorsoAngle, input.torsoAngle)
      if (input.torsoAngle >= this.tuning.torsoLeanFailDeg) this.repTorsoHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.symmetryGap === 'number' && Number.isFinite(input.symmetryGap) && input.symmetryGap > 0) {
      this.repPeakSymmetryGap = Math.max(this.repPeakSymmetryGap, input.symmetryGap)
      if (input.symmetryGap >= this.tuning.symmetryFailDeg) this.repSymmetryHardFrames += 1
    }
    if (!input.isCountingPaused && typeof input.rowAngle === 'number' && Number.isFinite(input.rowAngle)) {
      this.repMaxRowAngle = Math.max(this.repMaxRowAngle, input.rowAngle)
    }

    if (nextState === 's3') this.enteredTop = true

    if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
      const enoughFrames = this.frameCount >= NATIVE_REP_COUNT_MIN_FRAMES
      if (!enoughFrames) {
        this.lastRepResult = null
        this.lastRepMessage = 'Rep ignored: movement was too short to count.'
        this.lastRepReasonCodes = ['REP_TOO_SHORT']
        this.lastRepReasonLabels = ['Movement was too short to count']
        this.lastRepCorrections = ['Pull the dumbbells to your hips, pause briefly, then lower under control.']
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
          tempoTooFast ? 'Slow down: pull under control, brief pause, then lower slowly.' : 'Keep control, but avoid long stalls; use a smoother continuous rhythm.'
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
        this.repValidFrameCount >= NATIVE_REP_VALID_MIN_FRAMES && validRatio >= NATIVE_REP_VALID_RATIO_MIN && frontBadRatio <= NATIVE_FRONT_VIEW_FAIL_RATIO

      this.repCount += 1
      this.repDurationTotalSec += repDurationSec
      this.repDurationCount += 1
      if (frontBadRatio > NATIVE_FRONT_VIEW_FAIL_RATIO) this.viewInvalidRepCount += 1

      if (!assessable) {
        this.unassessedCount += 1
        this.lastRepResult = null
        this.lastRepMessage = 'Rep counted, but quality was not assessed due to unstable or incomplete keypoints.'
        this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE']
        this.lastRepReasonLabels = ['Keypoints were incomplete']
        this.lastRepCorrections = ['Improve lighting and keep shoulders, elbows, wrists, and hips visible.']
      } else {
        const rangeInsufficient = this.repMaxRowAngle < this.tuning.topRangeMinDeg
        const torsoLeanFailed =
          this.repMinTorsoAngle <= this.tuning.torsoLeanFailDeg && this.repTorsoHardFrames >= this.tuning.torsoLeanFailMinFrames
        const symmetryFailed =
          this.repPeakSymmetryGap >= this.tuning.symmetryFailDeg && this.repSymmetryHardFrames >= this.tuning.symmetryFailMinFrames

        if (rangeInsufficient || torsoLeanFailed || symmetryFailed) {
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
            reasonLabels.push('Excessive torso lean detected')
            corrections.push('Keep your back flat and hips square. Avoid rounding or excessive lean.')
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

      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredTop = false
      this.repValidFrameCount = 0
      this.repFrontBadFrames = 0
      this.repMinTorsoAngle = 180
      this.repTorsoHardFrames = 0
      this.repPeakSymmetryGap = 0
      this.repSymmetryHardFrames = 0
      this.repMaxRowAngle = 0
    }

    this.currentState = nextState
  }

  private detectState(input: { elbowAngle: number | null; symmetryGap: number | null }): 's1' | 's2' | 's3' | null {
    const elbowAngle = input.elbowAngle
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

  private stateToPhase(state: 's1' | 's2' | 's3' | null): RealtimeFeedback['phase'] {
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

