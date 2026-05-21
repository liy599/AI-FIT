import { Link, useNavigate, useParams } from 'react-router-dom'
import { PoseOfflineAnalysisPanel, PoseOfflineReportPanel, PoseOfflineTeachingPanel } from '../../components/pose/PoseOfflinePanels'
import { useAuth } from '../../state/auth-context'
import {
  ReportVisualization,
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseReportPath,
  getPoseExerciseBySlug,
  getPoseTeachingCopy,
  getTutorialVideoSrc,
  humanizePoseReport,
  useOfflinePoseRuntime,
  usePosePolicyRuntime
} from '../../modules/pose'

export default function PoseToolPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const navigate = useNavigate()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const { user } = useAuth()
  const policy = usePosePolicyRuntime()
  const offlineRuntime = useOfflinePoseRuntime({ exercise, policy, user })
  const tutorialVideoSrc = getTutorialVideoSrc(exercise.slug, exercise.displayName)
  const teachingCopy = getPoseTeachingCopy(exercise.slug)
  const reportBlogDraft = offlineRuntime.offlineReport
    ? buildReportBlogDraft({
        report: humanizePoseReport(offlineRuntime.offlineReport as never) as unknown as Record<string, unknown>,
        exerciseName: exercise.displayName
      })
    : null
  const savedReportPath = offlineRuntime.offlineReportSessionId
    ? buildPoseReportPath(exercise.slug, offlineRuntime.offlineReportSessionId)
    : null

  function writeBlogFromCurrentReport() {
    if (!reportBlogDraft) return
    navigate('/blogs/new', {
      state: {
        template: 'training',
        reportDraft: reportBlogDraft,
        reportPath: savedReportPath
      }
    })
  }

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
                reportAction={reportBlogDraft ? (
                  <button
                    className="cl_theme-btn pose-report-blog-btn"
                    type="button"
                    onClick={writeBlogFromCurrentReport}
                  >
                    Write Post
                  </button>
                ) : null}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function buildReportBlogDraft(input: {
  report: Record<string, unknown>
  exerciseName: string
}) {
  const keyMetrics = isRecord(input.report.keyMetrics) ? input.report.keyMetrics : {}
  const startedAtRaw = input.report.generatedAt ?? input.report.createdAt ?? new Date().toISOString()
  const summary = typeof input.report.summary === 'string' ? input.report.summary.trim() : ''
  const totalReps = pickNumber(keyMetrics.totalReps, input.report.totalReps, input.report.repCount)
  const accuracy = pickPercent(keyMetrics.formAccuracyPct ?? input.report.formAccuracyPct ?? input.report.accuracyPct)
  const issues = Array.isArray(input.report.issues)
    ? input.report.issues
        .map((issue) => {
          if (typeof issue === 'string') return issue.trim()
          if (isRecord(issue) && typeof issue.message === 'string') return issue.message.trim()
          return ''
        })
        .filter(Boolean)
        .slice(0, 3)
    : []
  const suggestions = Array.isArray(input.report.suggestions)
    ? input.report.suggestions
        .map((suggestion) => (typeof suggestion === 'string' ? suggestion.trim() : ''))
        .filter(Boolean)
        .slice(0, 3)
    : []

  return {
    exerciseName: input.exerciseName,
    startedAt: typeof startedAtRaw === 'string' ? startedAtRaw : new Date().toISOString(),
    endedAt: null,
    reps: totalReps ?? 0,
    accuracy,
    summary,
    issues,
    suggestions
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function pickPercent(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.round(value)}%`
}
