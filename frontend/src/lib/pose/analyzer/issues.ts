import type { PoseExerciseSlug } from '../exercises'
import type { RealtimeFeedback } from '../realtimeSquat'

export function toIssueCode(message: string) {
  return message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
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

export function buildLiveSuggestions(feedback: RealtimeFeedback | null, fallbackSuggestion: string, exerciseSlug: PoseExerciseSlug) {
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
            : exerciseSlug === 'bench-press'
              ? 'Keep your setup stable and press with controlled tempo through full range.'
              : 'Keep your movement controlled and maintain a stable side-view camera angle.'
    )
  }
  return Array.from(suggestions).slice(0, 4)
}

export function mapSuggestionFromIssue(issue: string, exerciseSlug: PoseExerciseSlug) {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Lower the load, brace your core, and avoid swinging the torso.'
    if (text.includes('symmetry')) return 'Lift both arms together and match left-right height at the top.'
    if (text.includes('elbow') || text.includes('curl')) return 'Keep a soft elbow bend and move from the shoulder joint.'
    if (text.includes('face the camera') || text.includes('front')) return 'Rotate to face the camera so both arms stay visible.'
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('torso') || text.includes('hips')) return 'Brace your core and keep shoulders, hips, and ankles in one line.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve depth and body-line checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'pullup') {
    if (text.includes('kipping') || text.includes('sway') || text.includes('swing')) return 'Reduce swing, brace your core, and keep the pull path controlled.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve pull-up range and alignment checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'bench-press') {
    if (text.includes('torso') || text.includes('bridge')) return 'Keep your torso braced and avoid excessive arch changes between reps.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve bench depth and elbow tracking.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep shoulders, elbows, wrists, and torso visible.'
  }
  if (text.includes('depth')) return 'Aim to descend until thighs are near parallel while keeping balance over mid-foot.'
  if (text.includes('heel') && text.includes('lift')) return 'Shift pressure to mid-foot/heel and widen stance slightly if needed.'
  if (text.includes('knees') && (text.includes('inward') || text.includes('collapsed') || text.includes('collapse'))) {
    return 'Drive knees out to track over toes and keep feet rooted.'
  }
  if (text.includes('tempo') || text.includes('descent too fast') || text.includes('ascent too fast')) {
    return 'Use a steady tempo: ~2s down, brief pause, and controlled rise.'
  }
  if (text.includes('torso lean')) return 'Brace your core and keep your chest up during the descent.'
  if (text.includes('knee') && text.includes('toes')) {
    return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.'
  }
  if (text.includes('side view')) return 'Set the camera exactly side-on at hip height, 2-3 meters away, with your full body always in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.'
  return ''
}

