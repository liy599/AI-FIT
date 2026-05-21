import type { ExerciseSlug } from './types'

export function mapSuggestionFromIssue(issue: string, exerciseSlug: ExerciseSlug) {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Use a lighter weight and keep your torso stable — avoid swinging or rocking to lift the dumbbells.'
    if (text.includes('symmetry')) return 'Lift both arms together with the same timing and reach the same height on both sides at the top.'
    if (text.includes('elbow') || text.includes('curl'))
      return 'Do not turn it into an arm curl. Keep a small, fixed elbow bend and move from the shoulder joint.'
    if (text.includes('face the camera') || text.includes('front'))
      return 'Face the camera directly so both shoulders, elbows, and wrists stay visible and symmetry can be evaluated.'
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('rep ignored') || text.includes('range of motion') || text.includes('range too small') || text.includes('move too small')) {
      return 'Use full range: lower until elbows bend clearly, then press back up to the top position before starting the next rep.'
    }
    if (text.includes('depth') || text.includes('deeper') || text.includes('elbow')) {
      return 'Lower with control until elbows bend clearly (around 90°), then press back up to full lockout with a steady body line.'
    }
    if ((text.includes('hips') && text.includes('too high')) || text.includes('avoid raising hips') || text.includes('pike')) {
      return 'Lower your hips and keep a straight line from shoulders to ankles — do not pike up as you press.'
    }
    if (text.includes('hips sag') || (text.includes('hips') && text.includes('drop')) || text.includes('torso') || text.includes('hips')) {
      return 'Brace your core and squeeze glutes so hips do not drop — keep shoulders, hips, and ankles in one straight line.'
    }
    if (text.includes('side-view') || text.includes('side view'))
      return 'Use a clear side view (about 90°) at hip height so depth and body line can be checked reliably.'
    if (text.includes('confidence') || text.includes('keypoints') || text.includes('frame') || text.includes('tracking')) {
      return 'Improve lighting and keep your full body in frame (shoulders to ankles). Avoid occlusion and keep the camera steady.'
    }
  }
  if (exerciseSlug === 'bent-over-row') {
    if (text.includes('torso lean') || text.includes('lean')) return 'Keep your back angle steady and avoid swinging — hinge at the hips and brace your core.'
    if (text.includes('knees') && (text.includes('straight') || text.includes('lock'))) return 'Bend your knees slightly — do not lock your knees straight.'
    if (text.includes('symmetry') || text.includes('evenly')) return 'Pull both arms at the same time and to the same height.'
    if (text.includes('face the camera') || text.includes('front')) return 'Face the camera so both arms stay visible for row tracking.'
    if (text.includes('range') || text.includes('not pull') || text.includes('hips'))
      return 'Pull all the way back — bring the weights close to your hips/lower ribs, squeeze briefly, then lower under control.'
  }
  if (text.includes('tempo unstable') || text.includes('tempo stability')) {
    return 'Tempo is uneven: keep a consistent cadence (about 2s down and controlled rise) across all reps.'
  }
  if (text.includes('tempo') && text.includes('fast')) {
    return 'Slow down each rep and avoid dropping too quickly at the bottom.'
  }
  if (text.includes('tempo') && text.includes('slow')) {
    return 'Keep tension but reduce long pauses to maintain a smoother continuous tempo.'
  }
  if (text.includes('torso lean')) return 'Tighten your stomach muscles and keep your chest up.'
  if (text.includes('knee') && text.includes('toes')) {
    return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.'
  }
  if (text.includes('side view'))
    return 'Place the camera side-on at about hip height, step back 2–3 meters, and keep your whole body in frame from shoulders to ankles.'
  if (text.includes('confidence') || text.includes('frame'))
    return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible throughout the whole set.'
  return ''
}


