import type { ExerciseMovementType } from '@prisma/client'

export const EXERCISE_ROOT_NAME = 'Exercises'

export const BUILTIN_MAJOR_CATEGORIES = [
  'Legs',
] as const

export type BuiltinExerciseSeed = {
  name: string
  movementType: ExerciseMovementType
  categoryPath: [major: string, detail: string]
}

export const BUILTIN_EXERCISES: BuiltinExerciseSeed[] = [
  { name: 'Squat', movementType: 'strength', categoryPath: ['Legs', 'Bodyweight'] }
]

export const MOVEMENT_TYPE_OPTIONS: Array<{ value: ExerciseMovementType; label: string }> = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'reps_only', label: 'Reps only' },
  { value: 'duration_only', label: 'Time only' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'tabata', label: 'Tabata' }
]
