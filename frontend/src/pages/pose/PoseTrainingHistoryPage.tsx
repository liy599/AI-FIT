import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  buildPoseGuidePath,
  buildPoseToolPath,
  buildPoseReportPath,
  buildTrainingRecordName,
  DEMO_POSE_TRAINING,
  DEMO_POSE_TRAINING_ID,
  getPoseExerciseBySlug,
  getPoseExerciseByType,
  humanizePoseReport,
  listPoseTrainings,
  type PoseTrainingSession
} from '../../modules/pose'

export default function PoseTrainingHistoryPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const [items, setItems] = useState<PoseTrainingSession[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(
    () => ({ date_from: dateFrom || undefined, date_to: dateTo || undefined, exercise_type: exercise.exerciseType }),
    [dateFrom, dateTo, exercise.exerciseType]
  )
  const showDemo = items.length === 0
  const displayItems = showDemo ? [DEMO_POSE_TRAINING] : items

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listPoseTrainings({ page: 1, page_size: 50, ...query })
      .then((data) => {
        if (!active) return
        setItems(data.items)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load training history')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Training History</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span><Link to={buildPoseToolPath(exercise.slug)}>Live</Link></span>
                    <span>History</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-pose-select">
              <div className="cl_blog-widget mb-30">
                <div className="pose-history-head">
                  <h4 className="cl_blog-widget-title mb-0">Saved Training Records</h4>
                  <Link to={buildPoseToolPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
                    Back to Live
                  </Link>
                </div>

                <div className="pose-history-filters">
                  <label className="pose-form-field">
                    <span>From Date</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </label>
                  <label className="pose-form-field">
                    <span>To Date</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                  <button className="pose-tool-ghost-btn pose-tool-light-btn pose-filter-clear-btn" type="button" onClick={() => { setDateFrom(''); setDateTo('') }}>
                    Clear
                  </button>
                </div>

                <div className="pose-inline-note pose-inline-note-tight">
                  You can open a demo record any time to preview the report page UI.
                </div>

                {loading ? <p className="pose-muted-copy">Loading history...</p> : null}
                {error ? <div className="pose-error-box pose-error-box-light">{error}</div> : null}
                {!loading && !error && showDemo ? (
                  <p className="pose-muted-copy">No saved records in this date range. Showing demo entry below.</p>
                ) : null}

                {!loading && !error ? (
                  <div className="pose-history-list">
                    {displayItems.map((item) => {
                      const reps = item.sets.reduce((total, setItem) => total + (setItem.reps ?? 0), 0)
                      const displayReport =
                        item.report && isRecord(item.report) && (isRecord(item.report.keyMetrics) || Array.isArray(item.report.issues) || Array.isArray(item.report.suggestions))
                          ? (humanizePoseReport(item.report as never) as unknown as Record<string, unknown>)
                          : item.report
                      const reportSummary =
                        displayReport && isRecord(displayReport) && typeof displayReport.summary === 'string' && displayReport.summary.trim()
                          ? displayReport.summary
                          : 'No summary in report'
                      const sessionExerciseType = item.sets[0]?.exercise_type ?? 'squat'
                      const derivedName = buildTrainingRecordName({
                        startedAt: item.started_at,
                        exerciseName: getPoseExerciseByType(sessionExerciseType).displayName
                      })
                      const sessionName = item.id === DEMO_POSE_TRAINING_ID ? 'Demo Session' : (item.note?.trim() || derivedName)
                      return (
                        <Link key={item.id} className="pose-history-item" to={buildPoseReportPath(exercise.slug, item.id)}>
                          <div className="pose-history-item-top">
                            <strong>{sessionName}</strong>
                            <span>{formatDateTime(item.started_at)}</span>
                          </div>
                          <div className="pose-history-meta">
                            <span>Total Reps: {reps}</span>
                            <span>Sets: {item.sets.length}</span>
                            <span>Ended: {item.ended_at ? formatDateTime(item.ended_at) : 'In progress'}</span>
                          </div>
                          <p className="pose-history-summary">{reportSummary}</p>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
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

