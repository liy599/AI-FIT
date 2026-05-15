import type { PoseAnalysisReport } from '../../modules/pose/reporting'
import { humanizePoseReport, mapPoseFeedbackMessage, poseTierLabel } from '../../modules/pose/reporting'
import {
  TOP_ISSUE_TIME_DISPLAY,
  asRecord,
  buildDisplayMetricGroups,
  buildIssueMetaLine,
  buildRepQualityHighlight,
  buildTopIssueCards,
  formatClock,
  metricTip,
  pickMetricNumber,
  prettyMetricName,
  resolveDisplayMetrics
} from './PoseReportModel'
import { PoseReportSummaryBlock } from './PoseReportSummary'
import { PoseReportTimeline } from './PoseReportTimeline'


export function ReportVisualization(props: { report: PoseAnalysisReport }) {
  const report = humanizePoseReport(props.report as never) as unknown as Record<string, unknown>
  const keyMetrics = resolveDisplayMetrics(report)
  const metricGroups = buildDisplayMetricGroups(keyMetrics)
  const totalReps = pickMetricNumber(keyMetrics.totalReps) ?? 0
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []
  const timelineSeries =
    details && Array.isArray(details.timelineSeries)
      ? details.timelineSeries
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item) => ({
            key: String(item.key ?? '').trim(),
            label: typeof item.label === 'string' ? item.label : undefined
          }))
          .filter((item) => item.key.length > 0)
      : undefined
  const repFindings = details && Array.isArray(details.repFindings) ? (details.repFindings as Array<Record<string, unknown>>) : []
  const repFindingsFlagged = repFindings.filter((item) => String(item.result ?? 'invalid') !== 'correct')
  const maxFindingCards = 6
  const visibleFindings = repFindingsFlagged.slice(0, maxFindingCards)
  const exercise = asRecord(report.exercise)
  const exerciseSlug = String(exercise?.id ?? '').toLowerCase() || 'squat'
  const topIssueCards = buildTopIssueCards({
    issues,
    repFindings: repFindingsFlagged,
    exerciseSlug,
    options: TOP_ISSUE_TIME_DISPLAY
  })

  return (
    <div className="pose-report-stack">
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <PoseReportSummaryBlock summary={typeof report.summary === 'string' ? report.summary : ''} />
      </div>

      {(() => {
        const highlight = buildRepQualityHighlight({ repFindings: repFindingsFlagged, exerciseSlug, keyMetrics, issues })
        return (
          <div className={`pose-report-card pose-report-highlight pose-report-highlight-${highlight.tone}`}>
            <div className="pose-report-title">Rep Quality Highlight</div>
            <div className="pose-report-highlight-body">
              <strong>{highlight.headline}</strong>
              <p>{highlight.copy}</p>
            </div>
          </div>
        )
      })()}

      <div className="pose-report-columns">
        <div className="pose-report-card pose-report-card-issues">
          <div className="pose-report-title">Top Issues</div>
          {topIssueCards.length === 0 ? (
            totalReps === 0 ? (
              <div className="pose-muted-copy">No reps detected yet. Check camera angle and ensure a full rep cycle is captured.</div>
            ) : (
              <div className="pose-muted-copy">No obvious issues detected</div>
            )
          ) : null}
          <div className="pose-report-issue-list">
            {topIssueCards.map((issue, index) => (
              <div key={index} className="pose-report-issue">
                <div className="pose-report-issue-head">
                  <strong>{issue.label}</strong>
                  <span className={`pose-tier-pill pose-tier-${issue.tier}`}>{poseTierLabel(issue.tier)}</span>
                </div>
                <span>{buildIssueMetaLine(issue)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pose-report-card pose-report-card-fixes">
          <div className="pose-report-title">What To Fix</div>
          {suggestions.length === 0 ? (
            totalReps === 0 ? (
              <div className="pose-muted-copy">No rep-level suggestions because no complete reps were detected.</div>
            ) : (
              <div className="pose-muted-copy">No suggestions</div>
            )
          ) : null}
          <ol className="pose-report-suggestions">
            {suggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      {totalReps === 0 ? (
        <div className="pose-report-card pose-report-highlight pose-report-highlight-soft">
          <div className="pose-report-title">Rep Findings</div>
          <div className="pose-report-highlight-body">
            <strong>No reps detected.</strong>
            <p>Try recording with a clearer camera angle, keep the full body visible, and capture the full movement range.</p>
          </div>
        </div>
      ) : repFindings.length > 0 ? (
        repFindingsFlagged.length > 0 ? (
          <div className="pose-report-card">
            <div className="pose-report-title">Rep Findings</div>
            <div className="pose-report-issue-list">
              {visibleFindings.map((item, index) => {
                const repNo = typeof item.repNumber === 'number' ? item.repNumber : index + 1
                const result = String(item.result ?? 'invalid')
                const primaryIssue = String(item.primaryIssue ?? 'No detail')
                const reasons = Array.isArray(item.reasons) ? item.reasons.filter((x): x is string => typeof x === 'string') : []
                const tier: 'rep_fail' | 'gate' = result === 'incorrect' ? 'rep_fail' : 'gate'
                const tMs = pickMetricNumber(item.tMs)
                const lead = mapPoseFeedbackMessage({ exerciseSlug, message: primaryIssue }).label
                const moreReasons = reasons
                  .map((reason) => mapPoseFeedbackMessage({ exerciseSlug, message: reason }).label)
                  .filter((reason, reasonIndex, all) => !!reason && all.indexOf(reason) === reasonIndex && reason !== lead)
                const snapshotDataUrl = typeof item.snapshotDataUrl === 'string' ? item.snapshotDataUrl : null
                return (
                  <div key={`${repNo}-${index}`} className="pose-report-finding">
                    <div className="pose-report-finding__thumb">
                      {snapshotDataUrl ? <img src={snapshotDataUrl} alt={`Rep ${repNo} snapshot`} loading="lazy" /> : <div className="pose-report-finding__thumb-placeholder" />}
                    </div>
                    <div className="pose-report-finding__body">
                      <div className="pose-report-issue-head">
                        <strong>{`Rep ${repNo}`}</strong>
                        <span className={`pose-tier-pill pose-tier-${tier}`}>{poseTierLabel(tier)}</span>
                      </div>
                      <span>{lead}</span>
                      {tMs !== null ? <span>{`Seen at ${formatClock(tMs)}`}</span> : null}
                      {moreReasons.length > 0 ? <span>{`Also noticed: ${moreReasons.join(', ')}`}</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {repFindingsFlagged.length > maxFindingCards ? <div className="pose-muted-copy">{`Showing ${maxFindingCards} of ${repFindingsFlagged.length} findings`}</div> : null}
          </div>
        ) : (
          <div className="pose-report-card pose-report-highlight pose-report-highlight-good">
            <div className="pose-report-title">Rep Findings</div>
            <div className="pose-report-highlight-body">
              <strong>Nice work.</strong>
              <p>All assessed reps passed the form check. Keep the same control and camera setup next time.</p>
            </div>
          </div>
        )
      ) : null}

      {metricGroups.length > 0 ? (
        <div className="pose-report-card pose-report-card-metrics">
          <div className="pose-report-title">Key Metrics</div>
          <div className="pose-report-metrics-stack">
            {metricGroups.map((group) => (
              <div key={group.group} className="pose-report-metric-section">
                <div className="pose-report-metric-section-title">{group.group}</div>
                <div className="pose-report-metrics">
                  {group.items.map((item) => (
                    <div key={item.key} className="pose-report-card">
                      <div className="pose-report-label" title={item.tip ?? metricTip(item.key)}>
                        {item.label}
                      </div>
                      <div className="pose-report-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {timeline.length > 0 ? <PoseReportTimeline timeline={timeline} series={timelineSeries} formatLabel={prettyMetricName} /> : null}
    </div>
  )
}
