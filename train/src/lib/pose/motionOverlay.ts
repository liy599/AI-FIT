import type { MotionCompareOutput, MotionMetricName } from './motionCompare'
import type { MoveNetName } from './movenetTracker'

export type MotionOverlay = {
  errorJoints: MoveNetName[]
  errorBones: Array<[MoveNetName, MoveNetName]>
}

export function buildMotionOverlay(out: MotionCompareOutput | null): MotionOverlay {
  if (!out) return { errorJoints: [], errorBones: [] }
  const errorJoints = new Set<MoveNetName>()
  const errorBones: Array<[MoveNetName, MoveNetName]> = []
  const boneKeys = new Set<string>()

  for (const t of out.targets) {
    if (t.direction === 'ok') continue
    const anatomy = anatomyForMetric(t.rule.metric)
    for (const j of anatomy.joints) errorJoints.add(j)
    for (const [a, b] of anatomy.bones) {
      const k = boneKey(a, b)
      if (boneKeys.has(k)) continue
      boneKeys.add(k)
      errorBones.push([a, b])
    }
  }

  return { errorJoints: Array.from(errorJoints), errorBones }
}

function anatomyForMetric(metric: MotionMetricName): { joints: MoveNetName[]; bones: Array<[MoveNetName, MoveNetName]> } {
  if (metric === 'kneeLeftDeg') {
    return { joints: ['left_hip', 'left_knee', 'left_ankle'], bones: [['left_hip', 'left_knee'], ['left_knee', 'left_ankle']] }
  }
  if (metric === 'kneeRightDeg') {
    return { joints: ['right_hip', 'right_knee', 'right_ankle'], bones: [['right_hip', 'right_knee'], ['right_knee', 'right_ankle']] }
  }
  if (metric === 'kneeAvgDeg') {
    return {
      joints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
      bones: [
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
      ]
    }
  }
  if (metric === 'hipLeftDeg') {
    return { joints: ['left_shoulder', 'left_hip', 'left_knee'], bones: [['left_shoulder', 'left_hip'], ['left_hip', 'left_knee']] }
  }
  if (metric === 'hipRightDeg') {
    return { joints: ['right_shoulder', 'right_hip', 'right_knee'], bones: [['right_shoulder', 'right_hip'], ['right_hip', 'right_knee']] }
  }
  if (metric === 'hipAvgDeg') {
    return {
      joints: ['left_shoulder', 'left_hip', 'left_knee', 'right_shoulder', 'right_hip', 'right_knee'],
      bones: [
        ['left_shoulder', 'left_hip'],
        ['left_hip', 'left_knee'],
        ['right_shoulder', 'right_hip'],
        ['right_hip', 'right_knee']
      ]
    }
  }
  if (metric === 'torsoInclineLeftDeg') {
    return { joints: ['left_shoulder', 'left_hip'], bones: [['left_shoulder', 'left_hip']] }
  }
  if (metric === 'torsoInclineRightDeg') {
    return { joints: ['right_shoulder', 'right_hip'], bones: [['right_shoulder', 'right_hip']] }
  }
  if (metric === 'torsoInclineAbsDeg') {
    return {
      joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
      bones: [
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip']
      ]
    }
  }
  if (metric === 'stabilityScore') {
    return {
      joints: ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
      bones: [
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
      ]
    }
  }
  return { joints: [], bones: [] }
}

function boneKey(a: MoveNetName, b: MoveNetName) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

