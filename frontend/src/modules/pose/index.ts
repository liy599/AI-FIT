/**
 * Pose feature facade.
 * Pages and shared UI import only business-level Pose capabilities from here.
 */
export {
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseReportPath,
  buildPoseVideoPath,
  getPoseExercises,
  getPoseExerciseBySlug,
  getPoseExerciseByType,
  isPoseExerciseSlug
} from './domain/exercises'
export { buildTrainingRecordName } from './domain/trainingName'
export { type TrackingState } from './vision/movenetTracker'
export { type PoseAnalysisReport } from './reporting/types'
export { type PoseAnalyzerFeedback } from './analyzer/types'
export { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from './trainingMock'
export { LabelWithTip, MetricCard, MetricCardPlaceholder } from '../../components/pose/PoseMetricWidgets'
export { ReportVisualization } from '../../components/pose/PoseToolWidgets'
export { createPoseTraining, deletePoseTraining, getPosePolicy, getPoseTraining, listPoseTrainings, updatePoseTrainingReport } from './api'
export type { PosePolicy, PoseTrainingSession } from './api'
export { humanizePoseReport, mapPoseFeedbackMessage, poseTierLabel } from './reporting'
export { formatDuration } from './helpers/reportBase'
export { usePosePolicyRuntime } from './policy'
export type { PosePolicyRuntime, PoseRuntimeRules } from './policy'
export { useOfflinePoseRuntime } from './runtime/offline'
export type {
  OfflineOverlayTone,
  OfflineProgress,
  OfflineReplayData
} from './runtime/types'
export { getPoseTeachingCopy, getTutorialVideoSrc } from './runtime/toolUi'
export type { PoseTeachingCopy } from './runtime/toolUi'
