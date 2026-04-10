import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createPoseAiEnhancedReportRaw,
  getPoseTraining,
  parsePoseAiEnhancedReportResponse,
  type AiEnhancedReportV1,
  type PoseAiEnhancedReportMeta,
  type PoseTrainingSession
} from '../lib/poseApi'
import { DEMO_POSE_TRAINING, DEMO_POSE_TRAINING_ID } from '../lib/poseTrainingMock'

export default function PoseTrainingReportPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = Number(params.sessionId)
  const [session, setSession] = useState<PoseTrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiReport, setAiReport] = useState<AiEnhancedReportV1 | null>(null)
  const [aiMeta, setAiMeta] = useState<PoseAiEnhancedReportMeta | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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

  useEffect(() => {
    setAiReport(null)
    setAiMeta(null)
    setAiLoading(false)
    setAiError(null)
  }, [sessionId])

  const totalReps = useMemo(() => session?.sets.reduce((total, item) => total + (item.reps ?? 0), 0) ?? 0, [session])

  useEffect(() => {
    const baseReport = session?.report
    if (!baseReport) return
    let active = true
    setAiLoading(true)
    setAiError(null)
    ;(async () => {
      const raw = await createPoseAiEnhancedReportRaw({ report: baseReport, language: 'en-US' })
      if (!active) return
      const parsed = parsePoseAiEnhancedReportResponse(raw)
      if (!parsed) {
        setAiReport(null)
        setAiMeta(null)
        setAiError('AI report is temporarily unavailable.')
        return
      }
      setAiReport(parsed.report)
      setAiMeta(parsed.meta)
      setAiError(null)
    })()
      .catch((e: unknown) => {
        if (!active) return
        setAiError(e instanceof Error ? e.message : 'Failed to load AI report')
      })
      .finally(() => {
        if (!active) return
        setAiLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.report, sessionId])

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
                  <h4 className="cl_blog-widget-title mb-0">Session Report {session ? `#${session.id}` : ''}</h4>
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

                    <div className="pose-report-card" style={{ marginTop: 12 }}>
                      <div className="pose-report-title" style={{ marginBottom: 0 }}>
                        AI Enhanced Report
                      </div>
                      {aiLoading ? <p className="pose-muted-copy" style={{ marginTop: 10 }}>Generating AI report...</p> : null}
                      {aiError ? <div className="pose-error-box pose-error-box-light">{aiError}</div> : null}
                      {aiReport ? <AiEnhancedReportV1Panel report={aiReport} meta={aiMeta} session={session} /> : null}
                    </div>
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

function AiEnhancedReportV1Panel(props: { report: AiEnhancedReportV1; meta: PoseAiEnhancedReportMeta | null; session: PoseTrainingSession }) {
  const report = props.report
  const meta = props.meta
  const session = props.session
  const workoutTime = formatSessionDuration(session.started_at, session.ended_at)
  const exerciseSummary = useMemo(() => {
    const acc = new Map<string, number>()
    for (const item of session.sets) {
      const key = (item.exercise_type || 'exercise').trim() || 'exercise'
      const prev = acc.get(key) ?? 0
      acc.set(key, prev + (item.reps ?? 0))
    }
    return Array.from(acc.entries()).map(([name, reps]) => `${name} × ${reps} reps`)
  }, [session.sets])
  const scoreText = typeof report.score === 'number' && Number.isFinite(report.score) ? `${Math.max(0, Math.min(100, Math.round(report.score)))}/100` : '—/100'

  return (
    <div className="pose-report-stack" style={{ marginTop: 12 }}>
      <div className="pose-report-metrics pose-report-metrics-3">
        <div className="pose-report-card">
          <div className="pose-report-label">AI Score</div>
          <div className="pose-report-value">{scoreText}</div>
        </div>
        <div className="pose-report-card">
          <div className="pose-report-label">Workout Time</div>
          <div className="pose-report-value pose-report-value-small">{workoutTime}</div>
        </div>
        <div className="pose-report-card">
          <div className="pose-report-label">Exercise & Reps</div>
          {exerciseSummary.length > 0 ? (
            <div className="pose-report-value pose-report-value-small">{exerciseSummary.join(' · ')}</div>
          ) : (
            <div className="pose-report-value pose-report-value-small">No set records</div>
          )}
        </div>
      </div>

      <div className="pose-report-card">
        <div className="pose-report-title">Issues</div>
        {report.issues.length === 0 ? <div className="pose-muted-copy">No notable issues found.</div> : null}
        {report.issues.length > 0 ? (
          <div className="pose-report-issue-list">
            {report.issues.map((item, idx) => (
              <div key={`${idx}-${item.title}`} className="pose-report-issue">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{item.title}</strong>
                  <span className={severityTagClass(item.severity)}>{item.severity.toUpperCase()}</span>
                </div>
                {item.evidence ? <div style={{ color: '#334155' }}>Evidence: {item.evidence}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pose-report-card">
        <div className="pose-report-title">Suggestions</div>
        {report.suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions available.</div> : null}
        {report.suggestions.length > 0 ? (
          <ol className="pose-report-suggestions">
            {report.suggestions.map((item, idx) => (
              <li key={`${idx}-${item}`}>{item}</li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{report.summary || 'No summary available.'}</div>
      </div>

      <div className="pose-report-card">
        <div className="pose-report-title">Disclaimer</div>
        <div style={{ color: '#334155' }}>{report.disclaimer || 'This report is for fitness guidance only and is not medical advice.'}</div>
      </div>

      {meta ? (
        <div className="pose-report-card">
          <div className="pose-report-title">Report Source</div>
          <div className="pose-muted-copy">
            {report.source.provider}
            {report.source.model ? ` (${report.source.model})` : ''}
            {meta.degraded ? ' · fallback mode' : ''}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function severityTagClass(severity: 'info' | 'warning' | 'error') {
  if (severity === 'error') return 'pose-status-tag pose-status-tag-light'
  if (severity === 'warning') return 'pose-status-tag'
  return 'pose-muted-copy'
}

function formatSessionDuration(startedAt: string, endedAt: string | null) {
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return endedAt ? `${startedAt} - ${endedAt}` : startedAt
  if (!endedAt) return 'In progress'
  const end = new Date(endedAt)
  if (Number.isNaN(end.getTime())) return `${formatDateTime(startedAt)} - ${endedAt}`
  const ms = Math.max(0, end.getTime() - start.getTime())
  const totalMin = Math.round(ms / 60000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}
