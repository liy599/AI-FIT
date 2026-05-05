export type PoseFeedbackTier = 'gate' | 'warning' | 'issue' | 'rep_fail'

export type PoseHumanFeedback = {
  tier: PoseFeedbackTier
  label: string
  shortHint: string
}

export type PoseReportIssue = {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  atFrame: number | null
  count?: number | null
  firstSeenMs?: number | null
  lastSeenMs?: number | null
  seenMomentsMs?: number[]
}

export type PoseReportLike = {
  version: number
  generatedAt: string
  status: 'ok' | 'error'
  task: { id: string; viewAngle: string; instruction: string | null }
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  summary: string
  keyMetrics: Record<string, number | string | null>
  issues: PoseReportIssue[]
  suggestions: string[]
  details: unknown
  sections: {
    overview: Record<string, unknown>
    metrics: Record<string, unknown>
    errorStats: unknown
    suggestions: string[]
    timelineSampled: unknown[]
  }
}

export function poseTierRank(tier: PoseFeedbackTier) {
  if (tier === 'rep_fail') return 4
  if (tier === 'issue') return 3
  if (tier === 'warning') return 2
  return 1
}

export function poseTierLabel(tier: PoseFeedbackTier) {
  if (tier === 'rep_fail') return 'Rep Fail'
  if (tier === 'issue') return 'Issue'
  if (tier === 'warning') return 'Warning'
  return 'Gate'
}

export function mapPoseFeedbackMessage(args: { exerciseSlug: string; message: string }): PoseHumanFeedback {
  const raw = (args.message ?? '').trim()
  const text = raw.toLowerCase()

  if (!raw) {
    return {
      tier: 'gate',
      label: "I can't get a stable pose yet - improve lighting and keep your full body in frame.",
      shortHint: 'Keep full body in frame.'
    }
  }

  if (text.startsWith('fix camera angle') || text.startsWith("i can't")) {
    return { tier: 'gate', label: raw, shortHint: raw.length > 56 ? `${raw.slice(0, 53)}...` : raw }
  }
  if (text.startsWith('go deeper') || text.startsWith('make the rep bigger') || text.startsWith('slow down') || text.startsWith('keep it moving')) {
    return { tier: 'rep_fail', label: raw, shortHint: raw.length > 56 ? `${raw.slice(0, 53)}...` : raw }
  }
  if (text.startsWith('brace your core') || text.startsWith('push hips back') || text.startsWith('keep your torso stable') || text.startsWith('match left and right')) {
    return { tier: 'issue', label: raw, shortHint: raw.length > 56 ? `${raw.slice(0, 53)}...` : raw }
  }

  const isRepFailed = text.startsWith('rep failed')
  const isRepIgnored = text.startsWith('rep ignored')
  const isRepUnassessed = text.includes('not assessed') || text.includes('excluded from valid assessment') || text.includes('unstable or incomplete keypoints')
  if (isRepFailed || isRepIgnored) {
    if (text.includes('depth was insufficient') || text.includes('range of motion was too small') || text.includes('arms did not reach shoulder height')) {
      return { tier: 'rep_fail', label: 'Go deeper / higher - hit full range of motion, then return with control.', shortHint: 'Full range of motion.' }
    }
    if (text.includes('knees drifted too far forward') || text.includes('knee drifted too far') || text.includes('knee drifted too far ahead')) {
      return { tier: 'rep_fail', label: 'Push hips back first - keep your knees from drifting too far forward.', shortHint: 'Hips back, shins vertical.' }
    }
    if (text.includes('torso leaned too far forward') || text.includes('excessive forward torso lean') || text.includes('excessive torso lean')) {
      return { tier: 'rep_fail', label: 'Keep your chest up - brace your core and avoid excessive forward lean.', shortHint: 'Chest up, brace core.' }
    }
    if (text.includes('arms were not raised evenly') || text.includes('arms were not pulled evenly') || text.includes('symmetry')) {
      return { tier: 'rep_fail', label: 'Match left and right - move both arms evenly through the rep.', shortHint: 'Match left/right.' }
    }
    if (text.includes('elbows bent too much') || text.includes('elbow curl')) {
      return { tier: 'rep_fail', label: 'Stop turning it into a curl - keep a soft elbow bend and move from the shoulder.', shortHint: 'Soft elbows, move at shoulder.' }
    }
    if (text.includes('movement was too short') || text.includes('movement was too small')) {
      return { tier: 'rep_fail', label: 'Make the rep bigger - complete the full movement before changing direction.', shortHint: 'Bigger rep, full cycle.' }
    }
    if (text.includes('too fast')) {
      return { tier: 'rep_fail', label: 'Slow down - control the movement and keep the tempo steady.', shortHint: 'Slow down.' }
    }
    if (text.includes('too slow')) {
      return { tier: 'rep_fail', label: 'Keep it moving - avoid long stalls and use a smooth rhythm.', shortHint: 'Smooth rhythm.' }
    }
    return { tier: 'rep_fail', label: 'Fix the rep: keep control and clean form before counting the next one.', shortHint: 'Clean rep.' }
  }

  if (isRepUnassessed) {
    return {
      tier: 'gate',
      label: "I can't assess quality reliably - keep a stable camera angle and improve lighting.",
      shortHint: 'Fix camera angle + lighting.'
    }
  }

  const isGate =
    text.includes('side view') ||
    text.includes('side-view') ||
    text.includes('face the camera') ||
    text.includes('low keypoint confidence') ||
    text.includes('keypoint confidence') ||
    text.includes('keypoints were incomplete') ||
    text.includes('no valid pose frames') ||
    text.includes('full body') ||
    text.includes('in frame')
  if (isGate) {
    if (text.includes('face the camera')) {
      return { tier: 'gate', label: 'Fix camera angle: face the camera so both arms stay visible.', shortHint: 'Face the camera (front view).' }
    }
    if (text.includes('side view') || text.includes('side-view')) {
      return {
        tier: 'gate',
        label: 'Fix camera angle: use a clear side view (about 90°) and keep your full body in frame.',
        shortHint: 'True side view (90°).'
      }
    }
    if (text.includes('low keypoint confidence') || text.includes('keypoint confidence')) {
      return { tier: 'gate', label: "I can't see you clearly - improve lighting and keep key joints visible.", shortHint: 'Better lighting + keep joints visible.' }
    }
    if (text.includes('keypoints were incomplete')) {
      return { tier: 'gate', label: "I can't track your full body - step back and keep shoulders, hips, knees, and ankles visible.", shortHint: 'Keep full body in frame.' }
    }
    if (text.includes('no valid pose frames')) {
      return { tier: 'gate', label: 'No stable pose detected - keep your whole body in frame and try again.', shortHint: 'Full body in frame.' }
    }
    return { tier: 'gate', label: 'Camera view is not usable yet - adjust angle and keep your full body visible.', shortHint: 'Fix camera view.' }
  }

  if (text.includes('hips dropped') || text.includes('hips sag') || text.includes('body line')) {
    return { tier: 'issue', label: 'Brace your core - keep head, hips, and heels in one straight line.', shortHint: 'Brace core, straight line.' }
  }
  if (text.includes('hips were too high') || text.includes('hips too high') || text.includes('pike')) {
    return { tier: 'issue', label: 'Lower your hips slightly - keep a stable plank line.', shortHint: 'Lower hips, stable line.' }
  }
  if (text.includes('excessive forward torso lean') || text.includes('excessive torso lean') || text.includes('torso sway')) {
    return { tier: 'issue', label: 'Keep your torso stable - brace your core and avoid swinging or excessive lean.', shortHint: 'Torso stable.' }
  }
  if (text.includes('knee drift') || text.includes('knee is moving too far forward')) {
    return { tier: 'issue', label: 'Push hips back first - keep your knees tracking over toes with shins more vertical.', shortHint: 'Hips back, knees track.' }
  }
  if (text.includes('symmetry')) {
    return { tier: 'issue', label: 'Match left and right - keep both arms moving evenly.', shortHint: 'Match left/right.' }
  }
  if (text.includes('avoid turning this into an elbow curl') || text.includes('elbow curl')) {
    return { tier: 'warning', label: 'Keep elbows softly fixed - lead with elbows and raise from the shoulders.', shortHint: 'Soft elbows.' }
  }

  return { tier: 'warning', label: raw, shortHint: raw.length > 48 ? `${raw.slice(0, 45)}...` : raw }
}

export function pickLiveMainTip(args: {
  exerciseSlug: string
  feedback: {
    warnings: string[]
    issues: Array<{ message: string }>
    lastRepMessage: string | null
    lastRepReasonLabels: string[]
  } | null
}): PoseHumanFeedback {
  if (!args.feedback) {
    return { tier: 'gate', label: 'Start the camera to receive live form coaching.', shortHint: 'Start the camera.' }
  }

  const candidates: Array<{ source: 'rep_reason' | 'rep_message' | 'issue' | 'warning'; message: string }> = []
  for (const reason of args.feedback.lastRepReasonLabels ?? []) candidates.push({ source: 'rep_reason', message: reason })
  if (args.feedback.lastRepMessage) candidates.push({ source: 'rep_message', message: args.feedback.lastRepMessage })
  for (const issue of args.feedback.issues ?? []) candidates.push({ source: 'issue', message: issue.message })
  for (const warn of args.feedback.warnings ?? []) candidates.push({ source: 'warning', message: warn })

  const seen = new Set<string>()
  const mapped = candidates
    .map((c) => ({ ...c, message: (c.message ?? '').trim() }))
    .filter((c) => c.message && !seen.has(c.message) && (seen.add(c.message), true))
    .map((c) => ({ ...c, human: mapPoseFeedbackMessage({ exerciseSlug: args.exerciseSlug, message: c.message }) }))

  if (mapped.length === 0) {
    return { tier: 'gate', label: "I can't detect a stable pose yet - improve lighting and keep your full body in frame.", shortHint: 'Full body in frame.' }
  }

  const sourceRank = (s: typeof mapped[number]['source']) => (s === 'rep_reason' ? 4 : s === 'rep_message' ? 3 : s === 'issue' ? 2 : 1)

  mapped.sort((a, b) => {
    const diff = poseTierRank(b.human.tier) - poseTierRank(a.human.tier)
    if (diff !== 0) return diff
    return sourceRank(b.source) - sourceRank(a.source)
  })

  return mapped[0]!.human
}

export function buildCoachSummaryFromReport(input: {
  exerciseSlug: string
  exerciseName: string | null
  keyMetrics: Record<string, unknown>
  issues: Array<{ message?: unknown; code?: unknown }>
  suggestions: string[]
}) {
  const accuracyRaw = input.keyMetrics.formAccuracyPct
  const accuracy = typeof accuracyRaw === 'number' && Number.isFinite(accuracyRaw) ? `${Math.round(accuracyRaw)}%` : null
  const exercise = input.exerciseName?.trim() ? input.exerciseName.trim() : 'Pose'

  const topProblems: string[] = []
  const gateNotes: string[] = []
  for (const item of input.issues) {
    const rawMsg = typeof item.message === 'string' ? item.message : typeof item.code === 'string' ? item.code : ''
    const human = mapPoseFeedbackMessage({ exerciseSlug: input.exerciseSlug, message: rawMsg })
    if (human.tier === 'gate') {
      if (gateNotes.length < 1) gateNotes.push(human.label)
      continue
    }
    if (human.tier === 'rep_fail' || human.tier === 'issue') {
      if (!topProblems.includes(human.label)) topProblems.push(human.label)
      if (topProblems.length >= 2) break
    }
  }

  const fixes = input.suggestions.slice(0, 3)
  const lines: string[] = []

  if (topProblems.length > 0) {
    lines.push('Focus:')
    for (const item of topProblems) lines.push(`- ${cleanSummaryLine(item)}`)
  } else {
    lines.push('Focus:')
    lines.push('- Keep your form consistent.')
  }

  if (fixes.length > 0) {
    lines.push('Fix:')
    for (const item of fixes) lines.push(`- ${cleanSummaryLine(item)}`)
  } else {
    lines.push('Fix:')
    lines.push('- Keep your tempo steady and use the full range of motion.')
  }

  if (gateNotes.length > 0) {
    lines.push('Note:')
    lines.push(`- ${cleanSummaryLine(gateNotes[0])}`)
  }

  return `${exercise} coach summary${accuracy ? ` (${accuracy} form accuracy)` : ''}: ${lines.join('\n')}`
}

export function humanizePoseReport(report: PoseReportLike): PoseReportLike {
  const obj = report as unknown as Record<string, unknown>
  const exercise = isRecord(obj.exercise) ? obj.exercise : null
  const exerciseSlug = String(exercise?.id ?? '').toLowerCase() || 'squat'
  const exerciseName = typeof exercise?.name === 'string' ? exercise.name : null
  const keyMetrics = isRecord(obj.keyMetrics) ? obj.keyMetrics : {}
  const issuesRaw = Array.isArray(obj.issues) ? obj.issues : []
  const suggestionsRaw = Array.isArray(obj.suggestions) ? obj.suggestions : []

  const mappedIssues = issuesRaw.map((issue) => {
    if (typeof issue === 'string') {
      const human = mapPoseFeedbackMessage({ exerciseSlug, message: issue })
      return { code: '', severity: 'warning', message: human.label, atFrame: null }
    }
    if (!isRecord(issue)) return issue
    const msg = typeof issue.message === 'string' ? issue.message : typeof issue.code === 'string' ? issue.code : ''
    const human = mapPoseFeedbackMessage({ exerciseSlug, message: msg })
    return { ...issue, message: human.label }
  })

  const suggestions = Array.from(
    new Set(
      suggestionsRaw
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean)
    )
  ).slice(0, 3)

  const coachSummary = buildCoachSummaryFromReport({
    exerciseSlug,
    exerciseName,
    keyMetrics,
    issues: issuesRaw.filter((x): x is Record<string, unknown> => isRecord(x)),
    suggestions
  })

  const sections = isRecord(obj.sections) ? obj.sections : null
  const nextSections = sections
    ? {
        ...sections,
        overview: { ...(isRecord(sections.overview) ? sections.overview : {}), summary: coachSummary },
        suggestions
      }
    : obj.sections

  return { ...(obj as PoseReportLike), summary: coachSummary, issues: mappedIssues as never, suggestions, sections: nextSections as never }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanSummaryLine(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.replace(/[./\s]+$/g, '').trim() + '.'
}

