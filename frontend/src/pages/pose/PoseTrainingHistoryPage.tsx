import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatLocalDateTimeMinute } from '../../lib/datetime'
import { buildPaginationItems } from '../../lib/pagination'
import {
  buildPoseGuidePath,
  buildPoseVideoPath,
  buildPoseReportPath,
  buildTrainingRecordName,
  deletePoseTraining,
  getPoseExercises,
  getPoseExerciseBySlug,
  getPoseExerciseByType,
  humanizePoseReport,
  isPoseExerciseSlug,
  listPoseTrainings,
  type PoseTrainingSession
} from '../../modules/pose'

const PAGE_SIZE = 5

export default function PoseTrainingHistoryPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const exerciseOptions = useMemo(() => getPoseExercises(), [])
  const exerciseParam = searchParams.get('exercise')
  const selectedSlug = isPoseExerciseSlug(exerciseParam)
    ? exerciseParam
    : isPoseExerciseSlug(params.exerciseSlug)
      ? params.exerciseSlug
      : 'all'
  const selectedExercise = selectedSlug === 'all' ? null : getPoseExerciseBySlug(selectedSlug)
  const [items, setItems] = useState<PoseTrainingSession[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const query = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      exercise_type: selectedExercise?.exerciseType
    }),
    [dateFrom, dateTo, selectedExercise?.exerciseType]
  )
  const hasRecords = items.length > 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, total)
  const paginationItems = useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages])

  function updateExerciseFilter(next: string) {
    const nextParams = new URLSearchParams(searchParams)
    if (isPoseExerciseSlug(next)) nextParams.set('exercise', next)
    else nextParams.delete('exercise')
    setPage(1)
    setSearchParams(nextParams)
  }

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setPage(1)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('exercise')
    setSearchParams(nextParams)
  }

  function updateDateFrom(next: string) {
    setDateFrom(next)
    if (next && dateTo && dateTo < next) setDateTo(next)
    setPage(1)
  }

  function updateDateTo(next: string) {
    if (dateFrom && next && next < dateFrom) {
      setDateTo(dateFrom)
      setPage(1)
      return
    }
    setDateTo(next)
    setPage(1)
  }

  async function deleteTrainingRecord(item: PoseTrainingSession) {
    const sessionExerciseType = item.sets[0]?.exercise_type ?? 'squat'
    const derivedName = buildTrainingRecordName({
      startedAt: item.started_at,
      exerciseName: getPoseExerciseByType(sessionExerciseType).displayName
    })
    const sessionName = item.note?.trim() || derivedName
    const confirmed = window.confirm(`Delete training report "${sessionName}"? This cannot be undone.`)
    if (!confirmed) return

    setDeletingId(item.id)
    setError(null)
    setNotice(null)
    try {
      await deletePoseTraining(item.id)
      if (items.length === 1 && page > 1) setPage((prev) => Math.max(1, prev - 1))
      else setItems((prev) => prev.filter((candidate) => candidate.id !== item.id))
      setTotal((prev) => Math.max(0, prev - 1))
      setNotice('Training report deleted.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  function writePostFromReport(args: {
    item: PoseTrainingSession
    report: Record<string, unknown>
    exerciseName: string
    sessionSlug: ReturnType<typeof getPoseExerciseByType>['slug']
    reps: number
  }) {
    navigate('/blogs/new', {
      state: {
        template: 'training',
        reportDraft: buildReportBlogDraft({
          report: args.report,
          exerciseName: args.exerciseName,
          startedAt: args.item.started_at,
          endedAt: args.item.ended_at,
          reps: args.reps
        }),
        reportPath: buildPoseReportPath(args.sessionSlug, args.item.id)
      }
    })
  }

  useEffect(() => {
    const state = location.state as { notice?: unknown } | null
    if (typeof state?.notice !== 'string' || !state.notice.trim()) return
    setNotice(state.notice)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listPoseTrainings({ page, page_size: PAGE_SIZE, ...query })
      .then((data) => {
        if (!active) return
        setItems(data.items)
        setTotal(data.total)
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
  }, [page, query])

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Training History</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    {selectedExercise ? <span><Link to={buildPoseGuidePath(selectedExercise.slug)}>{selectedExercise.displayName}</Link></span> : null}
                    <span>History</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-pose-select">
              <div className="cl_blog-widget mb-30">
                <div className="pose-history-head">
                  <h4 className="cl_blog-widget-title mb-0">
                    {selectedExercise ? `${selectedExercise.displayName} Records` : 'All Training Records'}
                  </h4>
                  {selectedExercise ? (
                    <Link to={buildPoseVideoPath(selectedExercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
                      Back to Video Analysis
                    </Link>
                  ) : (
                    <Link to="/tools/pose" className="pose-tool-ghost-btn pose-tool-light-btn">
                      Select Exercise
                    </Link>
                  )}
                </div>

                <div className="pose-history-filters">
                  <label className="pose-form-field">
                    <span>Exercise</span>
                    <select value={selectedSlug} onChange={(e) => updateExerciseFilter(e.target.value)}>
                      <option value="all">All Exercises</option>
                      {exerciseOptions.map((exercise) => (
                        <option key={exercise.slug} value={exercise.slug}>
                          {exercise.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="pose-form-field">
                    <span>From Date</span>
                    <div className="pose-date-input-wrap">
                      <input
                        type="date"
                        value={dateFrom}
                        max={dateTo || undefined}
                        onChange={(e) => updateDateFrom(e.target.value)}
                      />
                      <span className={dateFrom ? 'pose-date-input-preview' : 'pose-date-input-preview pose-date-input-placeholder'}>
                        {formatDateInputPreview(dateFrom)}
                      </span>
                    </div>
                  </label>
                  <label className="pose-form-field">
                    <span>To Date</span>
                    <div className="pose-date-input-wrap">
                      <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(e) => updateDateTo(e.target.value)}
                      />
                      <span className={dateTo ? 'pose-date-input-preview' : 'pose-date-input-preview pose-date-input-placeholder'}>
                        {formatDateInputPreview(dateTo)}
                      </span>
                    </div>
                  </label>
                  <button className="pose-tool-ghost-btn pose-tool-light-btn pose-filter-clear-btn" type="button" onClick={clearFilters}>
                    Clear
                  </button>
                </div>

                {loading ? <p className="pose-muted-copy">Loading history...</p> : null}
                {notice ? <div className="pose-success-box">{notice}</div> : null}
                {error ? <div className="pose-error-box pose-error-box-light">{error}</div> : null}
                {!loading && !error ? (
                  <div className="pose-history-count">
                    {total > 0 ? `Showing ${pageStart}-${pageEnd} of ${total} records` : 'No records to show'}
                  </div>
                ) : null}
                {!loading && !error && !hasRecords ? (
                  <div className="pose-history-empty">
                    <strong>No training records found</strong>
                    <p>
                      {selectedExercise
                        ? `No ${selectedExercise.displayName} records match the current filters. Try clearing filters or save a new analysis result first.`
                        : 'No saved training records match the current filters. Try clearing filters or complete a video analysis first.'}
                    </p>
                  </div>
                ) : null}

                {!loading && !error && hasRecords ? (
                  <div className="pose-history-list">
                    {items.map((item) => {
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
                      const sessionSlug = getPoseExerciseByType(sessionExerciseType).slug
                      const derivedName = buildTrainingRecordName({
                        startedAt: item.started_at,
                        exerciseName: getPoseExerciseByType(sessionExerciseType).displayName
                      })
                      const sessionName = item.note?.trim() || derivedName
                      return (
                        <div key={item.id} className="pose-history-item pose-history-item-static">
                          <div className="pose-history-item-top">
                            <strong>{sessionName}</strong>
                            <span>{formatLocalDateTimeMinute(item.started_at)}</span>
                          </div>
                          <div className="pose-history-meta">
                            <span>Total Reps: {reps}</span>
                            <span>Ended: {item.ended_at ? formatLocalDateTimeMinute(item.ended_at) : 'In progress'}</span>
                          </div>
                          <p className="pose-history-summary">{reportSummary}</p>
                          <div className="pose-history-actions">
                            <Link to={buildPoseReportPath(sessionSlug, item.id)} className="pose-tool-ghost-btn pose-tool-light-btn">
                              View Report
                            </Link>
                            {displayReport && isRecord(displayReport) ? (
                              <button
                                className="pose-tool-ghost-btn pose-tool-light-btn"
                                type="button"
                                onClick={() => writePostFromReport({
                                  item,
                                  report: displayReport,
                                  exerciseName: getPoseExerciseByType(sessionExerciseType).displayName,
                                  sessionSlug,
                                  reps
                                })}
                              >
                                Write Post
                              </button>
                            ) : null}
                            <button
                              className="pose-tool-ghost-btn pose-tool-light-btn pose-tool-danger-btn"
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => deleteTrainingRecord(item).catch(() => {})}
                            >
                              {deletingId === item.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {!loading && !error && totalPages > 1 ? (
                  <div className="pose-history-pagination">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      First
                    </button>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </button>
                    <div className="pose-history-page-numbers" aria-label="Training history pages">
                      {paginationItems.map((item, index) =>
                        item === 'ellipsis' ? (
                          <span key={`ellipsis-${index}`} className="pose-history-page-ellipsis">...</span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            className={item === page ? 'is-active' : ''}
                            aria-current={item === page ? 'page' : undefined}
                            onClick={() => setPage(item)}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      Last
                    </button>
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

function formatDateInputPreview(value: string) {
  return value || 'Select date'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function buildReportBlogDraft(input: {
  report: Record<string, unknown>
  exerciseName: string
  startedAt: string
  endedAt: string | null
  reps: number
}) {
  const keyMetrics = isRecord(input.report.keyMetrics) ? input.report.keyMetrics : {}
  const accuracy = pickPercent(keyMetrics.formAccuracyPct ?? input.report.formAccuracyPct ?? input.report.accuracyPct)
  const summary = typeof input.report.summary === 'string' ? input.report.summary.trim() : ''
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
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    reps: input.reps,
    accuracy,
    summary,
    issues,
    suggestions
  }
}

function pickPercent(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.round(value)}%`
}


