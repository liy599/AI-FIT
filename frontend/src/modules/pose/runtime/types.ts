import type { MoveNetNativeFrame } from '../vision/movenetPose'
import type { DistanceState } from '../vision/distanceTracker'

export type OfflineProgress = { stage: string; processed: number; total: number } | null

export type OfflineOverlayTone = 'ok' | 'warn' | 'bad'
export type OfflineOverlayFrame = {
  tMs: number
  tone: OfflineOverlayTone
  message: string | null
  gateHint?: string | null
  mainHint?: string | null
  distance: DistanceState | null
}
export type OfflineReplayData = { fps: number; nativeFrames: MoveNetNativeFrame[]; overlayFrames: OfflineOverlayFrame[] }
