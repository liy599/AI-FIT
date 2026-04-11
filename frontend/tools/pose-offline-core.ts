import { analyzeGenericMotion } from '../src/lib/pose/genericMotion'
import type { PoseFrame } from '../src/lib/pose/mediapipePose'
import type { PoseAnalysisReport } from '../src/lib/pose/report'
import { buildGenericMotionReport } from '../src/lib/pose/report'
import { buildSquatVideoLiveStyleReport } from '../src/lib/pose/analyzer/squatReport'

export type PoseBenchmarkCaseV1 = {
  schemaVersion: 1
  id: string
  exercise: { slug: string; name?: string | null }
  viewAngle: 'unknown' | 'front' | 'side' | 'back'
  fps: number
  frames: PoseFrame[]
  note?: string | null
  meta?: Record<string, unknown>
}

export function runOfflineCase(input: PoseBenchmarkCaseV1): PoseAnalysisReport {
  const exerciseName = input.exercise.name ?? input.exercise.slug
  if (input.exercise.slug === 'squat') {
    return buildSquatVideoLiveStyleReport({
      taskId: input.id,
      viewAngle: input.viewAngle,
      exercise: { id: input.exercise.slug, name: exerciseName },
      video: null,
      fps: input.fps,
      frames: input.frames
    })
  }

  const analysis = analyzeGenericMotion(input.frames)
  return buildGenericMotionReport({
    taskId: input.id,
    viewAngle: input.viewAngle,
    instruction: null,
    exercise: { id: input.exercise.slug, name: exerciseName },
    video: null,
    fps: input.fps,
    analysis
  })
}
