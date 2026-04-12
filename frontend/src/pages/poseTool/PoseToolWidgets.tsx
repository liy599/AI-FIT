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
        ?
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
  const displayMetrics = buildDisplayMetricCards(keyMetrics)
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []
  const repFindings = details && Array.isArray(details.repFindings) ? (details.repFindings as Array<Record<string, unknown>>) : []
  const repFindingsFlagged = repFindings.filter((item) => String(item.result ?? 'invalid') !== 'correct')
  const exercise = asRecord(report.exercise)
  const isSquat = String(exercise?.id ?? '').toLowerCase() === 'squat'

  return (
    <div className="pose-report-stack">
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
                <div className="pose-report-label" title={item.tip ?? metricTip(item.key)}>
                  {item.label}
                </div>
                <div className="pose-report-value">{item.value}</div>
              </div>
            </div>
          )
        })}
      </div>

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
                  {typeof issue.atFrame === 'number' ? ` | frame ${issue.atFrame}` : ''}
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
    totalReps: 'Total Reps',
    effectiveReps: 'Effective',
    unassessedReps: 'Invalid',
    correctReps: 'Correct Reps',
    incorrectReps: 'Incorrect Reps',
    formAccuracyPct: 'Form Accuracy Rate',
    assessedRepPct: 'Assessed Rep Rate',
    sideViewInvalidReps: 'Invalid Reps (Side View)',
    effectiveFps: 'Analysis Frame Rate (FPS)',
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
    avgRepDurationSec: 'Average Rep Duration (s)',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle',
    kneeFlexDeg: 'Knee Flexion',
    centerY: 'Center Height'
  }
  return map[key] ?? humanizeMetricKey(key)
}

function metricTip(key: string) {
  const map: Record<string, string> = {
    totalReps: 'All completed reps, including reps not used for valid scoring.',
    effectiveReps: 'Reps fully assessed as either correct or incorrect.',
    unassessedReps: 'Completed reps excluded from validity scoring (invalid reps).',
    correctReps: 'Assessed reps judged as correct form.',
    incorrectReps: 'Assessed reps judged as incorrect form.',
    formAccuracyPct: 'Correct / (Correct + Incorrect), excludes unassessed reps.',
    assessedRepPct: 'Effective Reps / Total Reps.',
    sideViewInvalidReps: 'Reps excluded because side-view alignment was unstable.',
    effectiveFps: 'Observed processing frame rate during analysis.',
    avgRepDurationSec: 'Average duration per completed rep.',
    fastRepCount: 'Reps flagged as too fast by tempo thresholds.',
    slowRepCount: 'Reps flagged as too slow by tempo thresholds.'
  }
  return map[key] ?? humanizeMetricKey(key)
}

function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set(['coverage', 'badFramePct'])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  if (key.endsWith('Pct')) return `${Math.round(v)}%`
  if (key === 'avgRepDurationSec') return `${v.toFixed(2)}s`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
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

function buildDisplayMetricCards(keyMetrics: Record<string, unknown>) {
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
  const cards: Array<{ key: string; label: string; value: string; tip?: string; group?: string }> = []
  const hiddenKeys = new Set(['sideViewInvalidReps'])

  for (const key of priority) {
    if (hiddenKeys.has(key)) continue
    if (!(key in keyMetrics)) continue
    cards.push({
      key,
      label: prettyMetricName(key),
      value: formatMetricValue(key, keyMetrics[key]),
      tip: metricTip(key),
      group: metricGroup(key)
    })
  }

  for (const [key, value] of Object.entries(keyMetrics)) {
    if (hiddenKeys.has(key)) continue
    if (priority.includes(key)) continue
    cards.push({
      key,
      label: prettyMetricName(key),
      value: formatMetricValue(key, value),
      tip: metricTip(key),
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
