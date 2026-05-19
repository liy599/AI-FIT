import type { ExerciseSlug } from './types'

export function mapSuggestionFromIssue(issue: string, exerciseSlug: ExerciseSlug) {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Use a lighter weight and avoid swinging your upper body.'
    if (text.includes('symmetry')) return 'Lift both arms together and reach the same height on both sides.'
    if (text.includes('elbow') || text.includes('curl')) return 'Do not turn it into an arm curl. Keep a small elbow bend and lift from the shoulders.'
    if (text.includes('face the camera') || text.includes('front')) return 'Rotate to face the camera so both arms stay visible.'
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('rep ignored') || text.includes('range of motion') || text.includes('range too small') || text.includes('move too small')) {
      return 'Use full range: lower further, then press back to the top before the next rep.'
    }
    if (text.includes('depth') || text.includes('deeper') || text.includes('elbow')) {
      return 'Lower further until elbows bend clearly, then press back up under control.'
    }
    if ((text.includes('hips') && text.includes('too high')) || text.includes('avoid raising hips') || text.includes('pike')) {
      return 'Lower your hips so your body forms one straight line from shoulders to ankles.'
    }
    if (text.includes('hips sag') || (text.includes('hips') && text.includes('drop')) || text.includes('torso') || text.includes('hips')) {
      return 'Tighten your stomach and glutes. Keep a straight line from shoulders to ankles.'
    }
    if (text.includes('side-view') || text.includes('side view')) return 'Use a clear side view so depth and body line can be checked.'
    if (text.includes('confidence') || text.includes('keypoints') || text.includes('frame') || text.includes('tracking')) {
      return 'Improve lighting. Keep shoulders, hips, knees, and ankles visible.'
    }
  }
  if (exerciseSlug === 'bent-over-row') {
    if (text.includes('torso lean') || text.includes('lean')) return 'Keep your back angle steady and avoid swinging your upper body.'
    if (text.includes('knees') && (text.includes('straight') || text.includes('lock'))) return 'Bend your knees slightly — do not lock your knees straight.'
    if (text.includes('symmetry') || text.includes('evenly')) return 'Pull both arms at the same time and to the same height.'
    if (text.includes('face the camera') || text.includes('front')) return 'Face the camera so both arms stay visible for row tracking.'
    if (text.includes('range') || text.includes('not pull') || text.includes('hips')) return 'Pull all the way back — bring the weights close to your hips and squeeze briefly.'
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
  if (text.includes('side view')) return 'Place the camera side-on at about hip height, 2–3 meters away, and keep your whole body in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.'
  return ''
}



