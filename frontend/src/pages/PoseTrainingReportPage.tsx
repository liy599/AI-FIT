import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildTrainingRecordName,
  DEMO_POSE_TRAINING,
  DEMO_POSE_TRAINING_ID,
  getPoseExerciseBySlug,
  getPoseExerciseByType,
  getPoseTraining,
  humanizePoseReport,
  ReportVisualization,
  type PoseTrainingSession
} from '../modules/pose'

export default function PoseTrainingReportPage() {
  const params = useParams<{ exerciseSlug: string; sessionId: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const sessionId = useMemo(() => Number(params.sessionId), [params.sessionId])
  const [session, setSession] = useState<PoseTrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    if (!Number.isFinite(sessionId)) {
      setError('Invalid training session id.')
      setSession(null)
      setLoading(false)
      return () => {
        active = false
      }
    }

    if (sessionId === DEMO_POSE_TRAINING_ID) {
      setSession(DEMO_POSE_TRAINING)
      setLoading(false)
      return () => {
        active = false
      }
    }

    getPoseTraining(sessionId)
      .then((data) => {
        if (!active) return
        setSession(data)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load training report')
        setSession(null)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const computed = useMemo(() => {
    if (!session) return null
    const reps = session.sets.reduce((total, setItem) => total + (setItem.reps ?? 0), 0)
    const sessionExerciseType = session.sets[0]?.exercise_type ?? 'squat'
    const derivedName = buildTrainingRecordName({
      startedAt: session.started_at,
      exerciseName: getPoseExerciseByType(sessionExerciseType).displayName
    })
    const sessionName = session.id === DEMO_POSE_TRAINING_ID ? 'Demo Session' : (session.note?.trim() || derivedName)
    const displayReport =
      session.report && isRecord(session.report) && (isRecord(session.report.keyMetrics) || Array.isArray(session.report.issues) || Array.isArray(session.report.suggestions))
        ? (humanizePoseReport(session.report as never) as unknown as Record<string, unknown>)
        : session.report
    return { reps, sessionName, sessionExerciseType, displayReport }
  }, [session])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Training Report</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span><Link to={buildPoseHistoryPath(exercise.slug)}>History</Link></span>
                    <span>Report</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 pose-tool-page">
        <div className="page-container">
          <div className="pose-history-head mb-30">
            <h4 className="cl_blog-widget-title mb-0">{computed?.sessionName ?? 'Training Report'}</h4>
            <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
              Back to History
            </Link>
          </div>

          {loading ? <p className="pose-muted-copy">Loading report...</p> : null}
          {error ? <div className="pose-error-box pose-error-box-light">{error}</div> : null}

          {!loading && !error && session ? (
            <div className="pose-video-layout pose-tool-video-grid">
              <div className="pose-tool-video-col pose-tool-video-col-report">
                <div className="cl_blog-widget mb-30 w-100">
                  <div className="pose-history-meta">
                    <span>Started: {formatDateTime(session.started_at)}</span>
                    <span>Ended: {session.ended_at ? formatDateTime(session.ended_at) : 'In progress'}</span>
                    <span>Total Reps: {computed?.reps ?? 0}</span>
                    <span>Sets: {session.sets.length}</span>
                  </div>

                  {computed?.displayReport && isRecord(computed.displayReport) ? (
                    <div className="pose-report-content-top">
                      <ReportVisualization report={computed.displayReport as never} />
                    </div>
                  ) : (
                    <div className="pose-report-empty">
                      <strong>No report data</strong>
                      <p>This training session does not have a report saved yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}


