import type { ReactNode } from 'react'
import type { PoseAnalysisReport } from '../../lib/pose/report'

export function MetricCard(props: { label: ReactNode; value: string | number; unit?: string }) {
  return (
    <div className="pose-metric-card pose-metric-card-light">
      <span className="pose-metric-label pose-metric-label-light">{props.label}</span>
      <strong className="pose-metric-value pose-metric-value-light">
        {props.value}
        {props.unit ?? ''}
      </strong>
    </div>
  )
}

export function LabelWithTip(props: { label: string; tip: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{props.label}</span>
      <span title={props.tip} style={{ cursor: 'help', color: '#64748b', fontSize: 12 }}>
        ⓘ
      </span>
    </span>
  )
}

export function MetricCardPlaceholder() {
  return (
    <div className="pose-metric-card pose-metric-card-light pose-metric-card-placeholder" aria-hidden="true">
      <span className="pose-metric-label pose-metric-label-light pose-placeholder-hidden">Placeholder</span>
      <strong className="pose-metric-value pose-metric-value-light pose-placeholder-hidden">0</strong>
    </div>
  )
}

export function ReportVisualization(props: { report: PoseAnalysisReport }) {
  const report = props.report as unknown as Record<string, unknown>
  const keyMetrics = asRecord(report.keyMetrics) ?? {}
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []

  return (
    <div className="pose-report-stack">
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{typeof report.summary === 'string' ? report.summary : 'No summary'}</div>
      </div>

      <div className="pose-report-metrics">
        {Object.entries(keyMetrics).map(([key, value]) => (
          <div key={key} className="pose-report-card">
            <div className="pose-report-label">{prettyMetricName(key)}</div>
            <div className="pose-report-value">{formatMetricValue(key, value)}</div>
          </div>
        ))}
      </div>

      {details ? <ScoreCard details={details} /> : null}
      {details ? <CoreCorrectionsCard details={details} /> : null}

      {timeline.length > 0 ? <TimelinePreview timeline={timeline} /> : null}

      <div className="pose-report-columns">
        <div className="pose-report-card">
          <div className="pose-report-title">Issues</div>
          {issues.length === 0 ? <div className="pose-muted-copy">No obvious issues detected</div> : null}
          <div className="pose-report-issue-list">
            {issues.map((issue, index) => (
              <div key={index} className="pose-report-issue">
                <strong>{String(issue.message ?? issue.code ?? 'Issue')}</strong>
                <span>
                  {String(issue.severity ?? '-')}
                  {typeof issue.atFrame === 'number' ? ` · frame ${issue.atFrame}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pose-report-card">
          <div className="pose-report-title">Suggestions</div>
          {suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions</div> : null}
          <ol className="pose-report-suggestions">
            {suggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function ScoreCard(props: { details: Record<string, unknown> }) {
  const score = asRecord(props.details.score)
  if (!score) return null
  const value = typeof score.value === 'number' && Number.isFinite(score.value) ? score.value : null
  const reason = typeof score.reason === 'string' ? score.reason : null
  const breakdown = Array.isArray(score.breakdown) ? score.breakdown.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []

  return (
    <div className="pose-report-card">
      <div className="pose-report-title">Form Score</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 22 }}>{value === null ? 'N/A' : value}</strong>
        {value === null && reason ? <span className="pose-muted-copy">{reason}</span> : null}
      </div>
      {breakdown.length > 0 ? (
        <div className="pose-report-issue-list" style={{ marginTop: 10 }}>
          {breakdown.map((item, idx) => (
            <div key={idx} className="pose-report-issue">
              <strong>{String(item.label ?? item.type ?? 'Item')}</strong>
              <span>{typeof item.penalty === 'number' ? `penalty ${item.penalty}` : ''}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CoreCorrectionsCard(props: { details: Record<string, unknown> }) {
  const items = Array.isArray(props.details.coreCorrections)
    ? props.details.coreCorrections.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : []
  if (items.length === 0) return null

  function formatEvidence(evidence: unknown) {
    const rec = asRecord(evidence)
    if (!rec) return ''
    const parts = Object.entries(rec)
      .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .slice(0, 6)
      .map(([k, v]) => `${k}: ${String(v)}`)
    return parts.join(' · ')
  }

  return (
    <div className="pose-report-card">
      <div className="pose-report-title">Core Corrections</div>
      <div className="pose-report-issue-list">
        {items.map((item, idx) => (
          <div key={idx} className="pose-report-issue">
            <strong>{String(item.title ?? item.type ?? 'Correction')}</strong>
            <span>{String(item.level ?? '-')}</span>
            {formatEvidence(item.evidence) ? <span>{formatEvidence(item.evidence)}</span> : null}
            {typeof item.suggestion === 'string' && item.suggestion.trim() ? <span>{item.suggestion}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelinePreview(props: { timeline: unknown[] }) {
  const rows = props.timeline.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
  const candidates = ['kneeAngleDeg', 'hipAngleDeg', 'torsoFromVerticalDeg', 'kneeFlexDeg', 'centerY']
  const series = candidates
    .map((key) => ({
      key,
      values: rows.map((row) => row[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    }))
    .filter((item) => item.values.length >= 3)
    .slice(0, 3)

  if (series.length === 0) return null

  return (
    <div className="pose-report-card">
      <div className="pose-report-title">Key Timeline</div>
      <div className="pose-report-line-stack">
        {series.map((item) => (
          <div key={item.key}>
            <div className="pose-report-label">{prettyMetricName(item.key)}</div>
            <MiniLine values={item.values} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniLine(props: { values: number[] }) {
  const width = 600
  const height = 110
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const range = Math.max(1e-6, max - min)
  const points = props.values
    .map((v, i) => {
      const x = (i / Math.max(1, props.values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pose-mini-line">
      <polyline points={points} fill="none" stroke="#0f766e" strokeWidth="2" />
    </svg>
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    reps: 'Reps',
    repEstimate: 'Estimated Reps',
    fps: 'FPS',
    standardId: 'Standard ID',
    standardName: 'Standard Name',
    extractedFrames: 'Extracted Frames',
    comparableFrames: 'Comparable Frames',
    avgScore: 'Average Score',
    minScore: 'Min Score',
    maxScore: 'Max Score',
    badFramePct: 'Bad Frame %',
    coverage: 'Visibility',
    stabilityScore: 'Stability',
    mobilityScore: 'Mobility',
    rhythmScore: 'Rhythm',
    symmetryScore: 'Symmetry',
    avgRepDurationSec: 'Avg Rep Duration',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    formScore: 'Form Score',
    scoreEligibility: 'Score Eligibility',
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle',
    kneeFlexDeg: 'Knee Flexion',
    centerY: 'Center Height'
  }
  return map[key] ?? key
}

function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set(['coverage', 'badFramePct'])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
