export type PoseTeachingCopy = {
  cameraAngle: string
  tipsLines: string[]
}

const TEACHING_COPY_BY_SLUG: Record<string, PoseTeachingCopy> = {
  pushup: {
    cameraAngle: 'Place your camera at a true side view (about 90°) so your whole body stays in frame.',
    tipsLines: [
      'Start in a straight line from head to heels.',
      'Hands under shoulders, core tight.',
      'Lower with control until elbows reach about 90°.',
      'Keep elbows slightly tucked (not flared).',
      'Press up by pushing the floor away; avoid hips sagging or piking; keep neck neutral.'
    ]
  },
  'bent-over-row': {
    cameraAngle: 'Use a side view (about 60°-90°) to clearly see your hip hinge and dumbbell path.',
    tipsLines: [
      'Hinge at the hips with a flat back; knees softly bent; chest proud.',
      'Keep your torso angle stable.',
      'Pull dumbbells toward lower ribs/waist by driving elbows back close to your body.',
      'Pause briefly at the top.',
      'Lower slowly without swinging; avoid shrugging; avoid using momentum.'
    ]
  },
  'lateral-raise': {
    cameraAngle: 'Set the camera directly in front (0°) so both arms are equally visible.',
    tipsLines: [
      'Stand tall with a slight bend in the elbows.',
      'Raise dumbbells to about shoulder height.',
      "Keep shoulders down (don't shrug) and wrists neutral.",
      'Lead with elbows slightly higher than wrists.',
      "Control the lowering phase; avoid rocking your torso to 'cheat' the weight up."
    ]
  },
  squat: {
    cameraAngle: 'Use a 30°-45° front angle (or a true side view at 90°) to capture hips, knees, and ankles clearly.',
    tipsLines: [
      'Feet about shoulder-width; toes slightly out; brace core before descending.',
      'Sit hips down and back; let knees track over toes.',
      'Keep heels planted and chest up.',
      'Aim for depth you can control.',
      'Stand by pushing the floor away and driving hips up.',
      'Avoid knees collapsing inward; avoid bouncing at the bottom.'
    ]
  }
}

export function getPoseTeachingCopy(exerciseSlug: string): PoseTeachingCopy | null {
  return TEACHING_COPY_BY_SLUG[exerciseSlug] ?? null
}
