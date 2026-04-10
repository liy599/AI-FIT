import type { NormalizedLandmark } from './mediapipePose'
import type { RealtimeFeedback } from './realtimeSquat'

export class RealtimeBenchPressAnalyzer {
  private repCount = 0
  private correctCount = 0
  private incorrectCount = 0
  private currentState: 's1' | 's2' | 's3' | null = null
  private lastRepResult: 'correct' | 'incorrect' | null = null
  private lastRepMessage: string | null = null
  private lastRepFrameCount: number | null = null
  private enteredBottom = false
  private frameCount = 0

  analyze(landmarks: NormalizedLandmark[]): RealtimeFeedback {
    const side = this.chooseSide(landmarks)
    const shoulder = landmarks[side === 'right' ? 12 : 11]
    const elbow = landmarks[side === 'right' ? 14 : 13]
    const wrist = landmarks[side === 'right' ? 16 : 15]
    const hip = landmarks[side === 'right' ? 24 : 23]
    const knee = landmarks[side === 'right' ? 26 : 25]
    const ankle = landmarks[side === 'right' ? 28 : 27]
    const otherShoulder = landmarks[side === 'right' ? 11 : 12]

    const elbowAngle = this.angleDeg(shoulder, elbow, wrist)
    const bodyLineAngle = this.angleDeg(shoulder, hip, ankle)
    const torsoAngle = this.angleFromHorizontalDeg(shoulder, hip)
    const sideAlignment = this.sideAlignmentDeg(shoulder, otherShoulder)
    const trackingQuality = this.avgVisibility(landmarks, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const isCountingPaused = trackingQuality < 0.45 || elbowAngle === null
    const nextState = isCountingPaused ? this.currentState : this.detectState(elbowAngle)

    if (trackingQuality < 0.45) {
      warnings.push('Low keypoint confidence. Keep your full body in frame with better lighting.')
    }
    if (torsoAngle !== null && torsoAngle > 30) {
      issues.push({ message: 'Keep your torso stable and avoid excessive bridge.', joints: [11, 12, 23, 24] })
    }
    if (bodyLineAngle !== null && bodyLineAngle < 140) {
      warnings.push('Keep a stable setup and avoid leg drive that causes body sway.')
    }
    if (sideAlignment !== null && sideAlignment > 55) {
      warnings.push('Turn to a clearer side-view for more stable bench press tracking.')
    }

    this.updateState(nextState)
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
      offsetAngle: sideAlignment ? Math.round(sideAlignment) : null,
      trackingQuality: Math.round(trackingQuality * 100) / 100,
      isCountingPaused,
      warnings,
      issues,
      stateSequence: [],
      lastRepResult: this.lastRepResult,
      lastRepMessage: this.lastRepMessage ?? primaryIssue ?? primaryWarn,
      lastRepReasonCodes: [],
      lastRepReasonLabels: [],
      lastRepCorrections: [],
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
        depthInsufficientCount: 0,
        kneeOverToeCount: 0,
        forwardLeanCount: 0,
        backwardLeanCount: 0,
        sideViewWarningCount: 0
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
    this.enteredBottom = false
    this.frameCount = 0
  }

  private updateState(nextState: 's1' | 's2' | 's3' | null) {
    if (nextState === null) return
    this.frameCount += 1
    if (nextState === 's3') this.enteredBottom = true
    if (this.currentState !== 's1' && nextState === 's1' && this.enteredBottom) {
      this.repCount += 1
      this.correctCount += 1
      this.lastRepResult = 'correct'
      this.lastRepMessage = 'Rep completed. Keep your bar path controlled and wrists stacked.'
      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredBottom = false
    }
    this.currentState = nextState
  }

  private detectState(elbowAngle: number | null): 's1' | 's2' | 's3' | null {
    if (elbowAngle === null) return null
    if (elbowAngle >= 150) return 's1'
    if (elbowAngle >= 95) return 's2'
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
    for (const i of [11, 13, 15, 23, 25, 27]) leftVis += landmarks[i]?.visibility ?? 0
    for (const i of [12, 14, 16, 24, 26, 28]) rightVis += landmarks[i]?.visibility ?? 0
    return rightVis > leftVis ? 'right' : 'left'
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

  private angleFromHorizontalDeg(a?: NormalizedLandmark | null, b?: NormalizedLandmark | null): number | null {
    if (!a || !b) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const mag = Math.hypot(dx, dy)
    if (!mag) return null
    return Math.abs((Math.asin(dy / mag) * 180) / Math.PI)
  }

  private sideAlignmentDeg(shoulder?: NormalizedLandmark | null, otherShoulder?: NormalizedLandmark | null): number | null {
    if (!shoulder || !otherShoulder) return null
    const shoulderSpanX = Math.abs(shoulder.x - otherShoulder.x)
    const shoulderSpanY = Math.abs(shoulder.y - otherShoulder.y) + 1e-6
    return (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI
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
