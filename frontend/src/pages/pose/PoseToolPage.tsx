import { Link, useParams } from 'react-router-dom'
import { PoseOfflineAnalysisPanel, PoseOfflineReportPanel, PoseOfflineTeachingPanel } from '../../components/pose/PoseOfflinePanels'
import { useAuth } from '../../state/auth-context'
import {
  ReportVisualization,
  buildPoseGuidePath,
  buildPoseHistoryPath,
  getPoseExerciseBySlug,
  getPoseTeachingCopy,
  getTutorialVideoSrc,
  useOfflinePoseRuntime,
  usePosePolicyRuntime
} from '../../modules/pose'

export default function PoseToolPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const { user } = useAuth()
  const policy = usePosePolicyRuntime()
  const offlineRuntime = useOfflinePoseRuntime({ exercise, policy, user })
  const tutorialVideoSrc = getTutorialVideoSrc(exercise.slug, exercise.displayName)
  const teachingCopy = getPoseTeachingCopy(exercise.slug)

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Pose Tool</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span>Video Analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 pose-tool-page brand-page-body">
        <div className="page-container">
          <div className="pose-mode-switch mb-30">
            <span className="cl_theme-btn">Video Analysis</span>
            <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn pose-mode-switch__history">
              Training History
            </Link>
          </div>

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
        </div>
      </section>
    </>
  )
}
