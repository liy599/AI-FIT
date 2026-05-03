import type { MutableRefObject } from 'react'
import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import type { SquatRepFinding, SquatTimelineRow } from '../helpers'
import { collectLiveFrameIssueMessages } from '../helpers'

type LiveStatsRefs = {
  issueFreqRef: MutableRefObject<Map<string, number>>
  trackingQualitySamplesRef: MutableRefObject<number[]>
  timelineRowsRef: MutableRefObject<SquatTimelineRow[]>
  repFindingsRef: MutableRefObject<SquatRepFinding[]>
  lastRepCountRef: MutableRefObject<number>
  analyzedFrameCountRef: MutableRefObject<number>
}

type RecordLiveFrameStatsArgs = LiveStatsRefs & {
  exerciseSlug: string
  feedback: RealtimeFeedback
  frameTs: number
  liveTargetFrameMs: number
  sessionStartedPerf: number | null
}

const LIVE_STATS_EXERCISES = new Set(['squat', 'lateral-raise', 'bent-over-row'])

// Keep per-frame live statistics in one place so the page loop stays focused on
// camera IO, drawing, and state updates.
export function resetLiveStats(refs: LiveStatsRefs) {
  refs.issueFreqRef.current = new Map()
  refs.trackingQualitySamplesRef.current = []
  refs.timelineRowsRef.current = []
  refs.repFindingsRef.current = []
  refs.lastRepCountRef.current = 0
  refs.analyzedFrameCountRef.current = 0
}

export function recordLiveFrameStats(args: RecordLiveFrameStatsArgs) {
  if (!LIVE_STATS_EXERCISES.has(args.exerciseSlug)) return

  const nextFeedback = args.feedback
  args.analyzedFrameCountRef.current += 1
  if (Number.isFinite(nextFeedback.trackingQuality)) {
    args.trackingQualitySamplesRef.current.push(nextFeedback.trackingQuality)
  }

  for (const message of collectLiveFrameIssueMessages(nextFeedback)) {
    const text = message.trim()
    if (!text) continue
    args.issueFreqRef.current.set(text, (args.issueFreqRef.current.get(text) ?? 0) + 1)
  }

  const tMs = args.sessionStartedPerf
    ? Math.max(0, Math.round(args.frameTs - args.sessionStartedPerf))
    : Math.round(args.timelineRowsRef.current.length * args.liveTargetFrameMs)

  args.timelineRowsRef.current.push({
    frame: args.timelineRowsRef.current.length,
    tMs,
    phase: nextFeedback.phase,
    trackingQuality: nextFeedback.trackingQuality,
    kneeAngleDeg: nextFeedback.kneeAngle,
    hipAngleDeg: nextFeedback.hipAngle,
    torsoFromVerticalDeg: nextFeedback.torsoAngle
  })

  if (nextFeedback.repCount <= args.lastRepCountRef.current) return

  const result: SquatRepFinding['result'] =
    nextFeedback.lastRepResult === 'correct' ? 'correct' : nextFeedback.lastRepResult === 'incorrect' ? 'incorrect' : 'invalid'
  const reasons = nextFeedback.lastRepReasonLabels.length > 0 ? [...nextFeedback.lastRepReasonLabels] : []
  const primaryIssue =
    reasons[0] ??
    nextFeedback.lastRepMessage ??
    (result === 'correct' ? 'Rep passed quality check.' : 'Rep was counted but not valid for quality scoring.')

  for (let repNo = args.lastRepCountRef.current + 1; repNo <= nextFeedback.repCount; repNo++) {
    args.repFindingsRef.current.push({
      repNumber: repNo,
      result,
      primaryIssue,
      reasons,
      atFrame: args.timelineRowsRef.current.length - 1,
      tMs
    })
  }
  args.lastRepCountRef.current = nextFeedback.repCount
}


