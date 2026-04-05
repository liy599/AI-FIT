import { SQUAT_SIDE_STANDARD_V1 } from './motionStandards'
import type { MotionStandard } from './motionCompare'

export function shouldUseSquatSideStandard(input: { viewAngle: string; exerciseName: string | null | undefined }) {
  if (input.viewAngle !== 'side') return false
  const name = input.exerciseName ?? ''
  return /深蹲|squat/i.test(name)
}

export function chooseMotionStandard(input: { viewAngle: string; exerciseName: string | null | undefined }): MotionStandard | null {
  if (shouldUseSquatSideStandard(input)) return SQUAT_SIDE_STANDARD_V1
  return null
}
