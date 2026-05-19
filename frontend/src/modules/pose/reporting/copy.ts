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
  if (tier === 'rep_fail') return 'Incorrect'
  if (tier === 'issue') return 'Important'
  if (tier === 'warning') return 'Note'
  return 'Camera'
}

export function mapPoseFeedbackMessage(args: { exerciseSlug: string; message: string }): PoseHumanFeedback {
  const raw = (args.message ?? '').trim()
  const text = raw.toLowerCase()

  if (!raw) {
    return {
      tier: 'gate',
      label: 'No stable pose detected yet. Improve lighting and keep your full body in frame.',
      shortHint: 'Full body visible.'
    }
  }

  if (text === 'too close' || text.includes('too close')) {
    return { tier: 'gate', label: 'Step back a bit — your body is too close to the camera for full tracking.', shortHint: 'Step back.' }
  }
  if (text === 'too far' || text.includes('too far')) {
    return { tier: 'gate', label: 'Step a little closer — the camera can\'t see your joints clearly at this distance.', shortHint: 'Step closer.' }
  }

  if (text.startsWith('fix camera angle') || text.startsWith("i can't")) {
    if (text.includes('face the camera') || text.includes('front view')) {
      return { tier: 'gate', label: 'Face the camera directly so both sides of your body stay visible.', shortHint: 'Face the camera.' }
    }
    if (text.includes('side view') || text.includes('side-view')) {
      return { tier: 'gate', label: 'Turn sideways (about 90°) so the camera can see your profile clearly.', shortHint: 'Turn sideways.' }
    }
    if (
      text.includes('low keypoint confidence') ||
      text.includes('keypoint confidence') ||
      text.includes('lighting') ||
      text.includes('visible')
    ) {
      return { tier: 'gate', label: 'Brighten the room — dim light makes it hard to track your joints accurately.', shortHint: 'Brighter light.' }
    }
    if (
      text.includes('keypoints were incomplete') ||
      text.includes('no valid pose frames') ||
      text.includes('full body') ||
      text.includes('in frame')
    ) {
      return { tier: 'gate', label: 'Make sure your full body (shoulders to ankles) stays in the frame the whole time.', shortHint: 'Full body in frame.' }
    }
    return { tier: 'gate', label: raw, shortHint: 'Adjust camera setup.' }
  }
  if (text.startsWith('go deeper') || text.startsWith('make the rep bigger') || text.startsWith('slow down') || text.startsWith('keep it moving')) {
    return { tier: 'rep_fail', label: raw, shortHint: raw.length > 56 ? `${raw.slice(0, 53)}...` : raw }
  }
  if (text.startsWith('brace your core') || text.startsWith('push hips back') || text.startsWith('keep your torso stable') || text.startsWith('match left and right')) {
    return { tier: 'issue', label: raw, shortHint: raw.length > 56 ? `${raw.slice(0, 53)}...` : raw }
  }

  const isRepFailed = text.startsWith('rep failed')
  const isRepIgnored = text.startsWith('rep ignored')
  const isRepUnassessed =
    text.includes('not assessed') ||
    text.includes('excluded from valid assessment') ||
    text.includes('unstable or incomplete keypoints') ||
    text.includes('unstable keypoints') ||
    text.includes('incomplete keypoints') ||
    text.includes('unstable tracking')
  if (isRepFailed || isRepIgnored) {
    if (text.includes('depth was insufficient') || text.includes('range of motion was too small') || text.includes('arms did not reach shoulder height')) {
      return { tier: 'rep_fail', label: 'Make the movement bigger. Reach the bottom position, then return to the top with control.', shortHint: 'Use full range.' }
    }
    if (text.includes('knees drifted too far forward') || text.includes('knee drifted too far') || text.includes('knee drifted too far ahead')) {
      return { tier: 'rep_fail', label: 'Move your hips back first so your knees do not slide far past your toes.', shortHint: 'Hips back.' }
    }
    if (text.includes('torso leaned too far forward') || text.includes('excessive forward torso lean') || text.includes('excessive torso lean')) {
      return { tier: 'rep_fail', label: 'Keep your chest up and tighten your stomach muscles so you do not fold forward.', shortHint: 'Chest up.' }
    }
    if (text.includes('arms were not raised evenly') || text.includes('arms were not pulled evenly') || text.includes('symmetry')) {
      const tier = args.exerciseSlug === 'bent-over-row' ? 'warning' : 'rep_fail'
      return { tier, label: 'Move both arms together — same timing and same height on both sides.', shortHint: 'Match both sides.' }
    }
    if (text.includes('elbows bent too much') || text.includes('elbow curl')) {
      return { tier: 'rep_fail', label: 'Do not turn this into an arm curl. Keep a small bend in the elbows and move from the shoulders.', shortHint: 'Not an arm curl.' }
    }
    if (text.includes('movement was too short') || text.includes('movement was too small')) {
      return { tier: 'rep_fail', label: 'This rep was too small. Complete the full movement before changing direction.', shortHint: 'Bigger rep.' }
    }
    if (text.includes('too fast')) {
      return { tier: 'rep_fail', label: 'Slow down and stay in control. Move at a steady speed.', shortHint: 'Slow down.' }
    }
    if (text.includes('too slow')) {
      return { tier: 'rep_fail', label: 'Do not pause too long. Keep a smooth, continuous rhythm.', shortHint: 'Keep moving.' }
    }
    return { tier: 'rep_fail', label: 'Redo this rep with control and focus on the main form point.', shortHint: 'Redo rep.' }
  }

  if (isRepUnassessed) {
    return {
      tier: 'gate',
      label: 'This rep couldn\'t be scored — try better lighting and keep your full body steady in frame.',
      shortHint: 'Stable view + lighting.'
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
      return { tier: 'gate', label: 'Face the camera head-on so both arms stay fully visible for tracking.', shortHint: 'Face the camera.' }
    }
    if (text.includes('side view') || text.includes('side-view')) {
      return {
        tier: 'gate',
        label: 'Use a clear side view — turn about 90° and keep your whole body in frame from shoulders to ankles.',
        shortHint: 'Turn sideways (90°).'
      }
    }
    if (text.includes('low keypoint confidence') || text.includes('keypoint confidence')) {
      return { tier: 'gate', label: 'The camera can\'t see you well — add more light and avoid wearing clothes that blend with the background.', shortHint: 'Brighter light + contrast.' }
    }
    if (text.includes('keypoints were incomplete')) {
      return { tier: 'gate', label: 'Step back so your full body fits in frame — shoulders, hips, knees, and ankles all need to be visible.', shortHint: 'Full body in frame.' }
    }
    if (text.includes('no valid pose frames')) {
      return { tier: 'gate', label: 'No stable pose detected — stand centered in frame and ensure the whole body is visible from the start.', shortHint: 'Center in frame.' }
    }
    return { tier: 'gate', label: 'Adjust your camera setup — keep your body fully visible and the view steady.', shortHint: 'Adjust the camera view.' }
  }

  if (text.includes('hips dropped') || text.includes('hips sag') || text.includes('body line')) {
    return { tier: 'issue', label: 'Tighten your stomach and glutes. Keep a straight line from shoulders to ankles.', shortHint: 'Straight line.' }
  }
  if (text.includes('hips were too high') || text.includes('hips too high') || text.includes('pike')) {
    return { tier: 'issue', label: 'Lower your hips so your body forms one straight line from shoulders to ankles.', shortHint: 'Lower hips.' }
  }
  if (text.includes('hips are rising') || text.includes('hips rising')) {
    return { tier: 'issue', label: 'Move your hips and shoulders together — do not let the hips rise first.', shortHint: 'Move together.' }
  }
  if (text.includes('too upright') || text.includes('hinge at the hips')) {
    return { tier: 'warning', label: 'Keep your back angle steady. Bend forward from the hips and do not stand up during the pull.', shortHint: 'Stay hinged.' }
  }
  if (text.includes('knees were too straight') || text.includes('knees too straight') || text.includes('lock out your legs')) {
    const tier = args.exerciseSlug === 'bent-over-row' ? 'issue' : 'warning'
    return { tier, label: 'Bend your knees slightly — do not lock your knees straight during the movement.', shortHint: 'Bend knees.' }
  }
  if (text.includes('close enough to hips') || text.includes('pull the dumbbells closer') || text.includes('full contraction')) {
    const tier = args.exerciseSlug === 'bent-over-row' ? 'warning' : 'rep_fail'
    return { tier, label: 'Pull all the way back. Bring the weights close to your hips and squeeze briefly.', shortHint: 'Pull fully back.' }
  }
  if (text.includes('torso leaning') || text.includes('excessive forward torso lean') || text.includes('excessive torso lean') || text.includes('torso sway')) {
    const tier = args.exerciseSlug === 'bent-over-row' ? 'warning' : 'issue'
    return { tier, label: 'Keep your upper body steady. Tighten your stomach muscles and avoid swinging.', shortHint: 'No swinging.' }
  }
  if (text.includes('depth insufficient') || text.includes('go deeper')) {
    return { tier: 'rep_fail', label: 'Go deeper — bend your elbows more at the bottom, then press back up with control.', shortHint: 'Go deeper.' }
  }
  if (text.includes('knee drift') || text.includes('knee is moving too far forward')) {
    return { tier: 'issue', label: 'Start by moving your hips back, then bend your knees. Do not let your knees slide far forward.', shortHint: 'Hips back.' }
  }
  if (text.includes('symmetry') || text.includes('arms were not pulled evenly') || text.includes('pull both arms evenly')) {
    const tier = args.exerciseSlug === 'bent-over-row' ? 'warning' : 'issue'
    return { tier, label: 'Keep both sides even — pull both arms at the same time and to the same height.', shortHint: 'Even both sides.' }
  }
  if (text.includes('avoid turning this into an elbow curl') || text.includes('elbow curl')) {
    return { tier: 'warning', label: 'Keep a soft bend in your elbows — initiate the movement from your shoulders, not your elbows.', shortHint: 'Soft elbows.' }
  }

  return { tier: 'warning', label: raw, shortHint: raw.length > 48 ? `${raw.slice(0, 45)}...` : raw }
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
    lines.push('Focus on:')
    for (const item of topProblems) lines.push(`- ${cleanSummaryLine(item)}`)
  } else if (accuracy && parseInt(accuracy) >= 95) {
    lines.push('Focus on:')
    lines.push('- Your form is solid. Keep this technique and gradually increase intensity.')
  } else {
    lines.push('Focus on:')
    lines.push('- Keep your form consistent and controlled through every rep.')
  }

  if (fixes.length > 0) {
    lines.push('Try:')
    for (const item of fixes) lines.push(`- ${cleanSummaryLine(item)}`)
  } else {
    lines.push('Try:')
    lines.push('- Maintain a steady tempo and use your full range of motion.')
  }

  if (gateNotes.length > 0) {
    lines.push('Camera note:')
    lines.push(`- ${cleanSummaryLine(gateNotes[0])}`)
  }

  return `${exercise} Analysis${accuracy ? ` (${accuracy} form accuracy)` : ''}: ${lines.join('\n')}`
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
