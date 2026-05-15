import { mapPoseFeedbackMessage } from '../../modules/pose/reporting'

export const TOP_ISSUE_TIME_DISPLAY = {
  maxMoments: 5,
  minGapMs: 1000
} as const

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    totalReps: 'Total Reps',
    effectiveReps: 'Effective',
    unassessedReps: 'Invalid',
    correctReps: 'Correct Reps',
    incorrectReps: 'Incorrect Reps',
    formAccuracyPct: 'Form Accuracy Rate',
    assessedRepPct: 'Assessed Rep Rate',
    sideViewInvalidReps: 'Invalid Reps (Side View)',
    effectiveFps: 'Analysis Frame Rate (FPS)',
    reps: 'Reps',
    repEstimate: 'Estimated Reps',
    fps: 'FPS',
    standardId: 'Standard ID',
    standardName: 'Standard Name',
    extractedFrames: 'Extracted Frames',
    comparableFrames: 'Comparable Frames',
    avgScore: 'Average Score',
    minScore: 'Min Score',
    maxScore: 'Max Score',
    badFramePct: 'Bad Frame %',
    coverage: 'Visibility',
    stabilityScore: 'Stability',
    mobilityScore: 'Mobility',
    rhythmScore: 'Rhythm',
    symmetryScore: 'Symmetry',
    avgRepDurationSec: 'Average Rep Duration (s)',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle',
    kneeFlexDeg: 'Knee Flexion',
    centerY: 'Center Height'
  }
  return map[key] ?? humanizeMetricKey(key)
}

export function metricTip(key: string) {
  const map: Record<string, string> = {
    totalReps: 'All completed reps, including reps not used for valid scoring.',
    effectiveReps: 'Reps fully assessed as either correct or incorrect.',
    unassessedReps: 'Completed reps excluded from validity scoring (invalid reps).',
    correctReps: 'Assessed reps judged as correct form.',
    incorrectReps: 'Assessed reps judged as incorrect form.',
    formAccuracyPct: 'Correct / (Correct + Incorrect), excludes unassessed reps.',
    assessedRepPct: 'Effective Reps / Total Reps.',
    sideViewInvalidReps: 'Reps excluded because side-view alignment was unstable.',
    effectiveFps: 'Observed processing frame rate during analysis.',
    avgRepDurationSec: 'Average duration per completed rep.',
    fastRepCount: 'Reps flagged as too fast by tempo thresholds.',
    slowRepCount: 'Reps flagged as too slow by tempo thresholds.'
  }
  return map[key] ?? humanizeMetricKey(key)
}

export function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set(['coverage', 'badFramePct'])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  if (key.endsWith('Pct')) return `${Math.round(v)}%`
  if (key === 'avgRepDurationSec') return `${v.toFixed(2)}s`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export function humanizeMetricKey(key: string) {
  if (!key) return '-'
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildDisplayMetricCards(keyMetrics: Record<string, unknown>) {
  const priority = [
    'totalReps',
    'effectiveReps',
    'unassessedReps',
    'formAccuracyPct',
    'avgRepDurationSec'
  ]
  const cards: Array<{ key: string; label: string; value: string; tip?: string; group?: string }> = []
  const hiddenKeys = new Set(['sideViewInvalidReps'])

  for (const key of priority) {
    if (hiddenKeys.has(key)) continue
    if (!(key in keyMetrics)) continue
    cards.push({
      key,
      label: prettyMetricName(key),
      value: formatMetricValue(key, keyMetrics[key]),
      tip: metricTip(key),
      group: metricGroup(key)
    })
  }

  return cards
}

export function resolveDisplayMetrics(report: Record<string, unknown>) {
  const direct = asRecord(report.keyMetrics) ?? {}
  const sections = asRecord(report.sections)
  const sectionMetrics = asRecord(sections?.metrics) ?? {}
  const details = asRecord(report.details) ?? {}

  const totalReps = pickMetricNumber(direct.totalReps, sectionMetrics.totalReps, details.repCount)
  const correctReps = pickMetricNumber(direct.correctReps, sectionMetrics.correctReps, details.correctCount)
  const incorrectReps = pickMetricNumber(direct.incorrectReps, sectionMetrics.incorrectReps, details.incorrectCount)
  const effectiveReps =
    pickMetricNumber(direct.effectiveReps, sectionMetrics.effectiveReps, details.effectiveRepCount) ??
    (correctReps !== null || incorrectReps !== null ? (correctReps ?? 0) + (incorrectReps ?? 0) : null)
  const unassessedReps =
    pickMetricNumber(direct.unassessedReps, sectionMetrics.unassessedReps, details.unassessedRepCount) ??
    (totalReps !== null && effectiveReps !== null ? Math.max(0, totalReps - effectiveReps) : null)
  const formAccuracyPct =
    pickMetricNumber(direct.formAccuracyPct, sectionMetrics.formAccuracyPct) ??
    (effectiveReps && effectiveReps > 0 && correctReps !== null ? Math.round((correctReps / effectiveReps) * 100) : null)
  const avgRepDurationSec = pickMetricNumber(direct.avgRepDurationSec, sectionMetrics.avgRepDurationSec, details.avgRepDurationSec)

  return {
    ...sectionMetrics,
    ...direct,
    ...(totalReps !== null ? { totalReps } : {}),
    ...(effectiveReps !== null ? { effectiveReps } : {}),
    ...(unassessedReps !== null ? { unassessedReps } : {}),
    ...(formAccuracyPct !== null ? { formAccuracyPct } : {}),
    ...(avgRepDurationSec !== null ? { avgRepDurationSec } : {})
  }
}

export function pickMetricNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function buildDisplayMetricGroups(keyMetrics: Record<string, unknown>) {
  const cards = buildDisplayMetricCards(keyMetrics)
  const grouped = new Map<string, Array<{ key: string; label: string; value: string; tip?: string; group?: string }>>()

  for (const item of cards) {
    const group = item.group ?? 'Other'
    const bucket = grouped.get(group)
    if (bucket) bucket.push(item)
    else grouped.set(group, [item])
  }

  return [...grouped.entries()].map(([group, items]) => ({ group, items }))
}

export function toFiniteNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function metricGroup(key: string) {
  if (key === 'totalReps' || key === 'effectiveReps') return 'Reps'
  if (key === 'unassessedReps' || key === 'formAccuracyPct') return 'Form'
  if (key === 'fastRepCount' || key === 'slowRepCount' || key === 'avgRepDurationSec' || key === 'effectiveFps') return 'Tempo'
  return 'Other'
}

export function buildRepQualityHighlight(args: {
  repFindings: Array<Record<string, unknown>>
  exerciseSlug: string
  keyMetrics: Record<string, unknown>
  issues: Array<Record<string, unknown>>
}) {
  const repFindings = args.repFindings
  const exerciseSlug = args.exerciseSlug
  const totalReps = pickMetricNumber(args.keyMetrics.totalReps) ?? 0
  const effectiveReps = pickMetricNumber(args.keyMetrics.effectiveReps) ?? 0
  const unassessedReps = pickMetricNumber(args.keyMetrics.unassessedReps) ?? 0
  const correctReps = pickMetricNumber(args.keyMetrics.correctReps) ?? Math.max(0, effectiveReps - (pickMetricNumber(args.keyMetrics.incorrectReps) ?? 0))
  const incorrectReps = pickMetricNumber(args.keyMetrics.incorrectReps) ?? Math.max(0, effectiveReps - correctReps)
  const formAccuracyPct =
    pickMetricNumber(args.keyMetrics.formAccuracyPct) ??
    (effectiveReps > 0 ? Math.round((correctReps / effectiveReps) * 100) : null)

  if (repFindings.length === 0) {
    const topIssue = args.issues
      .map((item) => String(item.message ?? item.code ?? '').trim())
      .find(Boolean)

    if (totalReps === 0) {
      return {
        tone: 'soft',
        headline: 'No reps detected',
        copy: 'The report did not detect a complete rep cycle. Try a clearer camera angle, keep your full body visible, and ensure the whole movement is captured.'
      } as const
    }

    if (effectiveReps === 0 && totalReps > 0) {
      return {
        tone: 'soft',
        headline: 'Set captured, but form was not scored reliably',
        copy:
          unassessedReps > 0
            ? `The report could not assess ${unassessedReps} rep${unassessedReps > 1 ? 's' : ''} reliably. Improve camera angle and keep the full body visible.`
            : 'The report needs a clearer camera angle or more stable pose tracking before it can score form reliably.'
      } as const
    }
    if (effectiveReps > 0 && (incorrectReps >= effectiveReps || formAccuracyPct === 0)) {
      return {
        tone: 'warn',
        headline: topIssue ? mapPoseFeedbackMessage({ exerciseSlug, message: topIssue }).label : 'Most assessed reps need correction',
        copy: `Form accuracy was ${Math.round(formAccuracyPct ?? 0)}%, so the set needs form fixes before it can be considered stable.`
      } as const
    }
    if (effectiveReps > 0 && incorrectReps > 0) {
      return {
        tone: 'warn',
        headline: topIssue ? mapPoseFeedbackMessage({ exerciseSlug, message: topIssue }).label : 'Form was inconsistent across the set',
        copy: `Only ${correctReps} of ${effectiveReps} assessed reps passed the form check. Focus on the main issue before the next set.`
      } as const
    }
    if (effectiveReps > 0 && incorrectReps === 0 && (formAccuracyPct ?? 0) >= 95) {
      return {
        tone: 'good',
        headline: 'Strong set overall',
        copy: 'Great job - all assessed reps passed the form check. Keep the same control and camera setup next time.'
      } as const
    }
    return {
      tone: 'soft',
      headline: 'Set complete with limited quality detail',
      copy: 'The report counted the set, but there was not enough rep-level detail to highlight one specific correction.'
    } as const
  }

  const grouped = new Map<string, { count: number; tier: 'gate' | 'warning' | 'issue' | 'rep_fail' }>()
  for (const item of repFindings) {
    const result = String(item.result ?? 'invalid')
    const raw = String(item.primaryIssue ?? 'No detail')
    const mapped = mapPoseFeedbackMessage({ exerciseSlug, message: raw })
    const tier = result === 'incorrect' ? 'rep_fail' : mapped.tier
    const existing = grouped.get(mapped.label)
    if (existing) {
      existing.count += 1
      if (poseTierRank(tier) > poseTierRank(existing.tier)) existing.tier = tier
    } else {
      grouped.set(mapped.label, { count: 1, tier })
    }
  }

  const top = [...grouped.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count
    return poseTierRank(b[1].tier) - poseTierRank(a[1].tier)
  })[0]

  if (!top) {
    return {
      tone: 'good',
      headline: 'Strong set overall',
      copy: 'Great job - your assessed reps stayed consistent and controlled.'
    } as const
  }

  const [label, meta] = top
  return {
    tone: meta.tier === 'rep_fail' || meta.tier === 'issue' ? 'warn' : 'soft',
    headline: label,
    copy: meta.count > 1 ? `This was the most common rep issue and appeared in ${meta.count} reps.` : 'This was the main rep issue in the set.'
  } as const
}

export function buildIssueMetaLine(issue: Record<string, unknown>) {
  const parts: string[] = []
  const count = pickMetricNumber(issue.count)
  const seenMoments = normalizeDisplayedMoments(readNumberArray(issue.seenMomentsMs), TOP_ISSUE_TIME_DISPLAY)
  const firstSeenMs = seenMoments[0] ?? pickMetricNumber(issue.firstSeenMs)
  if (count !== null && count > 0) parts.push(`${count} ${count === 1 ? 'time' : 'times'}`)
  if (seenMoments.length >= 2) parts.push(`at ${seenMoments.map((value) => formatClock(value)).join(', ')}`)
  else if (firstSeenMs !== null) parts.push(`first at ${formatClock(firstSeenMs)}`)
  else if (typeof issue.atFrame === 'number') parts.push(`frame ${issue.atFrame}`)
  return parts.join(', ')
}

export function formatClock(ms: number) {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function poseTierRank(tier: 'gate' | 'warning' | 'issue' | 'rep_fail') {
  if (tier === 'rep_fail') return 4
  if (tier === 'issue') return 3
  if (tier === 'warning') return 2
  return 1
}

export type TopIssueCard = {
  label: string
  tier: 'gate' | 'warning' | 'issue' | 'rep_fail'
  count?: number | null
  firstSeenMs?: number | null
  seenMomentsMs?: number[]
}

export function buildTopIssueCards(args: {
  issues: Array<Record<string, unknown>>
  repFindings: Array<Record<string, unknown>>
  exerciseSlug: string
  options: { maxMoments: number; minGapMs: number }
}) {
  const grouped = new Map<string, TopIssueCard>()

  const upsert = (next: TopIssueCard) => {
    const prev = grouped.get(next.label)
    if (!prev) {
      grouped.set(next.label, {
        ...next,
        seenMomentsMs: normalizeDisplayedMoments(next.seenMomentsMs ?? [], args.options)
      })
      return
    }
    prev.tier = poseTierRank(next.tier) > poseTierRank(prev.tier) ? next.tier : prev.tier
    prev.count = mergeIssueCounts(prev.count, next.count)
    prev.seenMomentsMs = normalizeDisplayedMoments([...(prev.seenMomentsMs ?? []), ...(next.seenMomentsMs ?? [])], args.options)
    prev.firstSeenMs = prev.seenMomentsMs[0] ?? next.firstSeenMs ?? prev.firstSeenMs ?? null
  }

  for (const issue of args.issues) {
    const raw = String(issue.message ?? issue.code ?? 'Issue')
    const human = mapPoseFeedbackMessage({ exerciseSlug: args.exerciseSlug, message: raw })
    upsert({
      label: human.label,
      tier: human.tier,
      count: pickMetricNumber(issue.count),
      firstSeenMs: pickMetricNumber(issue.firstSeenMs),
      seenMomentsMs: readNumberArray(issue.seenMomentsMs)
    })
  }

  for (const finding of args.repFindings) {
    const result = String(finding.result ?? 'invalid')
    const tMs = pickMetricNumber(finding.tMs)
    const rawReasons = Array.isArray(finding.reasons) ? finding.reasons.filter((x): x is string => typeof x === 'string') : []
    const base = String(finding.primaryIssue ?? '').trim()
    const messages = rawReasons.length > 0 ? rawReasons : base ? [base] : []
    const seenLabels = new Set<string>()
    for (const message of messages) {
      const human = mapPoseFeedbackMessage({ exerciseSlug: args.exerciseSlug, message })
      if (seenLabels.has(human.label)) continue
      seenLabels.add(human.label)
      upsert({
        label: human.label,
        tier: result === 'incorrect' ? 'rep_fail' : human.tier,
        count: 1,
        firstSeenMs: tMs,
        seenMomentsMs: tMs !== null ? [tMs] : []
      })
    }
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      seenMomentsMs: normalizeDisplayedMoments(item.seenMomentsMs ?? [], args.options),
      firstSeenMs: normalizeDisplayedMoments(item.seenMomentsMs ?? [], args.options)[0] ?? item.firstSeenMs ?? null
    }))
    .sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0)
      if (countDiff !== 0) return countDiff
      const tierDiff = poseTierRank(b.tier) - poseTierRank(a.tier)
      if (tierDiff !== 0) return tierDiff
      return (a.firstSeenMs ?? Number.POSITIVE_INFINITY) - (b.firstSeenMs ?? Number.POSITIVE_INFINITY)
    })
}

export function mergeIssueCounts(a: number | null | undefined, b: number | null | undefined) {
  if (a == null) return b ?? null
  if (b == null) return a
  return Math.max(a, b)
}

export function readNumberArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
}

export function normalizeDisplayedMoments(values: number[], options: { maxMoments: number; minGapMs: number }) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const out: number[] = []
  for (const value of sorted) {
    const prev = out[out.length - 1]
    if (prev !== undefined && value - prev < options.minGapMs) continue
    out.push(value)
    if (out.length >= options.maxMoments) break
  }
  return out
}


