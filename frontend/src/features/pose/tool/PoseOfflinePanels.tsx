import type { ReactNode } from 'react'
import type { PoseAnalysisReport } from '../../pose'

type TeachingCopy = {
  cameraAngle: string
  tipsLines: string[]
} | null

type ChecklistItem = {
  label: string
  done?: boolean
  failed?: boolean
  saving?: boolean
}

export function PoseOfflineTeachingPanel(props: {
  exerciseDisplayName: string
  teachingCopy: TeachingCopy
  tutorialVideoSrc: string | null
}) {
  const { exerciseDisplayName, teachingCopy, tutorialVideoSrc } = props
  return (
    <div className="cl_blog-widget mb-30 h-full w-full pose-live-feedback pose-live-right-card pose-live-guide-card pose-video-teaching-card">
      <div className="pose-panel-head">
        <span className="pose-panel-kicker">Tip</span>
        <h4 className="pose-panel-title">{exerciseDisplayName} Teaching Video</h4>
      </div>

      <div className="pose-tip-card pose-tip-card-light pose-live-section">
        {teachingCopy ? (
          <>
            <div className="pose-teaching-angle-box">
              <span className="pose-teaching-angle-label">Camera angle:</span> {teachingCopy.cameraAngle}
            </div>
            <div className="pose-teaching-tips-wrap">
              <h6 className="sub-title mb-15 pose-section-title">Tips</h6>
              <ul className="pose-detail-list pose-detail-list-light pose-teaching-tips-list">
                {teachingCopy.tipsLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="pose-spacer-sm" />
          </>
        ) : null}
        {tutorialVideoSrc ? (
          <div className="pose-video-preview pose-video-preview-no-top">
            <video className="pose-video-preview__media" autoPlay muted loop playsInline controls src={tutorialVideoSrc} />
          </div>
        ) : (
          <div className="pose-muted-copy">&nbsp;</div>
        )}
      </div>
    </div>
  )
}

export function PoseOfflineReportPanel(props: {
  taskStatusToneClass: string
  taskStatusText: string
  offlineFileSizeMbText: string
  analysisStarted: boolean
  checklist: ChecklistItem[]
  offlineReport: PoseAnalysisReport | null
  reportContent: ReactNode
}) {
  const { taskStatusToneClass, taskStatusText, offlineFileSizeMbText, analysisStarted, checklist, offlineReport, reportContent } = props
  return (
    <div className="cl_blog-widget mb-30 w-100">
      <h4 className="cl_blog-widget-title mb-30">Analysis Report</h4>
      <div className="pose-report-overview">
        <span className={`pose-status-pill ${taskStatusToneClass}`}>{taskStatusText}</span>
        <span className="pose-status-pill pose-status-pill-muted">Video: {offlineFileSizeMbText}</span>
      </div>
      {analysisStarted ? (
        <div className="pose-task-checklist">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`pose-task-checklist__item${item.done ? ' is-done' : ''}${item.failed ? ' is-failed' : ''}`}
            >
              <span className="pose-task-checklist__icon">{item.done ? 'OK' : item.failed ? '!' : item.saving ? '...' : 'o'}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {offlineReport ? (
        <div className="pose-report-content-top">{reportContent}</div>
      ) : (
        <div className="pose-report-empty">
          <strong>No report yet</strong>
          <p>{offlineFileSizeMbText !== 'Not selected' ? 'Click "Analyze Locally" to generate the report.' : 'Select a video file first, then click "Analyze Locally".'}</p>
        </div>
      )}
    </div>
  )
}
