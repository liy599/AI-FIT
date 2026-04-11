import type { PoseAnalysisReport } from '../report'
import type { PoseExerciseSlug } from '../exercises'
import type { RealtimeFeedback } from '../realtimeSquat'

export function evaluateRangeCheck(feedback: RealtimeFeedback | null, exerciseSlug: PoseExerciseSlug) {
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
    (exerciseSlug === 'pushup' || exerciseSlug === 'pullup' || exerciseSlug === 'bench-press') &&
    typeof feedback.kneeAngle === 'number' &&
    feedback.kneeAngle <= 95
  ) {
    return {
      ok: true,
      reason: exerciseSlug === 'pushup' ? 'Push-up depth reached' : exerciseSlug === 'pullup' ? 'Top position reached' : 'Bench depth reached'
    }
  }
  if (exerciseSlug === 'squat' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
    return { ok: true, reason: 'Depth reached' }
  }
  return { ok: true, reason: 'Current rep is in range' }
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getSessionComment(accuracyPct: number, reps: number, exerciseSlug: PoseExerciseSlug) {
  if (reps <= 0) {
    return exerciseSlug === 'lateral-raise'
      ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
      : exerciseSlug === 'pushup'
        ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
        : exerciseSlug === 'pullup'
          ? 'No completed reps were detected. Pull with full range and lower under control.'
          : exerciseSlug === 'bench-press'
            ? 'No completed reps were detected. Lower to stable depth and press with a controlled path.'
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

export function getRepsFromReport(report: PoseAnalysisReport) {
  const keyMetrics = (report as unknown as Record<string, unknown>).keyMetrics
  if (keyMetrics && typeof keyMetrics === 'object' && !Array.isArray(keyMetrics)) {
    const totalReps = (keyMetrics as Record<string, unknown>).totalReps
    if (typeof totalReps === 'number' && Number.isFinite(totalReps) && totalReps >= 0) return Math.max(0, Math.round(totalReps))
  }
  const repCount = (report as unknown as Record<string, unknown>).repCount
  if (typeof repCount === 'number' && Number.isFinite(repCount) && repCount >= 0) return Math.max(0, Math.round(repCount))
  return 0
}

