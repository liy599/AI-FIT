export function PoseReportTimeline(props: { timeline: unknown[]; formatLabel: (key: string) => string }) {
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
            <div className="pose-report-label">{props.formatLabel(item.key)}</div>
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

