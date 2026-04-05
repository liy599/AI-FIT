import type { MotionStandard } from './motionCompare'

export const SQUAT_SIDE_STANDARD_V1: MotionStandard = {
  id: 'squat_side_landing_v1',
  name: 'Squat Side Standard',
  minQuality: 0.38,
  scoring: { distanceScale: 28 },
  phases: [
    {
      id: 'up',
      label: 'Stand',
      entry: { op: 'gte', metric: 'kneeAvgDeg', value: 155 },
      exit: { op: 'lte', metric: 'kneeAvgDeg', value: 150 },
      targets: [
        {
          id: 'up_torso',
          label: 'Torso posture',
          weight: 1,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 0, max: 22 },
          cueIncrease: 'Lift the chest and keep the spine neutral.',
          cueDecrease: 'Reduce excessive lean and brace the trunk.'
        },
        {
          id: 'up_hip',
          label: 'Hip extension',
          weight: 1,
          rule: { op: 'gte', metric: 'hipAvgDeg', value: 150 },
          cueIncrease: 'Finish the rep by standing taller through the hips.',
          cueDecrease: 'Avoid snapping into an overextended lockout.'
        }
      ]
    },
    {
      id: 'descent',
      label: 'Descent',
      entry: { op: 'lte', metric: 'kneeAvgDeg', value: 150 },
      exit: { op: 'lte', metric: 'kneeAvgDeg', value: 105 },
      targets: [
        {
          id: 'descent_torso',
          label: 'Descent torso angle',
          weight: 1.2,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 8, max: 35 },
          cueIncrease: 'Sit the hips back and allow a controlled forward lean.',
          cueDecrease: 'Do not fold too far forward; keep the core tighter.'
        },
        {
          id: 'descent_knee',
          label: 'Descent knee angle',
          weight: 1,
          rule: { op: 'between', metric: 'kneeAvgDeg', min: 95, max: 150 },
          cueIncrease: 'Keep descending to reach a fuller squat depth.',
          cueDecrease: 'Control the drop instead of diving too fast or too deep.'
        }
      ]
    },
    {
      id: 'bottom',
      label: 'Bottom',
      entry: { op: 'lte', metric: 'kneeAvgDeg', value: 105 },
      exit: { op: 'gte', metric: 'kneeAvgDeg', value: 112 },
      targets: [
        {
          id: 'bottom_depth',
          label: 'Bottom depth',
          weight: 1.3,
          rule: { op: 'between', metric: 'kneeAvgDeg', min: 80, max: 110 },
          cueIncrease: 'Go slightly deeper if you can stay stable.',
          cueDecrease: 'Depth is excessive for this rep; prioritize control first.'
        },
        {
          id: 'bottom_torso',
          label: 'Bottom torso stability',
          weight: 1,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 10, max: 38 },
          cueIncrease: 'A bit more lean can help keep balance at the bottom.',
          cueDecrease: 'The torso is tipping too far; brace harder before standing up.'
        },
        {
          id: 'bottom_stability',
          label: 'Bottom stability',
          weight: 1.1,
          rule: { op: 'gte', metric: 'stabilityScore', value: 70 },
          cueIncrease: 'Pause briefly and stabilize before driving up.',
          cueDecrease: 'Stability is already good here, keep this control.'
        }
      ]
    },
    {
      id: 'ascent',
      label: 'Ascent',
      entry: { op: 'gte', metric: 'kneeAvgDeg', value: 112 },
      exit: { op: 'gte', metric: 'kneeAvgDeg', value: 158 },
      targets: [
        {
          id: 'ascent_torso',
          label: 'Ascent torso angle',
          weight: 1.2,
          rule: { op: 'between', metric: 'torsoInclineAbsDeg', min: 5, max: 30 },
          cueIncrease: 'Keep the chest open and rise with a stable torso.',
          cueDecrease: 'Avoid collapsing the chest on the way up.'
        },
        {
          id: 'ascent_knee',
          label: 'Ascent knee extension',
          weight: 1,
          rule: { op: 'gte', metric: 'kneeAvgDeg', value: 140 },
          cueIncrease: 'Keep extending through the knees and hips to finish the rep.',
          cueDecrease: 'Do not forcefully snap the knees at the top.'
        }
      ]
    }
  ]
}
