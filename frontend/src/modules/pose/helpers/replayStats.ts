import type { PoseAnalyzerFeedback } from '../analyzer/types'
import type { MoveNetKeypoint } from '../vision/movenetTracker'
import { collectFrameIssueMessages } from './feedbackIssues'
import type { ExerciseSlug, PoseVideoAnalyzer, SquatRepFinding, SquatTimelineRow } from './types'
import { mapPoseFeedbackMessage, poseTierRank } from '../reporting/copy'

export type AnalyzerReplayStats = {
  lastFeedback: PoseAnalyzerFeedback | null
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
  analyzer: PoseVideoAnalyzer
  exerciseSlug: ExerciseSlug
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): AnalyzerReplayStats {
  let lastFeedback: PoseAnalyzerFeedback | null = null
  let analyzedFrameCount = 0
  let lastRepCount = 0
  let lastRepFrame = 0
  let lastRepTms = 0
  const repWindowMessageEntries: Array<{ message: string; tMs: number }> = []
  const messageFreq = new Map<string, number>()
  const messageFirstSeenMs = new Map<string, number>()
  const messageEventCount = new Map<string, number>()
  const messageLastEventMs = new Map<string, number>()
  const messageSeenMomentsMs = new Map<string, number[]>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const repFindings: SquatRepFinding[] = []
  const total = input.nativeFrames.length
  const recentlyUsedPrimaryIssues: string[] = []
  const MAX_RECENT_ISSUES = 4

  for (let i = 0; i < input.nativeFrames.length; i++) {
    const frame = input.nativeFrames[i]!
    if (frame.keypoints?.length) {
      const feedback = input.analyzer.analyzeNative(frame.keypoints)
      lastFeedback = feedback
      analyzedFrameCount += 1
      if (Number.isFinite(feedback.trackingQuality)) trackingQualitySamples.push(feedback.trackingQuality)

      const frameMessages = collectFrameIssueMessages(feedback)
      for (const message of frameMessages) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
        if (!messageFirstSeenMs.has(text)) messageFirstSeenMs.set(text, frame.tMs)
        recordMessageMoment(text, frame.tMs, messageEventCount, messageLastEventMs, messageSeenMomentsMs)
      }
      for (const msg of frameMessages) {
        const text = msg.trim()
        if (text) repWindowMessageEntries.push({ message: text, tMs: frame.tMs })
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
        const repIgnoredMessage = typeof feedback.lastRepMessage === 'string' ? feedback.lastRepMessage.trim() : ''
        const repIgnoredLower = repIgnoredMessage.toLowerCase()
        const incompleteCodes = new Set([
          'DEPTH_INSUFFICIENT',
          'TOP_RANGE_INSUFFICIENT',
          'RANGE_TOO_SMALL',
          'MOVE_TOO_SMALL',
          'ROW_RANGE_INSUFFICIENT'
        ])
        const hasIncompleteCode = (feedback.lastRepReasonCodes ?? []).some((code) => incompleteCodes.has(code))
        const incompleteByText =
          repIgnoredLower.startsWith('rep ignored') &&
          (repIgnoredLower.includes('depth') ||
            repIgnoredLower.includes('range of motion') ||
            repIgnoredLower.includes('range') ||
            repIgnoredLower.includes('arms did not reach') ||
            repIgnoredLower.includes('movement was too small'))
        const tags = repIgnoredLower.startsWith('rep ignored') && (hasIncompleteCode || incompleteByText) ? ['Incomplete'] : undefined
        const repWindowEntries = [...repWindowMessageEntries]
        const repTierFromWindow =
          pickRepTierFromWindow(input.exerciseSlug, repWindowEntries, recentlyUsedPrimaryIssues)
        const positiveLabels = [
          'Looks good.',
          'Good rep.',
          'Nice rep.',
          'Good control.',
          'Keep going.'
        ]
        const repEndTms = frame.tMs
        const resolvedPrimaryIssue = resolvePrimaryIssue({
          result,
          repTierFromWindow,
          reasons,
          lastRepMessage: feedback.lastRepMessage,
          correctCount: repFindings.filter((f) => f.result === 'correct').length,
          positiveLabels,
          exerciseSlug: input.exerciseSlug,
          recentlyUsed: recentlyUsedPrimaryIssues,
          repWindowEntries,
          repEndTms
        })
        const primaryIssue = resolvedPrimaryIssue.message
        const issueTms = resolvedPrimaryIssue.tMs
        if (primaryIssue) {
          updateRecentIssues(recentlyUsedPrimaryIssues, primaryIssue, MAX_RECENT_ISSUES)
        }
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
                    : resolvedPrimaryIssue.tier,
            primaryIssue: repIndex < delta ? 'Rep detected (details unavailable)' : primaryIssue,
            reasons: repIndex < delta ? [] : reasons,
            tags: repIndex < delta ? undefined : tags,
            atFrame: estFrame,
            tMs: repIndex < delta ? estTms : issueTms
          })
        }
        lastRepCount = feedback.repCount
        lastRepFrame = i
        lastRepTms = frame.tMs
        repWindowMessageEntries.length = 0
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

type RepWindowPick = { tier: 'warning' | 'issue' | 'rep_fail' | 'gate'; message: string; tMs: number } | null

function pickRepTierFromWindow(
  exerciseSlug: ExerciseSlug,
  entries: Array<{ message: string; tMs: number }>,
  recentlyUsed: string[] = []
): RepWindowPick {
  const freq = new Map<string, number>()
  const firstTms = new Map<string, number>()
  for (const entry of entries) {
    const text = entry.message.trim()
    if (!text) continue
    const lower = text.toLowerCase()
    if (lower.startsWith('rep completed') || lower.startsWith('rep counted') || lower.startsWith('rep passed') || lower.startsWith('rep ignored')) {
      continue
    }
    freq.set(text, (freq.get(text) ?? 0) + 1)
    if (!firstTms.has(text)) firstTms.set(text, entry.tMs)
  }

  const scored = Array.from(freq.entries())
    .map(([message, count]) => {
      const human = mapPoseFeedbackMessage({ exerciseSlug, message })
      return { message, count, tier: human.tier, rank: poseTierRank(human.tier), tMs: firstTms.get(message) ?? 0 }
    })
    .filter((x) => x.tier !== 'gate')

  if (scored.length === 0) return null

  const recentlyUsedSet = new Set(recentlyUsed.slice(-4))
  const freshCandidates = scored.filter((x) => !recentlyUsedSet.has(x.message))
  const candidatePool = freshCandidates.length > 0 ? freshCandidates : scored

  candidatePool.sort((a, b) => {
    const diff = b.rank - a.rank
    if (diff !== 0) return diff
    return b.count - a.count
  })

  const best = candidatePool[0]
  if (!best) return null
  return { tier: best.tier, message: best.message, tMs: best.tMs }
}

type ResolvedIssue = { message: string; tier: 'gate' | 'warning' | 'issue' | 'rep_fail'; tMs: number }

function resolvePrimaryIssue(args: {
  result: SquatRepFinding['result']
  repTierFromWindow: RepWindowPick
  reasons: string[]
  lastRepMessage: string | null
  correctCount: number
  positiveLabels: string[]
  exerciseSlug: ExerciseSlug
  recentlyUsed: string[]
  repWindowEntries: Array<{ message: string; tMs: number }>
  repEndTms: number
}): ResolvedIssue {
  const { result, repTierFromWindow, reasons, lastRepMessage, correctCount, positiveLabels, exerciseSlug, recentlyUsed, repWindowEntries, repEndTms } = args

  const findMessageTms = (target: string): number => {
    for (let i = repWindowEntries.length - 1; i >= 0; i--) {
      if (repWindowEntries[i]!.message.trim() === target) return repWindowEntries[i]!.tMs
    }
    return repEndTms
  }

  const findFirstMessageTms = (target: string): number => {
    for (let i = 0; i < repWindowEntries.length; i++) {
      if (repWindowEntries[i]!.message.trim() === target) return repWindowEntries[i]!.tMs
    }
    return repEndTms
  }

  if (result === 'incorrect') {
    const formReasons = reasons.filter((r) => {
      const human = mapPoseFeedbackMessage({ exerciseSlug, message: r })
      return human.tier !== 'gate'
    })
    if (formReasons.length > 0) {
      const scored = formReasons.map((msg) => {
        const lower = msg.toLowerCase()
        const human = mapPoseFeedbackMessage({ exerciseSlug, message: msg })
        const baseScore =
          exerciseSlug === 'bent-over-row' && lower.includes('knees were too straight')
            ? 100
            : lower.includes('knees were too straight')
              ? 80
              : exerciseSlug === 'bent-over-row' && lower.includes('arms did not pull close enough to hips')
                ? 70
                : lower.includes('arms did not pull close enough to hips')
                  ? 50
                  : lower.includes('torso became too upright')
                    ? 40
                    : lower.includes('arms were not pulled evenly')
                      ? 30
                      : 10
        const freshBonus = recentlyUsed.includes(human.label) ? 0 : 25
        const squatBalanceBonus =
          exerciseSlug === 'squat' && (lower.includes('torso leaned too far forward') || lower.includes('excessive forward torso lean'))
            ? 10
            : 0
        return { msg, human, score: baseScore + freshBonus + squatBalanceBonus }
      })
      scored.sort((a, b) => b.score - a.score)
      const pick = scored[0]
      if (pick) return { message: pick.human.label, tier: pick.human.tier, tMs: findFirstMessageTms(pick.msg) }
    }
  }

  if (result === 'correct') {
    if (repTierFromWindow && repTierFromWindow.tier === 'warning') {
      const human = mapPoseFeedbackMessage({ exerciseSlug, message: repTierFromWindow.message })
      return { message: human.label, tier: 'warning', tMs: repTierFromWindow.tMs }
    }
    const msg = positiveLabels[correctCount % positiveLabels.length]!
    return { message: msg, tier: 'gate', tMs: repEndTms }
  }

  if (repTierFromWindow) {
    return { message: repTierFromWindow.message, tier: repTierFromWindow.tier, tMs: repTierFromWindow.tMs }
  }

  const formReasons = reasons.filter((r) => {
    const human = mapPoseFeedbackMessage({ exerciseSlug, message: r })
    return human.tier !== 'gate'
  })

  if (formReasons.length > 0) {
    const freshReasons = formReasons.filter((r) => !recentlyUsed.includes(r))
    const pick = freshReasons.length > 0 ? freshReasons[0]! : formReasons[0]!
    const human = mapPoseFeedbackMessage({ exerciseSlug, message: pick })
    const tMs = findMessageTms(pick)
    return { message: human.label, tier: human.tier, tMs }
  }

  if (lastRepMessage) {
    const human = mapPoseFeedbackMessage({ exerciseSlug, message: lastRepMessage })
    if (human.tier !== 'gate') {
      return { message: human.label, tier: human.tier, tMs: repEndTms }
    }
  }

  if (reasons.length > 0) {
    const human = mapPoseFeedbackMessage({ exerciseSlug, message: reasons[0]! })
    const tMs = findMessageTms(reasons[0]!)
    return { message: human.label, tier: result === 'incorrect' ? 'rep_fail' : 'gate', tMs }
  }

  if (result === 'incorrect') {
    return { message: 'Rep did not pass form check — focus on correcting the main issue.', tier: 'rep_fail', tMs: repEndTms }
  }

  return {
    message: 'This rep couldn\'t be scored — try better lighting, keep your full body in frame, and ensure a steady camera angle.',
    tier: 'gate',
    tMs: repEndTms
  }
}

function updateRecentIssues(recentlyUsed: string[], message: string, maxSize: number) {
  const idx = recentlyUsed.indexOf(message)
  if (idx >= 0) recentlyUsed.splice(idx, 1)
  recentlyUsed.push(message)
  while (recentlyUsed.length > maxSize) recentlyUsed.shift()
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
