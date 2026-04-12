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
  const displayMetrics = buildDisplayMetricCards(keyMetrics, { hideTotalReps: true })
  const issues = Array.isArray(report.issues) ? report.issues : []
  const suggestions = Array.isArray(report.suggestions) ? report.suggestions.filter((x): x is string => typeof x === 'string') : []
  const exercise = asRecord(report.exercise)
  const details = asRecord(report.details)
  const repFindings = details && Array.isArray(details.repFindings) ? (details.repFindings as Array<Record<string, unknown>>) : []
  const repFindingsFlagged = repFindings.filter((item) => String(item.result ?? 'invalid') !== 'correct')
  const isSquat = String(exercise?.id ?? '').toLowerCase() === 'squat'

  return (
    <div className="pose-report-stack" style={{ marginTop: 12 }}>
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        {renderSummaryBlock(typeof report.summary === 'string' ? report.summary : '', keyMetrics)}
        <div className="pose-report-abbrev">
          <span className="pose-report-abbrev-title">Abbreviations:</span>
          <span className="pose-abbrev-pill">Rep = repetition count</span>
          <span className="pose-abbrev-pill">Form = movement quality (posture + technique)</span>
          <span className="pose-abbrev-pill">Tempo = movement speed and rhythm</span>
        </div>
      </div>

      <div className="pose-report-metrics">
        {displayMetrics.map((item, index) => {
          const prevGroup = index > 0 ? displayMetrics[index - 1]?.group : null
          const showGroup = item.group && item.group !== prevGroup
          return (
            <div key={item.key} className="pose-report-metric-fragment">
              {showGroup ? <div className="pose-report-metric-group-title">{item.group}</div> : null}
              <div className="pose-report-card">
                <div className="pose-report-label">{item.label}</div>
                <div className="pose-report-value">{item.value}</div>
              </div>
            </div>
          )
        })}
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

      {repFindingsFlagged.length > 0 ? (
        <div className="pose-report-card">
          <div className="pose-report-title">Rep Findings</div>
          <div className="pose-report-issue-list">
            {repFindingsFlagged.map((item, index) => {
              const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
              const result = String(item.result ?? 'invalid')
              const primaryIssue = String(item.primaryIssue ?? 'No detail')
              const reasons = Array.isArray(item.reasons) ? item.reasons.filter((x): x is string => typeof x === 'string') : []
              return (
                <div key={`${repNo}-${index}`} className="pose-report-issue">
                  <strong>{`Rep ${repNo} - ${result}`}</strong>
                  <span>{primaryIssue}</span>
                  {reasons.length > 1 ? <span>{`Details: ${reasons.join(' | ')}`}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="pose-report-card">
        <div className="pose-report-title">Assessment Criteria</div>
        {isSquat ? (
          <ul className="pose-criteria-list">
            <li>
              <span className="pose-criteria-label">Rep counting</span>
              <span className="pose-criteria-text">A full squat cycle is counted only after completing the bottom phase and returning to standing.</span>
            </li>
            <li>
              <span className="pose-criteria-label">Form pass/fail</span>
              <span className="pose-criteria-text">Assessed reps are marked by knee-forward and torso-lean thresholds with multi-frame stability checks.</span>
            </li>
            <li>
              <span className="pose-criteria-label">Assessment validity</span>
              <span className="pose-criteria-text">Reps with unstable keypoints or non-ideal side-view may be excluded from valid scoring.</span>
            </li>
            <li>
              <span className="pose-criteria-label">Tempo check</span>
              <span className="pose-criteria-text">Fast/Slow is based on rep duration and phase-speed rules, then filtered to reduce false positives.</span>
            </li>
          </ul>
        ) : (
          <ul className="pose-criteria-list">
            <li>
              <span className="pose-criteria-label">Rep counting</span>
              <span className="pose-criteria-text">Rep counting and quality checks are based on pose keypoint trajectories across full movement cycles.</span>
            </li>
            <li>
              <span className="pose-criteria-label">Form decision</span>
              <span className="pose-criteria-text">Form results are produced from rule-based thresholds with anti-jitter frame consistency checks.</span>
            </li>
            <li>
              <span className="pose-criteria-label">Confidence impact</span>
              <span className="pose-criteria-text">Low-confidence frames can affect validity scoring and may reduce assessable rep coverage.</span>
            </li>
          </ul>
        )}
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
  if (key.endsWith('Pct')) return `${Math.round(v)}%`
  if (key === 'avgRepDurationSec') return `${v.toFixed(2)}s`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    totalReps: 'Total Reps',
    effectiveReps: 'Effective',
    unassessedReps: 'Invalid',
    correctReps: 'Correct Reps',
    incorrectReps: 'Incorrect Reps',
    formAccuracyPct: 'Form Accuracy Rate',
    assessedRepPct: 'Assessed Rep Rate',
    sideViewInvalidReps: 'Invalid Reps (Side View)',
    effectiveFps: 'Analysis Frame Rate (FPS)',
    avgRepDurationSec: 'Average Rep Duration (s)',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle'
  }
  return map[key] ?? humanizeMetricKey(key)
}

function humanizeMetricKey(key: string) {
  if (!key) return '-'
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildDisplayMetricCards(keyMetrics: Record<string, unknown>, options?: { hideTotalReps?: boolean }) {
  const priority = [
    'totalReps',
    'effectiveReps',
    'unassessedReps',
    'correctReps',
    'incorrectReps',
    'formAccuracyPct',
    'assessedRepPct',
    'fastRepCount',
    'slowRepCount',
    'avgRepDurationSec',
    'effectiveFps'
  ]
  const cards: Array<{ key: string; label: string; value: string; group?: string }> = []
  const hiddenKeys = new Set(['sideViewInvalidReps'])

  for (const key of priority) {
    if (hiddenKeys.has(key)) continue
    if (options?.hideTotalReps && key === 'totalReps') continue
    if (!(key in keyMetrics)) continue
    cards.push({
      key,
      label: prettyMetricName(key),
      value: formatMetricValue(key, keyMetrics[key]),
      group: metricGroup(key)
    })
  }

  for (const [key, value] of Object.entries(keyMetrics)) {
    if (hiddenKeys.has(key)) continue
    if (priority.includes(key)) continue
    if (options?.hideTotalReps && key === 'totalReps') continue
    cards.push({
      key,
      label: prettyMetricName(key),
      value: formatMetricValue(key, value),
      group: metricGroup(key)
    })
  }

  return cards
}

function toFiniteNumber(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function renderSummaryBlock(summary: string, keyMetrics: Record<string, unknown>) {
  const summaryTitle = extractSummaryTitle(summary)
  const total = toFiniteNumber(keyMetrics.totalReps)
  const effective = toFiniteNumber(keyMetrics.effectiveReps)
  const unassessed = toFiniteNumber(keyMetrics.unassessedReps)
  const correct = toFiniteNumber(keyMetrics.correctReps)
  const incorrect = toFiniteNumber(keyMetrics.incorrectReps)
  const accuracy = toFiniteNumber(keyMetrics.formAccuracyPct)
  const avgRep = toFiniteNumber(keyMetrics.avgRepDurationSec)
  const chips: string[] = []
  if (total !== null) chips.push(`Total ${total}`)
  if (effective !== null) chips.push(`Effective ${effective}`)
  if (unassessed !== null) chips.push(`Invalid ${unassessed}`)
  if (correct !== null) chips.push(`Correct ${correct}`)
  if (incorrect !== null) chips.push(`Incorrect ${incorrect}`)
  if (accuracy !== null) chips.push(`Accuracy ${Math.round(accuracy)}%`)
  if (avgRep !== null) chips.push(`Avg Rep ${avgRep.toFixed(2)}s`)

  return chips.length > 0 ? (
    <div className="pose-report-abbrev">
      <span className="pose-report-abbrev-title">{summaryTitle}</span>
      {chips.map((chip) => (
        <span key={chip} className="pose-summary-chip">
          {chip}
        </span>
      ))}
    </div>
  ) : (
    <div className="pose-report-abbrev">
      <span className="pose-report-abbrev-title">{summaryTitle}</span>
    </div>
  )
}

function extractSummaryTitle(summary: string) {
  const text = summary.trim()
  if (!text) return 'Summary:'
  const index = text.indexOf(':')
  if (index <= 0) return text
  return `${text.slice(0, index).trim()}:`
}

function metricGroup(key: string) {
  if (key === 'totalReps' || key === 'effectiveReps' || key === 'unassessedReps') return 'Reps'
  if (key === 'correctReps' || key === 'incorrectReps' || key === 'formAccuracyPct' || key === 'assessedRepPct') return 'Form'
  if (key === 'fastRepCount' || key === 'slowRepCount' || key === 'avgRepDurationSec' || key === 'effectiveFps') return 'Tempo'
  return 'Other'
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}
