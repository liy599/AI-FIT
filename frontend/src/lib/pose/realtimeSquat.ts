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
    depthInsufficientCount: number
    kneeOverToeCount: number
    forwardLeanCount: number
    backwardLeanCount: number
    sideViewWarningCount: number
  }
}

const LM = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, footIndex: 31, nose: 0, rShoulder: 12 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, footIndex: 32, nose: 0, rShoulder: 11 }
}

export class RealtimeSquatAnalyzer {
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
    const trackingQuality = this.avgVisibility(landmarks, [11, 12, 23, 24, 25, 26, 27, 28])

    const warnings: string[] = []
    const issues: Array<{ message: string; joints: number[] }> = []
    const isCountingPaused = trackingQuality < 0.45 || kneeVerticalAngle === null || torsoAngle === null
    const nextState = isCountingPaused ? this.currentState : this.detectState(kneeAngle)

    if (offsetAngle !== null && offsetAngle > 55) {
      warnings.push('请尽量保持侧面对镜头，识别会更稳定。')
    }
    if (trackingQuality < 0.45) {
      warnings.push('关键点置信度较低，请站到画面中央并露出全身。')
    }
    if (torsoAngle !== null && torsoAngle < 20) {
      issues.push({ message: '躯干前倾较明显', joints: [11, 12, 23, 24] })
    }
    if (knee !== undefined && footIndex !== undefined && hip !== undefined && ankle !== undefined) {
      const dir = Math.sign((ankle.x - hip.x) || 1)
      const kneeOverToeRatio = (knee.x - footIndex.x) * dir
      if (kneeOverToeRatio > 0.06) issues.push({ message: '膝盖明显超过脚尖', joints: [idx.knee, idx.footIndex] })
    }

    this.updateState(nextState)
    const primaryIssue = issues[0]?.message ?? null
    const primaryWarn = warnings[0] ?? null

    return {
      phase: this.stateToPhase(nextState),
      state: nextState,
      mode: 'beginner',
      kneeAngle: kneeAngle ? Math.round(kneeAngle) : null,
      hipAngle: hipAngle ? Math.round(hipAngle) : null,
      torsoAngle: torsoAngle ? Math.round(torsoAngle) : null,
      kneeVerticalAngle: kneeVerticalAngle ? Math.round(kneeVerticalAngle) : null,
      offsetAngle: offsetAngle ? Math.round(offsetAngle) : null,
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
      this.lastRepMessage = '动作完成，继续保持节奏。'
      this.lastRepFrameCount = this.frameCount
      this.frameCount = 0
      this.enteredBottom = false
    }
    this.currentState = nextState
  }

  private detectState(kneeAngle: number | null): 's1' | 's2' | 's3' | null {
    if (kneeAngle === null) return null
    if (kneeAngle >= 155) return 's1'
    if (kneeAngle >= 95) return 's2'
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
    const dx = top.x - bottom.x
    const dy = top.y - bottom.y
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

