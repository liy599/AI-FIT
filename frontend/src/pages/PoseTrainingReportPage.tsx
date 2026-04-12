import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPoseExerciseByType } from '../lib/pose/exercises'
import { getPoseTraining, type PoseTrainingSession } from '../lib/poseApi'
import { buildTrainingRecordName } from '../lib/pose/trainingName'
import { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from '../lib/poseTrainingMock'

export default function PoseTrainingReportPage() {
  const params = useParams<{ exerciseSlug: string; sessionId: string }>()
  const historyPath = `/tools/pose/${params.exerciseSlug || 'squat'}/tool/history`
  const sessionId = Number(params.sessionId)
  const [session, setSession] = useState<PoseTrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isInteger(sessionId)) {
      setLoading(false)
      setError('Invalid training session id')
      return
    }
    if (sessionId === DEMO_POSE_TRAINING_ID) {
      setSession(DEMO_POSE_TRAINING)
      setLoading(false)
      setError(null)
      return
    }
    if (sessionId <= 0) {
      setLoading(false)
      setError('Invalid training session id')
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    getPoseTraining(sessionId)
      .then((data) => {
        if (!active) return
        setSession(data)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load report')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const totalReps = useMemo(() => session?.sets.reduce((total, item) => total + (item.reps ?? 0), 0) ?? 0, [session])
  const sessionName = useMemo(() => {
    if (!session) return ''
    if (session.note?.trim()) return session.note.trim()
    const exerciseType = session.sets[0]?.exercise_type ?? 'squat'
    return buildTrainingRecordName({
      startedAt: session.started_at,
      exerciseName: getPoseExerciseByType(exerciseType).displayName
    })
  }, [session])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Training Report</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to={historyPath}>History</Link>
                    <span>Session</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-10 col-lg-11">
              <div className="cl_blog-widget mb-30">
                <div className="pose-history-head">
                  <h4 className="cl_blog-widget-title mb-0">{session ? sessionName : 'Session Report'}</h4>
                  <Link to={historyPath} className="pose-tool-ghost-btn pose-tool-light-btn">
                    Back to History
                  </Link>
                </div>

                {loading ? <p className="pose-muted-copy">Loading report...</p> : null}
                {error ? <div className="pose-error-box pose-error-box-light">{error}</div> : null}

                {session ? (
                  <>
                    <div className="pose-report-metrics pose-report-metrics-3">
                      <div className="pose-report-card">
                        <div className="pose-report-label">Started At</div>
                        <div className="pose-report-value pose-report-value-small">{formatDateTime(session.started_at)}</div>
                      </div>
                      <div className="pose-report-card">
                        <div className="pose-report-label">Ended At</div>
                        <div className="pose-report-value pose-report-value-small">{session.ended_at ? formatDateTime(session.ended_at) : 'In progress'}</div>
                      </div>
                      <div className="pose-report-card">
                        <div className="pose-report-label">Total Reps</div>
                        <div className="pose-report-value">{totalReps}</div>
                      </div>
                    </div>

                    <div className="pose-report-card" style={{ marginTop: 12 }}>
                      <div className="pose-report-title">Sets</div>
                      <ul className="pose-detail-list pose-detail-list-light">
                        {session.sets.map((item) => (
                          <li key={item.id}>
                            Set {item.set_order}: {item.exercise_type} x {item.reps}
                            {typeof item.weight === 'number' ? ` (${item.weight}kg)` : ''}
                            {item.note ? ` - ${item.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <PoseSavedReport report={session.report} />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function PoseSavedReport(props: { report: Record<string, unknown> | null }) {
  const report = props.report
  if (!report) {
    return (
      <div className="pose-report-card" style={{ marginTop: 12 }}>
        <div className="pose-report-title">Analysis Report</div>
        <p className="pose-muted-copy">No archived report content.</p>
      </div>
    )
  }

  const keyMetrics = asRecord(report.keyMetrics) ?? {}
  const issues = Array.isArray(report.issues) ? report.issues : []
  const suggestions = Array.isArray(report.suggestions) ? report.suggestions.filter((x): x is string => typeof x === 'string') : []

  return (
    <div className="pose-report-stack" style={{ marginTop: 12 }}>
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{typeof report.summary === 'string' && report.summary.trim() ? report.summary : 'No summary'}</div>
      </div>

      <div className="pose-report-metrics">
        {Object.entries(keyMetrics).map(([key, value]) => (
          <div key={key} className="pose-report-card">
            <div className="pose-report-label">{key}</div>
            <div className="pose-report-value pose-report-value-small">{formatMetricValue(key, value)}</div>
          </div>
        ))}
      </div>

      <div className="pose-report-card">
        <div className="pose-report-title">Issues</div>
        {issues.length === 0 ? <div className="pose-muted-copy">No notable issues found.</div> : null}
        {issues.length > 0 ? (
          <div className="pose-report-issue-list">
            {issues.map((item, idx) => (
              <div key={idx} className="pose-report-issue">
                <strong>
                  {typeof item === 'object' && item !== null
                    ? String((item as Record<string, unknown>).message ?? (item as Record<string, unknown>).title ?? 'Issue')
                    : String(item)}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pose-report-card">
        <div className="pose-report-title">Suggestions</div>
        {suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions available.</div> : null}
        {suggestions.length > 0 ? (
          <ol className="pose-report-suggestions">
            {suggestions.map((item, idx) => (
              <li key={`${idx}-${item}`}>{item}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set([
    'coverage',
    'badFramePct',
    'accuracy',
    'accuracyPct',
    'formAccuracyPct',
    'score'
  ])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}
