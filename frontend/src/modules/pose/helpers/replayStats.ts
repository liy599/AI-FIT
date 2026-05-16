import type { RealtimeFeedback } from '../analyzer/types'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectLiveFrameIssueMessages } from './live'
import type { ExerciseSlug, RealtimeAnalyzer, SquatRepFinding, SquatTimelineRow } from './types'
import { mapPoseFeedbackMessage, poseTierRank } from '../reporting/copy'

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
  exerciseSlug: ExerciseSlug
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): AnalyzerReplayStats {
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  let lastRepCount = 0
  let lastRepFrame = 0
  let lastRepTms = 0
  const repWindowMessages: string[] = []
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

      const frameMessages = collectLiveFrameIssueMessages(feedback)
      for (const message of frameMessages) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
        if (!messageFirstSeenMs.has(text)) messageFirstSeenMs.set(text, frame.tMs)
        recordMessageMoment(text, frame.tMs, messageEventCount, messageLastEventMs, messageSeenMomentsMs)
      }
      for (const msg of frameMessages) {
        const text = msg.trim()
        if (text) repWindowMessages.push(text)
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
        const repTierFromWindow =
          result === 'correct' ? pickRepTierFromWindow(input.exerciseSlug, repWindowMessages) : null
        const primaryIssue =
          result === 'correct'
            ? repTierFromWindow?.message ?? feedback.lastRepMessage ?? 'Rep passed quality check.'
            : reasons[0] ?? feedback.lastRepMessage ?? 'Rep was counted but not valid for quality scoring.'
        const delta = Math.max(1, feedback.repCount - lastRepCount)
        const prevFrame = lastRepCount > 0 ? lastRepFrame : 0
        const prevTms = lastRepCount > 0 ? lastRepTms : 0
        const frameSpan = Math.max(1, i - prevFrame)
        const tSpan = Math.max(0, frame.tMs - prevTms)
        for (let repIndex = 1; repIndex <= delta; repIndex++) {
          const repNo = lastRepCount + repIndex
          const ratio = delta <= 1 ? 1 : repIndex / delta
          const estFrame = repIndex < delta ? prevFrame + Math.round(frameSpan * ratio) : i
          const estTms = repIndex < delta ? prevTms + tSpan * ratio : frame.tMs
          repFindings.push({
            repNumber: repNo,
            result: repIndex < delta ? 'invalid' : result,
            tier:
              repIndex < delta
                ? 'gate'
                : result === 'incorrect'
                  ? 'rep_fail'
                  : result === 'invalid'
                    ? 'gate'
                    : repTierFromWindow?.tier,
            primaryIssue: repIndex < delta ? 'Rep detected (details unavailable)' : primaryIssue,
            reasons: repIndex < delta ? [] : reasons,
            atFrame: estFrame,
            tMs: estTms
          })
        }
        lastRepCount = feedback.repCount
        lastRepFrame = i
        lastRepTms = frame.tMs
        repWindowMessages.length = 0
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

function pickRepTierFromWindow(
  exerciseSlug: ExerciseSlug,
  messages: string[]
): { tier: 'warning' | 'issue' | 'rep_fail' | 'gate'; message: string } | null {
  const freq = new Map<string, number>()
  for (const msg of messages) {
    const text = msg.trim()
    if (!text) continue
    const lower = text.toLowerCase()
    if (lower.startsWith('rep completed') || lower.startsWith('rep counted') || lower.startsWith('rep passed') || lower.startsWith('rep ignored')) {
      continue
    }
    freq.set(text, (freq.get(text) ?? 0) + 1)
  }

  const scored = Array.from(freq.entries())
    .map(([message, count]) => {
      const human = mapPoseFeedbackMessage({ exerciseSlug, message })
      return { message, count, tier: human.tier, rank: poseTierRank(human.tier) }
    })
    .filter((x) => x.tier !== 'gate')
    .sort((a, b) => {
      const diff = b.rank - a.rank
      if (diff !== 0) return diff
      return b.count - a.count
    })

  const best = scored[0]
  if (!best) return null
  return { tier: best.tier, message: best.message }
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
