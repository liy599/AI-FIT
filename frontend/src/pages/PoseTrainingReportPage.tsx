import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPoseExerciseByType } from '../lib/pose/exercises'
import { getPoseTraining, type PoseTrainingSession } from '../lib/poseApi'
import { buildTrainingRecordName } from '../lib/pose/trainingName'
import { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from '../lib/poseTrainingMock'

export default function PoseTrainingReportPage() {
  const params = useParams<{ sessionId: string }>()
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
                    <Link to="/tools/pose/squat/tool/history">History</Link>
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
                  <Link to="/tools/pose/squat/tool/history" className="pose-tool-ghost-btn pose-tool-light-btn">
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
  const details = asRecord(report.details) ?? {}
  const issues = Array.isArray(report.issues) ? report.issues : []
  const suggestions = Array.isArray(report.suggestions) ? report.suggestions.filter((x): x is string => typeof x === 'string') : []

  const score = asRecord(details.score)
  const coreCorrections = Array.isArray(details.coreCorrections)
    ? details.coreCorrections.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : []
  const disclaimerLines = buildDisclaimerLines({ keyMetrics, score })

  return (
    <div className="pose-report-stack" style={{ marginTop: 12 }}>
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{typeof report.summary === 'string' && report.summary.trim() ? report.summary : 'No summary'}</div>
      </div>

      <div className="pose-report-metrics">
        {Object.entries(keyMetrics).map(([key, value]) => (
          <div key={key} className="pose-report-card">
            <div className="pose-report-label">{prettyMetricName(key)}</div>
            <div className="pose-report-value pose-report-value-small">{formatMetricValue(key, value)}</div>
          </div>
        ))}
      </div>

      {score ? (
        <div className="pose-report-card">
          <div className="pose-report-title">Form Score</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 22 }}>
              {typeof score.value === 'number' && Number.isFinite(score.value) ? score.value : 'N/A'}
            </strong>
            {!(typeof score.value === 'number' && Number.isFinite(score.value)) && typeof score.reason === 'string' ? (
              <span className="pose-muted-copy">{score.reason}</span>
            ) : null}
          </div>
          {Array.isArray(score.breakdown) ? (
            <div className="pose-report-issue-list" style={{ marginTop: 10 }}>
              {score.breakdown
                .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
                .map((item, idx) => (
                  <div key={idx} className="pose-report-issue">
                    <strong>{String(item.label ?? item.type ?? 'Item')}</strong>
                    <span>{typeof item.penalty === 'number' ? `penalty ${item.penalty}` : ''}</span>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {coreCorrections.length > 0 ? (
        <div className="pose-report-card">
          <div className="pose-report-title">Core Corrections</div>
          <div className="pose-report-issue-list">
            {coreCorrections.map((item, idx) => (
              <div key={idx} className="pose-report-issue">
                <strong>{String(item.title ?? item.type ?? 'Correction')}</strong>
                <span>{String(item.level ?? '-')}</span>
                {formatEvidence(item.evidence) ? <span>{formatEvidence(item.evidence)}</span> : null}
                {typeof item.suggestion === 'string' && item.suggestion.trim() ? <span>{item.suggestion}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

      <div className="pose-report-card">
        <div className="pose-report-title">Disclaimer</div>
        <ul className="pose-detail-list pose-detail-list-light">
          {disclaimerLines.map((line, idx) => (
            <li key={`${idx}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    totalReps: 'Total Reps',
    correctReps: 'Correct Reps',
    incorrectReps: 'Incorrect Reps',
    unassessedReps: 'Unassessed Reps',
    formAccuracyPct: 'Form Accuracy %',
    avgRepDurationSec: 'Avg Rep Duration',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    avgTrackingQuality: 'Avg Tracking Quality',
    effectiveFps: 'Effective FPS',
    gatedFrames: 'Gated Frames',
    gatedFramePct: 'Gated Frame %',
    topGateCode: 'Top Gate',
    formScore: 'Form Score',
    scoreEligibility: 'Score Eligibility'
  }
  return map[key] ?? key
}

function formatEvidence(evidence: unknown) {
  const rec = asRecord(evidence)
  if (!rec) return ''
  const parts = Object.entries(rec)
    .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${String(v)}`)
  return parts.join(' · ')
}

function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set([
    'coverage',
    'badFramePct',
    'accuracy',
    'accuracyPct',
    'formAccuracyPct',
    'score',
    'gatedFramePct'
  ])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function buildDisclaimerLines(input: { keyMetrics: Record<string, unknown>; score: Record<string, unknown> | null }) {
  const lines: string[] = []
  lines.push('This feedback is for training guidance only and may be inaccurate under poor camera conditions.')

  const gatedFramePct = typeof input.keyMetrics.gatedFramePct === 'number' ? input.keyMetrics.gatedFramePct : null
  if (gatedFramePct !== null && gatedFramePct >= 0.2) {
    lines.push(`A significant portion of frames were gated (${Math.round(gatedFramePct * 100)}%), so rep quality checks may be incomplete.`)
  }

  const avgTrackingQuality = typeof input.keyMetrics.avgTrackingQuality === 'number' ? input.keyMetrics.avgTrackingQuality : null
  if (avgTrackingQuality !== null && avgTrackingQuality < 0.5) {
    lines.push('Average tracking quality was low; improve lighting and keep your full body in frame for better results.')
  }

  const unassessedReps = typeof input.keyMetrics.unassessedReps === 'number' ? input.keyMetrics.unassessedReps : null
  if (unassessedReps !== null && unassessedReps > 0) {
    lines.push(`Some reps were counted but not assessed (${unassessedReps}); review camera setup and stability.`)
  }

  if (input.score && (typeof input.score.value !== 'number' || !Number.isFinite(input.score.value))) {
    const reason = typeof input.score.reason === 'string' && input.score.reason.trim() ? input.score.reason.trim() : null
    if (reason) lines.push(`Form score is unavailable (${reason}).`)
  }

  return lines
}
