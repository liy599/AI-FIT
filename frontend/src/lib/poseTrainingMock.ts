import type { PoseTrainingSession } from './poseApi'

export const DEMO_POSE_TRAINING_ID = 0

export const DEMO_POSE_TRAINING: PoseTrainingSession = {
  id: DEMO_POSE_TRAINING_ID,
  started_at: '2026-04-10T09:30:00Z',
  ended_at: '2026-04-10T09:36:00Z',
  note: 'Demo training session for UI preview',
  report: {
    summary: 'Good squat rhythm overall. Keep chest up at the bottom and control knee tracking on ascent.',
    keyMetrics: {
      totalReps: 12,
      correctReps: 9,
      accuracyPct: 75
    },
    issues: [
      { message: 'Knees cave in slightly on reps 4 and 9', severity: 'medium', atFrame: 124 },
      { message: 'Torso leans forward at bottom position', severity: 'medium', atFrame: 196 }
    ],
    suggestions: [
      'Drive knees outward during ascent and keep feet tripod stable.',
      'Brace core before descent to maintain upright torso.',
      'Use a slower tempo for the last 3 reps to keep consistency.'
    ]
  },
  sets: [
    { id: 1, exercise_type: 'squat', set_order: 1, reps: 12, weight: null, note: 'Bodyweight' }
  ]
}
