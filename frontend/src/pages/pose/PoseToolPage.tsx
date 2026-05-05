import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PoseLiveModePanels } from '../../components/pose/PoseLivePanels'
import { PoseOfflineAnalysisPanel, PoseOfflineReportPanel, PoseOfflineTeachingPanel } from '../../components/pose/PoseOfflinePanels'
import { useAuth } from '../../state/auth-context'
import {
  ReportVisualization,
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseToolPath,
  buildPoseVideoPath,
  getPoseExerciseBySlug,
  getPoseTeachingCopy,
  getTutorialVideoSrc,
  resolvePoseToolMode,
  useLivePoseRuntime,
  useOfflinePoseRuntime,
  usePosePolicyRuntime,
  type PoseToolMode
} from '../../modules/pose'

export default function PoseToolPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const { user } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  const mode = useMemo<PoseToolMode>(() => resolvePoseToolMode(location.pathname, location.search), [location.pathname, location.search])
  const policy = usePosePolicyRuntime()
  const liveRuntime = useLivePoseRuntime({ exercise, policy, user })
  const offlineRuntime = useOfflinePoseRuntime({ exercise, policy, user, mode })
  const tutorialVideoSrc = getTutorialVideoSrc(exercise.slug, exercise.displayName)
  const teachingCopy = getPoseTeachingCopy(exercise.slug)

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Pose Tool</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span>{mode === 'live' ? 'Live Coaching' : 'Video Analysis'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 pose-tool-page">
        <div className="page-container">
          <div className="pose-mode-switch mb-30">
            <button
              className={mode === 'live' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'}
              onClick={() => nav(buildPoseToolPath(exercise.slug))}
              type="button"
            >
              Live Coaching
            </button>
            <button
              className={mode === 'offline' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'}
              onClick={() => nav(buildPoseVideoPath(exercise.slug))}
              type="button"
            >
              Video Analysis
            </button>
            <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn pose-mode-switch__history">
              Training History
            </Link>
          </div>

          {mode === 'live' ? (
            <div className="pose-live-layout pose-live-shell pose-tool-live-grid">
              <PoseLiveModePanels
                exerciseDisplayName={exercise.displayName}
                liveSubtitle={exercise.liveSubtitle}
                liveStageTip={exercise.liveStageTip}
                secondaryMetricLabel={exercise.secondaryMetricLabel}
                secondaryMetricTip={exercise.secondaryMetricTip}
                teachingCopy={teachingCopy}
                tutorialVideoSrc={tutorialVideoSrc}
                {...liveRuntime.panelProps}
              />
            </div>
          ) : (
            <div className="pose-video-layout pose-tool-video-grid">
              <div className="pose-tool-video-col pose-tool-video-col-main">
                <PoseOfflineAnalysisPanel
                  exerciseDisplayName={exercise.displayName}
                  {...offlineRuntime.analysisPanelProps}
                />
              </div>

              <div className="pose-tool-video-col pose-tool-video-col-teaching">
                <PoseOfflineTeachingPanel
                  exerciseDisplayName={exercise.displayName}
                  teachingCopy={teachingCopy}
                  tutorialVideoSrc={tutorialVideoSrc}
                />
              </div>

              <div className="pose-tool-video-col pose-tool-video-col-report">
                <PoseOfflineReportPanel
                  {...offlineRuntime.reportPanelProps}
                  reportContent={offlineRuntime.offlineReport ? <ReportVisualization report={offlineRuntime.offlineReport} /> : null}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
