import type { RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import type { ExerciseSlug, SquatRepFinding } from './types'
import { mapSuggestionFromIssue } from './suggestionMap'

export function evaluateRangeCheck(feedback: RealtimeFeedback | null, exerciseSlug: ExerciseSlug) {
  if (!feedback) return { ok: false, reason: 'Waiting for stable tracking' }
  if (feedback.lastRepReasonLabels.length > 0) {
    return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' }
  }
  if (feedback.issues.length > 0) {
    return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.torsoAngle === 'number' && feedback.torsoAngle > 35) {
    return { ok: false, reason: 'Excessive forward lean' }
  }
  if (exerciseSlug === 'lateral-raise' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle >= 60) {
    return { ok: true, reason: 'Raise height reached' }
  }
  if (
    (exerciseSlug === 'pushup' || exerciseSlug === 'pullup') &&
    typeof feedback.kneeAngle === 'number' &&
    feedback.kneeAngle <= 95
  ) {
    return {
      ok: true,
      reason: exerciseSlug === 'pushup' ? 'Push-up depth reached' : 'Top position reached'
    }
  }
  if (exerciseSlug === 'squat' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
    return { ok: true, reason: 'Depth reached' }
  }
  return { ok: true, reason: 'Current rep is in range' }
}

export function getSessionComment(accuracyPct: number, reps: number, exerciseSlug: ExerciseSlug) {
  if (reps <= 0) {
    return exerciseSlug === 'lateral-raise'
      ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
      : exerciseSlug === 'pushup'
        ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
        : exerciseSlug === 'pullup'
          ? 'No completed reps were detected. Pull with full range and lower under control.'
          : 'No completed reps were detected. Try a full-depth squat with a steady tempo.'
  }
  if (accuracyPct >= 90) return 'Excellent consistency. Keep the same depth and tempo in your next set.'
  if (accuracyPct >= 75) return 'Good overall form. Focus on the repeated issues to improve consistency.'
  if (accuracyPct >= 50) return 'Mixed quality set. Slow down and prioritize controlled reps.'
  return 'Form is not stable yet. Reduce speed and focus on one correction cue at a time.'
}

export function getTopIssues(snapshot: RealtimeFeedback | null) {
  if (!snapshot) return []
  const raw = [...(snapshot.lastRepReasonLabels ?? []), ...(snapshot.issues?.map((x) => x.message) ?? []), ...(snapshot.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(normalized)
    if (deduped.length >= 2) break
  }
  return deduped
}

export function getTopRepIssuesFromFindings(findings: SquatRepFinding[], limit = 2) {
  if (!Array.isArray(findings) || findings.length === 0) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of findings) {
    if (item.result !== 'incorrect') continue
    const candidates = item.reasons.length > 0 ? item.reasons : [item.primaryIssue]
    for (const reason of candidates) {
      const text = reason.trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      out.push(text)
      if (out.length >= Math.max(1, limit)) return out
    }
  }
  return out
}

export function getTopIssuesFromMessageFreq(messageFreq: Map<string, number>, limit = 2) {
  return Array.from(messageFreq.entries())
    .filter(([message, count]) => !!message.trim() && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([message]) => message)
}

export function collectLiveIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.lastRepReasonLabels ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

export function collectLiveFrameIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

export function buildLiveSuggestions(feedback: RealtimeFeedback | null, fallbackSuggestion: string, exerciseSlug: ExerciseSlug) {
  const suggestions = new Set<string>()
  const messages = collectLiveIssueMessages(feedback)
  for (const message of messages) {
    const mapped = mapSuggestionFromIssue(message, exerciseSlug)
    if (mapped) suggestions.add(mapped)
  }
  if (suggestions.size === 0 && fallbackSuggestion.trim()) suggestions.add(fallbackSuggestion.trim())
  if (suggestions.size === 0) {
    suggestions.add(
      exerciseSlug === 'lateral-raise'
        ? 'Keep your movement controlled and face the camera for balanced left-right tracking.'
        : exerciseSlug === 'pushup'
          ? 'Keep your core tight and move through a full push-up range with controlled tempo.'
          : exerciseSlug === 'pullup'
            ? 'Use a steady pull-up tempo and avoid body swing during both ascent and descent.'
            : 'Keep your movement controlled and maintain a stable side-view camera angle.'
    )
  }
  return Array.from(suggestions).slice(0, 4)
}

