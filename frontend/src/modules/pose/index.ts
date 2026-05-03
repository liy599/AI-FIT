/**
 * Pose feature facade.
 * Pages should import pose domain capabilities from here instead of deep lib paths.
 */
export { drawDistanceGuide, drawMidpointSkeleton, drawPoseJoints17, drawUpperLimbSkeleton } from '../../lib/pose/draw'
export { DistanceTracker, type DistanceState } from '../../lib/pose/distanceTracker'
export {
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseReportPath,
  buildPoseToolPath,
  buildPoseVideoPath,
  getPoseExerciseBySlug,
  getPoseExerciseByType
} from '../../lib/pose/exercises'
export { buildTrainingRecordName } from '../../lib/pose/trainingName'
export { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../../lib/pose/livePoseProvider'
export { extractNativePoseFromVideoUrlWithMoveNet, type MoveNetNativeFrame } from '../../lib/pose/movenetPose'
export { prewarmMoveNet } from '../../lib/pose/movenetPose'
export { MoveNetStabilizer, type TrackingState } from '../../lib/pose/movenetTracker'
export { type PoseAnalysisReport } from '../../lib/pose/report'
export { type RealtimeFeedback } from '../../lib/pose/realtimeSquat'
export { REALTIME_DEFAULT_SQUAT_TUNING, type SquatTuning } from '../../lib/pose/realtimeSquatAnalyzer'
export { humanizePoseReport, mapPoseFeedbackMessage, pickLiveMainTip, poseTierLabel } from '../../lib/pose/feedbackCopy'
export { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from '../../lib/poseTrainingMock'
export { createPoseTraining, getPoseTraining, getSquatTuningConfig, updateSquatTuningConfig } from '../../lib/poseApi'
export { listPoseTrainings, type PoseTrainingSession } from '../../lib/poseApi'
export { getPoseCapabilities, type PoseCapabilities } from '../../lib/poseApi'
export { getPosePolicy, type PosePolicy } from '../../lib/poseApi'
export { submitPoseServerAnalysis, cancelPoseServerAnalysis } from '../../lib/poseApi'
export { normalizeReportForArchive } from '../../lib/report/unified'
export {
  buildLiveSuggestions,
  collectLiveFrameIssueMessages,
  collectLiveIssueMessages,
  evaluateRangeCheck,
  getSessionComment,
  getTopIssues,
  getTopIssuesFromMessageFreq,
  getTopRepIssuesFromFindings
} from './helpers/live'
export { configureAnalyzer, createAnalyzer, getAnalyzerDefaults } from './helpers/analyzers'
export { formatDuration, getRepsFromReport, toIssueCode } from './helpers/reportBase'
export { resolveAnalyzerTuning } from './helpers/policyRules'
export { buildSquatAlignedReport, buildSquatVideoLiveStyleReport } from './helpers/squatReport'
export { buildPushupAlignedReport, buildPushupVideoLiveStyleReport } from './helpers/pushupReport'
export {
  buildLateralRaiseAlignedReport,
  buildLateralRaiseVideoLiveStyleReport
} from './helpers/lateralRaiseReport'
export {
  buildBentOverRowAlignedReport,
  buildBentOverRowVideoLiveStyleReport
} from './helpers/bentOverRowReport'
export {
  type RealtimeAnalyzer,
  type SquatRepFinding,
  type SquatTimelineRow
} from './helpers/types'
export { LabelWithTip, MetricCard, MetricCardPlaceholder } from '../../components/pose/PoseMetricWidgets'
export { ReportVisualization } from '../../components/pose/PoseToolWidgets'


