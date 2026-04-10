import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildPoseGuidePath, buildPoseHistoryPath, buildPoseToolPath, getPoseExerciseBySlug } from '../lib/pose/exercises'
import { getPoseTraining, type PoseTrainingSession } from '../lib/poseApi'
import { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from '../lib/poseTrainingMock'

export default function PoseTrainingReportPage() {
  const params = useParams<{ exerciseSlug: string; sessionId: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
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
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span><Link to={buildPoseToolPath(exercise.slug)}>Tool</Link></span>
                    <span><Link to={buildPoseHistoryPath(exercise.slug)}>History</Link></span>
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
                  <h4 className="cl_blog-widget-title mb-0">{exercise.displayName} Session Report {session ? `#${session.id}` : ''}</h4>
                  <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
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
  if (!report) return <p className="pose-muted-copy">No archived report content.</p>

  const keyMetrics = asRecord(report.keyMetrics) ?? {}
  const displayMetrics = normalizeDisplayMetrics(keyMetrics, report)
  const rawSuggestions = Array.isArray(report.suggestions) ? report.suggestions.filter((x): x is string => typeof x === 'string') : []
  const suggestions = rawSuggestions.length > 0 ? rawSuggestions : typeof report.currentSuggestion === 'string' ? [report.currentSuggestion] : []
  const rawIssues = Array.isArray(report.issues) ? report.issues : []
  const issues = rawIssues.map((item) => {
    if (typeof item === 'string') return item
    if (typeof item === 'object' && item && typeof (item as { message?: unknown }).message === 'string') {
      return (item as { message: string }).message
    }
    return JSON.stringify(item)
  })
  const fallbackWarnings = Array.isArray(report.warnings) ? report.warnings.filter((x): x is string => typeof x === 'string') : []
  const displayIssues = issues.length > 0 ? issues : fallbackWarnings

  return (
    <div className="pose-report-stack" style={{ marginTop: 12 }}>
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{typeof report.summary === 'string' && report.summary.trim() ? report.summary : 'No summary'}</div>
      </div>

      {displayMetrics.length > 0 ? (
        <div className="pose-report-metrics">
          {displayMetrics.map((item) => (
            <div key={item.key} className="pose-report-card">
              <div className="pose-report-label">{item.label}</div>
              <div className="pose-report-value pose-report-value-small">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="pose-report-columns">
        <div className="pose-report-card">
          <div className="pose-report-title">Issues</div>
          {displayIssues.length === 0 ? <div className="pose-muted-copy">No issues</div> : null}
          {displayIssues.length > 0 ? (
            <ul className="pose-detail-list pose-detail-list-light">
              {displayIssues.map((item, idx) => (
                <li key={`${idx}-${item}`}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="pose-report-card">
          <div className="pose-report-title">Suggestions</div>
          {suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions</div> : null}
          {suggestions.length > 0 ? (
            <ol className="pose-report-suggestions">
              {suggestions.map((item, idx) => (
                <li key={`${idx}-${item}`}>{item}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>

    </div>
  )
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function normalizeDisplayMetrics(keyMetrics: Record<string, unknown>, report: Record<string, unknown>) {
  const hiddenKeys = new Set(['avgKneeAngleDeg', 'avgTorsoLeanDeg'])
  const display: Array<{ key: string; label: string; value: string }> = []

  for (const [key, raw] of Object.entries(keyMetrics)) {
    if (hiddenKeys.has(key)) continue
    if (raw == null) continue
    display.push({ key, label: prettyMetricLabel(key), value: formatMetricValue(raw) })
  }

  if (display.length === 0) {
    const fallback = [
      ['totalReps', report.repCount],
      ['correctReps', report.correctCount],
      ['incorrectReps', report.incorrectCount],
      ['formAccuracyPct', report.accuracyPct]
    ] as Array<[string, unknown]>
    for (const [key, raw] of fallback) {
      if (raw == null) continue
      display.push({ key, label: prettyMetricLabel(key), value: formatMetricValue(raw) })
    }
  }

  return display.slice(0, 6)
}

function prettyMetricLabel(key: string) {
  if (key === 'formAccuracyPct' || key === 'accuracyPct') return 'Form Accuracy'
  if (key === 'totalReps' || key === 'repCount') return 'Total Reps'
  if (key === 'correctReps' || key === 'correctCount') return 'Correct Reps'
  if (key === 'incorrectReps' || key === 'incorrectCount') return 'Incorrect Reps'
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

function formatMetricValue(value: unknown) {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return Number.isInteger(value) ? String(value) : value.toFixed(1)
    return '-'
  }
  if (typeof value === 'string' && value.trim()) return value
  return '-'
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}
