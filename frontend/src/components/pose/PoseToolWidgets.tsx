import type { PoseAnalysisReport } from '../../lib/pose/report'
import { humanizePoseReport, mapPoseFeedbackMessage, poseTierLabel } from '../../lib/pose/feedbackCopy'
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
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []
  const repFindings = details && Array.isArray(details.repFindings) ? (details.repFindings as Array<Record<string, unknown>>) : []
  const repFindingsFlagged = repFindings.filter((item) => String(item.result ?? 'invalid') !== 'correct')
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
          {topIssueCards.length === 0 ? <div className="pose-muted-copy">No obvious issues detected</div> : null}
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
          {suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions</div> : null}
          <ol className="pose-report-suggestions">
            {suggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="pose-report-card pose-report-card-soft">
        <div className="pose-report-title">How This Report Scores Your Form</div>
        <p className="pose-report-intro">
          Use this quick guide to understand what counts as a valid rep, how form issues are judged, and when camera quality can limit scoring.
        </p>
        <ul className="pose-criteria-list pose-criteria-list-soft">
          <li>
            <div className="pose-criteria-item-head">
              <span className="pose-criteria-icon">01</span>
              <span className="pose-criteria-label">Counted rep</span>
            </div>
            <span className="pose-criteria-text">A rep is counted only when the analyzer sees a complete movement cycle, not just part of the motion.</span>
          </li>
          <li>
            <div className="pose-criteria-item-head">
              <span className="pose-criteria-icon">02</span>
              <span className="pose-criteria-label">Form check</span>
            </div>
            <span className="pose-criteria-text">Form issues are judged with rule thresholds plus multi-frame stability, so a single noisy frame does not decide the result.</span>
          </li>
          <li>
            <div className="pose-criteria-item-head">
              <span className="pose-criteria-icon">03</span>
              <span className="pose-criteria-label">Gate note</span>
            </div>
            <span className="pose-criteria-text">If camera angle or keypoint quality is unstable, that rep may be counted but excluded from valid scoring.</span>
          </li>
        </ul>
      </div>

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

      {repFindings.length > 0 ? (
        <div className="pose-report-card">
          <div className="pose-report-title">Rep Findings</div>
          {repFindingsFlagged.length > 0 ? (
            <div className="pose-report-issue-list">
              {repFindingsFlagged.map((item, index) => {
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
                return (
                  <div key={`${repNo}-${index}`} className="pose-report-issue">
                    <div className="pose-report-issue-head">
                      <strong>{`Rep ${repNo}`}</strong>
                      <span className={`pose-tier-pill pose-tier-${tier}`}>{poseTierLabel(tier)}</span>
                    </div>
                    <span>{lead}</span>
                    {tMs !== null ? <span>{`Seen at ${formatClock(tMs)}`}</span> : null}
                    {moreReasons.length > 0 ? <span>{`Also noticed: ${moreReasons.join(', ')}`}</span> : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="pose-muted-copy">
              <strong>Nice work.</strong> All assessed reps passed the form check. Keep the same control and camera setup next time.
            </div>
          )}
        </div>
      ) : null}

      {timeline.length > 0 ? <PoseReportTimeline timeline={timeline} formatLabel={prettyMetricName} /> : null}
    </div>
  )
}




