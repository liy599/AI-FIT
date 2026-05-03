export function PoseReportSummaryBlock(props: { summary: string }) {
  const summaryTitle = extractSummaryTitle(props.summary)
  const summaryBody = extractSummaryBody(props.summary)
  return (
    <div className="pose-report-summary-block">
      <span className="pose-report-abbrev-title">{summaryTitle}</span>
      {summaryBody ? (
        <div className="pose-report-summary-box">
          <p className="pose-report-summary-copy">{summaryBody}</p>
        </div>
      ) : null}
    </div>
  )
}

function extractSummaryTitle(summary: string) {
  const text = summary.trim()
  if (!text) return 'Summary:'
  const index = text.indexOf(':')
  if (index <= 0) return text
  return `${text
    .slice(0, index)
    .replace(/\s*\([^)]*form accuracy[^)]*\)\s*/i, '')
    .trim()}:`
}

function extractSummaryBody(summary: string) {
  const text = summary.trim()
  if (!text) return ''
  const index = text.indexOf(':')
  if (index <= 0) return ''
  return text.slice(index + 1).trim().replace(/\s+\/\s+/g, '\n')
}

