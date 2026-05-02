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
    <div className="cl_blog-widget mb-30 h-100 w-100 pose-live-feedback pose-live-right-card pose-live-guide-card pose-video-teaching-card">
      <div className="pose-panel-head">
        <span className="pose-panel-kicker">Tip</span>
        <h4 className="pose-panel-title">{exerciseDisplayName} Teaching Video</h4>
      </div>

      <div className="pose-tip-card pose-tip-card-light pose-live-section">
        {teachingCopy ? (
          <>
            <div
              style={{
                borderRadius: 14,
                padding: '10px 12px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                background: '#ecfdf5',
                color: '#065f46',
                fontWeight: 900,
                lineHeight: 1.35
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>Camera angle:</span> {teachingCopy.cameraAngle}
            </div>
            <div style={{ marginTop: 10 }}>
              <h6 className="sub-title mb-15 pose-section-title">Tips</h6>
              <ul className="pose-detail-list pose-detail-list-light" style={{ marginTop: 0, marginBottom: 0 }}>
                {teachingCopy.tipsLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div style={{ height: 12 }} />
          </>
        ) : null}
        {tutorialVideoSrc ? (
          <div className="pose-video-preview" style={{ marginTop: 0 }}>
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
    <div className="cl_blog-widget mb-30">
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
        <div style={{ marginTop: 14 }}>{reportContent}</div>
      ) : (
        <div className="pose-report-empty">
          <strong>No report yet</strong>
          <p>{offlineFileSizeMbText !== 'Not selected' ? 'Click "Analyze Locally" to generate the report.' : 'Select a video file first, then click "Analyze Locally".'}</p>
        </div>
      )}
    </div>
  )
}
