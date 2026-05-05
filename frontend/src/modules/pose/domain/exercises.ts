export type PoseExerciseSlug = 'squat' | 'lateral-raise' | 'pushup' | 'bent-over-row'

export type PoseExerciseDefinition = {
  slug: PoseExerciseSlug
  id: string
  displayName: string
  exerciseType: string
  liveSubtitle: string
  liveStageTip: string
  completedRepsTip: string
  secondaryMetricLabel: string
  secondaryMetricTip: string
  rangeSectionTitle: string
  rangeAlignmentLabel: string
  rangeAlignmentTip: string
  offlineInstructionPlaceholder: string
  guideTitle: string
  guideTips: Array<{ title: string; content: string }>
}

const POSE_EXERCISES: Record<PoseExerciseSlug, PoseExerciseDefinition> = {
  squat: {
    slug: 'squat',
    id: 'squat',
    displayName: 'Deep Squat',
    exerciseType: 'squat',
    liveSubtitle: 'Real-time squatting movement guidance - Your personal trainer',
    liveStageTip: 'Current squat phase recognized by the analyzer.',
    completedRepsTip: 'Number of squat reps detected in this session.',
    secondaryMetricLabel: 'Knee Bend',
    secondaryMetricTip: 'Estimated knee joint angle during your movement.',
    rangeSectionTitle: 'Rep Validity Check',
    rangeAlignmentLabel: 'Side-View Angle',
    rangeAlignmentTip: 'This is your view alignment angle (°). Lower is better for squat validity; keep your body profile to the camera.',
    offlineInstructionPlaceholder: 'e.g. Focus on squat bottom stability and torso lean',
    guideTitle: 'Squat Camera Tips',
    guideTips: [
      { title: '1) Full body in frame', content: 'Make sure your entire body is visible in the camera view.' },
      { title: '2) Clear side view', content: 'Stand sideways to the camera so joints are easier to track.' },
      { title: '3) Privacy', content: 'Pose detection runs locally in your browser. We do not upload your video.' }
    ]
  },
  pushup: {
    slug: 'pushup',
    id: 'pushup',
    displayName: 'Push-Up',
    exerciseType: 'pushup',
    liveSubtitle: 'Real-time push-up coaching for depth, rhythm, and body alignment',
    liveStageTip: 'Current push-up phase recognized by the analyzer.',
    completedRepsTip: 'Number of push-up reps detected in this session.',
    secondaryMetricLabel: 'Elbow Bend',
    secondaryMetricTip: 'Estimated elbow flexion angle during the push-up.',
    rangeSectionTitle: 'Depth Check',
    rangeAlignmentLabel: 'Camera Side Alignment',
    rangeAlignmentTip: 'Use a side-view so shoulder, hip, and elbow alignment can be tracked clearly.',
    offlineInstructionPlaceholder: 'e.g. Focus on push-up depth and keeping the trunk rigid',
    guideTitle: 'Push-Up Camera Tips',
    guideTips: [
      { title: '1) Side view works best', content: 'Set the camera to your side so elbow depth is easier to evaluate.' },
      { title: '2) Keep full body in frame', content: 'Head, shoulders, hips, knees, and feet should remain visible.' },
      { title: '3) Keep a straight line', content: 'Brace your core and avoid letting the hips sag during reps.' }
    ]
  },
  'lateral-raise': {
    slug: 'lateral-raise',
    id: 'lateral_raise',
    displayName: 'Lateral Raise',
    exerciseType: 'lateral_raise',
    liveSubtitle: 'Real-time lateral raise coaching for shoulder control and symmetry',
    liveStageTip: 'Current lateral raise phase recognized by the analyzer.',
    completedRepsTip: 'Number of lateral raise reps detected in this session.',
    secondaryMetricLabel: 'Arm Raise Angle',
    secondaryMetricTip: 'Estimated shoulder abduction angle during the raise.',
    rangeSectionTitle: 'Form Check',
    rangeAlignmentLabel: 'Camera Front Alignment',
    rangeAlignmentTip: 'Face the camera directly so both shoulders and arms are visible at the same time.',
    offlineInstructionPlaceholder: 'e.g. Focus on shoulder symmetry and minimizing torso sway',
    guideTitle: 'Lateral Raise Camera Tips',
    guideTips: [
      { title: '1) Face the camera', content: 'Stand facing the camera so both arms are visible throughout the rep.' },
      { title: '2) Keep full upper body in frame', content: 'Include shoulders, elbows, wrists, and hips for stable tracking.' },
      { title: '3) Move under control', content: 'Raise both arms together and avoid swinging your torso.' }
    ]
  },
  'bent-over-row': {
    slug: 'bent-over-row',
    id: 'bent_over_row',
    displayName: 'Bent-Over Row',
    exerciseType: 'bent_over_row',
    liveSubtitle: 'Real-time bent-over row coaching for back strength and form',
    liveStageTip: 'Current bent-over row phase recognized by the analyzer.',
    completedRepsTip: 'Number of bent-over row reps detected in this session.',
    secondaryMetricLabel: 'Elbow Bend',
    secondaryMetricTip: 'Estimated elbow flexion angle during the row.',
    rangeSectionTitle: 'Form Check',
    rangeAlignmentLabel: 'Camera Side Alignment',
    rangeAlignmentTip: 'Use a side-view so elbow bend and back alignment can be tracked clearly.',
    offlineInstructionPlaceholder: 'e.g. Focus on keeping back flat and pulling to the hips',
    guideTitle: 'Bent-Over Row Camera Tips',
    guideTips: [
      { title: '1) Side view works best', content: 'Stand sideways to the camera so elbow bend is easier to evaluate.' },
      { title: '2) Keep full upper body in frame', content: 'Include shoulders, elbows, wrists, and hips for stable tracking.' },
      { title: '3) Control the tempo', content: 'Pull the dumbbells to your hips and lower under control without swinging.' }
    ]
  }
}

export function getPoseExerciseBySlug(slug: string | undefined): PoseExerciseDefinition {
  if (slug === 'lateral-raise') return POSE_EXERCISES['lateral-raise']
  if (slug === 'pushup') return POSE_EXERCISES.pushup
  if (slug === 'bent-over-row') return POSE_EXERCISES['bent-over-row']
  return POSE_EXERCISES.squat
}

export function getPoseExerciseByType(exerciseType: string | null | undefined): PoseExerciseDefinition {
  if (exerciseType === 'lateral_raise') return POSE_EXERCISES['lateral-raise']
  if (exerciseType === 'pushup') return POSE_EXERCISES.pushup
  if (exerciseType === 'bent_over_row') return POSE_EXERCISES['bent-over-row']
  return POSE_EXERCISES.squat
}

export function buildPoseGuidePath(slug: PoseExerciseSlug) {
  return `/tools/pose/${slug}`
}

export function buildPoseToolPath(slug: PoseExerciseSlug) {
  return `/tools/pose/${slug}/live`
}

export function buildPoseVideoPath(slug: PoseExerciseSlug) {
  return `/tools/pose/${slug}/video`
}

export function buildPoseHistoryPath(slug: PoseExerciseSlug) {
  return `/tools/pose/${slug}/history`
}

export function buildPoseReportPath(slug: PoseExerciseSlug, sessionId: string | number) {
  return `/tools/pose/${slug}/history/${sessionId}`
}


