import type { NormalizedLandmark } from './mediapipePose'
import { buildPoseFrame, type PoseFrame } from './poseFrame'

export class PoseMetricTracker {
  private last: PoseFrame | null = null
  private window: PoseFrame[] = []
  private windowMs: number

  constructor(opts?: { stabilityWindowMs?: number }) {
    this.windowMs = opts?.stabilityWindowMs ?? 900
  }

  update(landmarks: NormalizedLandmark[], tsMs: number) {
    const frame = buildPoseFrame(landmarks, tsMs, {
      prev: this.last,
      stabilityWindow: this.window,
      stabilityWindowMs: this.windowMs
    })
    this.last = frame
    this.window.push(frame)
    const cutoff = tsMs - this.windowMs
    while (this.window.length > 0 && this.window[0]!.tsMs < cutoff) this.window.shift()
    return frame
  }

  reset() {
    this.last = null
    this.window = []
  }
}
