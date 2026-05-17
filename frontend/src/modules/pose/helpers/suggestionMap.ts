import type { ExerciseSlug } from './types'

export function mapSuggestionFromIssue(issue: string, exerciseSlug: ExerciseSlug) {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Lower the load, brace your core, and avoid swinging the torso.'
    if (text.includes('symmetry')) return 'Lift both arms together and match left-right height at the top.'
    if (text.includes('elbow') || text.includes('curl')) return 'Keep a soft elbow bend and move from the shoulder joint.'
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
      return 'Lower hips slightly. Keep a straight line from shoulders to ankles.'
    }
    if (text.includes('hips sag') || (text.includes('hips') && text.includes('drop')) || text.includes('torso') || text.includes('hips')) {
      return 'Brace your core. Keep a straight line from shoulders to ankles.'
    }
    if (text.includes('side-view') || text.includes('side view')) return 'Use a clear side view so depth and body line can be checked.'
    if (text.includes('confidence') || text.includes('keypoints') || text.includes('frame') || text.includes('tracking')) {
      return 'Improve lighting. Keep shoulders, hips, knees, and ankles visible.'
    }
  }
  if (exerciseSlug === 'bent-over-row') {
    if (text.includes('torso lean') || text.includes('lean')) return 'Keep your back flat and hips square. Avoid excessive forward lean.'
    if (text.includes('symmetry') || text.includes('evenly')) return 'Pull both arms together and match left-right at the top.'
    if (text.includes('face the camera') || text.includes('front')) return 'Face the camera so both arms stay visible for row tracking.'
    if (text.includes('range') || text.includes('not pull')) return 'Pull the dumbbells closer to your hips for a full contraction.'
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
  if (text.includes('torso lean')) return 'Brace your core and keep your chest up during the descent.'
  if (text.includes('knee') && text.includes('toes')) {
    return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.'
  }
  if (text.includes('side view')) return 'Set the camera exactly side-on at hip height, 2-3 meters away, with your full body always in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.'
  return ''
}



