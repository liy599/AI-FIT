import type { RealtimeFeedback } from '../analyzer/types'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectLiveFrameIssueMessages } from './live'
import type { RealtimeAnalyzer, SquatRepFinding, SquatTimelineRow } from './types'

export type AnalyzerReplayStats = {
  lastFeedback: RealtimeFeedback | null
  analyzedFrameCount: number
  messageFreq: Map<string, number>
  messageFirstSeenMs: Map<string, number>
  messageEventCount: Map<string, number>
  messageSeenMomentsMs: Map<string, number[]>
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
  repFindings: SquatRepFinding[]
}

export function collectAnalyzerReplayStats(input: {
  analyzer: RealtimeAnalyzer
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): AnalyzerReplayStats {
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  let lastRepCount = 0
  const messageFreq = new Map<string, number>()
  const messageFirstSeenMs = new Map<string, number>()
  const messageEventCount = new Map<string, number>()
  const messageLastEventMs = new Map<string, number>()
  const messageSeenMomentsMs = new Map<string, number[]>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  const total = input.nativeFrames.length

  for (let i = 0; i < input.nativeFrames.length; i++) {
    const frame = input.nativeFrames[i]!
    if (frame.keypoints?.length) {
      const feedback = input.analyzer.analyzeNative(frame.keypoints)
      lastFeedback = feedback
      analyzedFrameCount += 1
      if (Number.isFinite(feedback.trackingQuality)) trackingQualitySamples.push(feedback.trackingQuality)

      for (const message of collectLiveFrameIssueMessages(feedback)) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
        if (!messageFirstSeenMs.has(text)) messageFirstSeenMs.set(text, frame.tMs)
        recordMessageMoment(text, frame.tMs, messageEventCount, messageLastEventMs, messageSeenMomentsMs)
      }

      timelineRows.push({
        frame: i,
        tMs: frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle
      })

      if (feedback.repCount > lastRepCount) {
        const result: SquatRepFinding['result'] =
          feedback.lastRepResult === 'correct' ? 'correct' : feedback.lastRepResult === 'incorrect' ? 'incorrect' : 'invalid'
        const reasons = feedback.lastRepReasonLabels.length > 0 ? [...feedback.lastRepReasonLabels] : []
        const primaryIssue =
          reasons[0] ??
          feedback.lastRepMessage ??
          (result === 'correct' ? 'Rep passed quality check.' : 'Rep was counted but not valid for quality scoring.')
        for (let repNo = lastRepCount + 1; repNo <= feedback.repCount; repNo++) {
          repFindings.push({
            repNumber: repNo,
            result,
            primaryIssue,
            reasons,
            atFrame: i,
            tMs: frame.tMs
          })
        }
        lastRepCount = feedback.repCount
      }
    }

    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.nativeFrames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }

  return {
    lastFeedback,
    analyzedFrameCount,
    messageFreq,
    messageFirstSeenMs,
    messageEventCount,
    messageSeenMomentsMs,
    trackingQualitySamples,
    timelineRows,
    repFindings
  }
}

function recordMessageMoment(
  message: string,
  tMs: number,
  messageEventCount: Map<string, number>,
  messageLastEventMs: Map<string, number>,
  messageSeenMomentsMs: Map<string, number[]>,
  debounceMs = 1000
) {
  const prev = messageLastEventMs.get(message)
  if (prev !== undefined && tMs - prev < debounceMs) return

  messageEventCount.set(message, (messageEventCount.get(message) ?? 0) + 1)
  messageLastEventMs.set(message, tMs)
  const existing = messageSeenMomentsMs.get(message)
  if (existing) existing.push(tMs)
  else messageSeenMomentsMs.set(message, [tMs])
}
