import type { MoveNetNativeFrame } from '../../../lib/pose/movenetPose'
import type { SquatRepFinding, SquatTimelineRow } from '../helpers'

export type PoseToolMode = 'live' | 'offline'
export type OfflineProgress = { stage: string; processed: number; total: number } | null
export type LiveSessionStatus = 'idle' | 'running' | 'ended'
export type LiveSessionEndReason = 'manual' | 'timeout' | null

export type LiveSessionSummary = {
  durationSec: number
  reps: number
  correctReps: number
  incorrectReps: number
  accuracyPct: number
  sessionComment: string
  topIssues: string[]
}

export type OfflineOverlayTone = 'ok' | 'warn' | 'bad'
export type OfflineOverlayFrame = { tMs: number; tone: OfflineOverlayTone; message: string | null }
export type OfflineReplayData = { fps: number; nativeFrames: MoveNetNativeFrame[]; overlayFrames: OfflineOverlayFrame[] }

export type LiveDedicatedStats = {
  issueFreq: Map<string, number>
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  repFindings: SquatRepFinding[]
  lastRepCount: number
  analyzedFrameCount: number
}

