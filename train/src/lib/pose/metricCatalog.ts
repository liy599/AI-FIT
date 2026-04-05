import type { PoseFrame } from './poseFrame'

export type PoseMetricName = keyof PoseFrame['metrics']

export const POSE_METRIC_DEFS: Record<PoseMetricName, { label: string; unit: string }> = {
  kneeLeftDeg: { label: 'Left knee', unit: 'deg' },
  kneeRightDeg: { label: 'Right knee', unit: 'deg' },
  kneeAvgDeg: { label: 'Knee (avg)', unit: 'deg' },
  hipLeftDeg: { label: 'Left hip', unit: 'deg' },
  hipRightDeg: { label: 'Right hip', unit: 'deg' },
  hipAvgDeg: { label: 'Hip (avg)', unit: 'deg' },
  torsoInclineLeftDeg: { label: 'Torso incline (left)', unit: 'deg' },
  torsoInclineRightDeg: { label: 'Torso incline (right)', unit: 'deg' },
  torsoInclineAbsDeg: { label: 'Torso incline (avg)', unit: 'deg' },
  centerX: { label: 'Center X', unit: 'norm' },
  centerY: { label: 'Center Y', unit: 'norm' },
  centerZ: { label: 'Center Z', unit: 'norm' },
  speed: { label: 'Center speed', unit: 'norm/s' },
  speedX: { label: 'Center speed X', unit: 'norm/s' },
  speedY: { label: 'Center speed Y', unit: 'norm/s' },
  stabilityScore: { label: 'Stability', unit: 'score' }
}
