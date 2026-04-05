import type { MotionStandard } from './motionCompare'
import { SQUAT_SIDE_STANDARD_V1 } from './motionStandards'

export function chooseMotionStandard(input: { viewAngle: string; exerciseName: string | null | undefined }): MotionStandard | null {
  if (input.viewAngle !== 'side') return null
  const name = input.exerciseName ?? ''
  return /squat|深蹲/i.test(name) ? SQUAT_SIDE_STANDARD_V1 : null
}
