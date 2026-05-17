type TimelineSeriesDef = { key: string; label?: string }

export function PoseReportTimeline(props: {
  timeline: unknown[]
  series?: TimelineSeriesDef[]
  formatLabel: (key: string) => string
}) {
  const rows = props.timeline.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
  const candidates = ['kneeAngleDeg', 'hipAngleDeg', 'torsoFromVerticalDeg', 'kneeFlexDeg', 'centerY'] as const

  const preferredSeries: TimelineSeriesDef[] =
    props.series && Array.isArray(props.series) && props.series.length > 0
      ? props.series.filter((item): item is TimelineSeriesDef => !!item && typeof item.key === 'string' && item.key.trim().length > 0)
      : candidates.map((key) => ({ key }))

  const series = preferredSeries
    .map((item) => ({
      key: item.key,
      label: typeof item.label === 'string' ? item.label : null,
      values: rows.map((row) => row[item.key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
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
            <div className="pose-report-label">{item.label && item.label.trim().length > 0 ? item.label : props.formatLabel(item.key)}</div>
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

