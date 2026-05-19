import type { ChangeEvent, ReactNode, Ref } from 'react'
import type { PoseAnalysisReport } from '../../modules/pose'
import type { OfflineOverlayTone, OfflineProgress } from '../../modules/pose'

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
    <div className="cl_blog-widget mb-30 h-full w-full pose-video-side-card pose-video-guide-card pose-video-teaching-card">
      <div className="pose-panel-head">
        <span className="pose-panel-kicker">Tip</span>
        <h4 className="pose-panel-title">{exerciseDisplayName} Teaching Video</h4>
      </div>

      <div className="pose-tip-card pose-tip-card-light pose-video-section">
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

export function PoseOfflineAnalysisPanel(props: {
  exerciseDisplayName: string
  posePolicyVersion: string
  localInferenceOnly: boolean
  offlineFile: File | null
  offlineBusy: boolean
  offlinePreviewUrl: string | null
  offlineOverlayReady: boolean
  offlineOverlayTone: OfflineOverlayTone | null
  offlineOverlayMessage: string | null
  offlineProgress: OfflineProgress
  offlineStatusMsg: string | null
  offlineError: string | null
  drawMode: 'midline' | 'full17'
  offlineFileInputRef: Ref<HTMLInputElement>
  offlineVideoRef: Ref<HTMLVideoElement>
  offlineCanvasRef: Ref<HTMLCanvasElement>
  onChooseFile: () => void
  onFileChange: (file: File | null) => void
  onAnalyze: () => void
  onDrawModeChange: (mode: 'midline' | 'full17') => void
}) {
  const {
    exerciseDisplayName,
    posePolicyVersion,
    localInferenceOnly,
    offlineFile,
    offlineBusy,
    offlinePreviewUrl,
    offlineOverlayReady,
    offlineOverlayTone,
    offlineOverlayMessage,
    offlineProgress,
    offlineStatusMsg,
    offlineError,
    drawMode,
    offlineFileInputRef,
    offlineVideoRef,
    offlineCanvasRef,
    onChooseFile,
    onFileChange,
    onAnalyze,
    onDrawModeChange
  } = props

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileChange(event.target.files?.[0] ?? null)
  }

  return (
    <div className="cl_blog-widget mb-30 h-full w-full pose-video-analysis-card">
      <div className="pose-tool-head">
        <div>
          <h4 className="cl_blog-widget-title mb-15">{exerciseDisplayName} - Video Analysis</h4>
          <p className="pose-tool-subtitle pose-tool-subtitle-dark">
            Local mode (privacy-first): pose extraction and analysis run in your browser. Video files are not uploaded.
          </p>
          <p className="pose-tool-subtitle pose-tool-subtitle-dark">
            Limit: 2 minutes. If your video is longer than 2 minutes, only the first 2 minutes will be analyzed.
          </p>
        </div>
      </div>

      <div className="pose-offline-steps">
        <div className={`pose-offline-step ${!offlineBusy && !offlineOverlayReady ? 'pose-offline-step--active' : offlineOverlayReady ? 'pose-offline-step--done' : ''}`}>
          <span className="pose-offline-step__num">1</span>
          <span className="pose-offline-step__label">Select a video file</span>
        </div>
        <div className={`pose-offline-step ${offlineBusy ? 'pose-offline-step--active' : offlineOverlayReady ? 'pose-offline-step--done' : ''}`}>
          <span className="pose-offline-step__num">2</span>
          <span className="pose-offline-step__label">Analyze locally</span>
        </div>
        <div className={`pose-offline-step ${offlineOverlayReady ? 'pose-offline-step--active' : ''}`}>
          <span className="pose-offline-step__num">3</span>
          <span className="pose-offline-step__label">Review results &amp; report</span>
        </div>
      </div>

      <div className="pose-form-grid pose-form-grid-single">
        <label className="pose-form-field">
          <span>Video File</span>
          <input
            ref={offlineFileInputRef}
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            onChange={handleChange}
            type="file"
            className="pose-file-input-hidden"
          />
          <div className="pose-file-picker">
            <button type="button" className="pose-tool-ghost-btn pose-tool-light-btn" onClick={onChooseFile}>
              Choose Video
            </button>
            <span className="pose-file-picker__name">{offlineFile ? offlineFile.name : 'No file selected'}</span>
          </div>
        </label>
      </div>

      <div className="pose-export-row">
        <button className="cl_theme-btn" disabled={offlineBusy} onClick={onAnalyze} type="button">
          {offlineBusy ? 'Analyzing...' : offlineFile ? 'Analyze Locally' : 'Select a video to start'}
        </button>
        {offlineFile && !offlineBusy ? (
          <span className="pose-inline-note pose-inline-note-top">Your video stays on this device — nothing is uploaded.</span>
        ) : null}
      </div>

      {offlinePreviewUrl ? (
        <div className="pose-video-preview">
          <div className="pose-video-preview__stack">
            <video ref={offlineVideoRef} controls src={offlinePreviewUrl} className="pose-video-preview__media" />
            <canvas ref={offlineCanvasRef} className="pose-video-preview__overlay" />
          </div>
          <div className="pose-video-preview__meta" role="status" aria-live="polite">
            {offlineOverlayReady && offlineOverlayTone ? (
              <>
                <span
                  className={`pose-status-pill ${
                    offlineOverlayTone === 'bad'
                      ? 'pose-status-pill-danger'
                      : offlineOverlayTone === 'warn'
                        ? 'pose-status-pill-warning'
                        : 'pose-status-pill-success'
                  }`}
                >
                  {offlineOverlayTone === 'ok' ? 'GOOD' : offlineOverlayTone === 'warn' ? 'WARN' : 'FIX'}
                </span>
                <span className="pose-video-preview__message">
                  {(() => {
                    const text = offlineOverlayMessage ?? (offlineOverlayTone === 'ok' ? 'Good form' : '')
                    if (!text || !text.trim()) return null
                    const lines = text.split('\n').map((line) => line.trim())
                    if (lines.length <= 1) {
                      const single = (lines[0] ?? '').trim() || null
                      if (!single) return null
                      if (offlineOverlayTone !== 'ok') return single
                      const base = single.endsWith('.') ? single : `${single}.`
                      return `${base} Keep it up.`
                    }
                    const gate = (lines[0] ?? '').trim() || null
                    const mainRaw = lines.slice(1).join(' ').trim()
                    const main = offlineOverlayTone === 'ok' ? (mainRaw ? `${mainRaw.endsWith('.') ? mainRaw : `${mainRaw}.`} Keep it up.` : 'Looking strong.') : mainRaw
                    return (
                      <span className="pose-video-preview__message-lines">
                        {gate ? (
                          <span className="pose-video-preview__gate">
                            <span className="pose-video-preview__gate-label">CAMERA</span>
                            <span className="pose-video-preview__gate-text">{gate}</span>
                          </span>
                        ) : null}
                        {main ? <span className="pose-video-preview__message-line">{main}</span> : null}
                      </span>
                    )
                  })()}
                </span>
              </>
            ) : (
              <span className="pose-video-preview__message pose-video-preview__message-muted">
                {offlineBusy ? 'Analyzing video... Overlay appears after completion.' : 'Run analysis to enable the replay overlay with live form feedback.'}
              </span>
            )}
          </div>
          <div className="pose-camera-toolbar pose-camera-toolbar-compact pose-camera-toolbar-offline">
            <div className="pose-camera-toolbar__group">
              <span className="pose-camera-toolbar__label">Overlay</span>
              <button
                className={drawMode === 'full17' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                onClick={() => onDrawModeChange('full17')}
                type="button"
              >
                Full Point
              </button>
              <button
                className={drawMode === 'midline' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                onClick={() => onDrawModeChange('midline')}
                type="button"
              >
                Midline
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {offlineProgress ? (
        <div className="pose-progress-card">
          <strong>{offlineProgress.stage}</strong>
          <div className="pose-progress-bar-wrap">
            <div
              className="pose-progress-bar-fill"
              style={{ width: `${offlineProgress.total > 0 ? Math.round((offlineProgress.processed / offlineProgress.total) * 100) : 0}%` }}
            />
          </div>
          <span className="pose-progress-card__count">
            {offlineProgress.processed}/{offlineProgress.total}
          </span>
        </div>
      ) : null}

      {offlineStatusMsg ? <div className="pose-inline-note">{offlineStatusMsg}</div> : null}
      {offlineError ? <div className="pose-error-box pose-error-box-light">
        <strong>Analysis could not complete</strong>
        <p>{offlineError}</p>
        <p className="pose-error-box__hint">Try a shorter video (under 2 min), ensure good lighting, and keep your whole body visible in frame.</p>
      </div> : null}
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
  reportAction?: ReactNode
}) {
  const { taskStatusToneClass, taskStatusText, offlineFileSizeMbText, analysisStarted, checklist, offlineReport, reportContent, reportAction } = props
  return (
    <div className="cl_blog-widget mb-30 h-full w-full pose-video-report-card">
      <div className="pose-report-panel-head">
        <h4 className="cl_blog-widget-title mb-0">Analysis Report</h4>
        {reportAction}
      </div>
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
              <span className="pose-task-checklist__icon">{item.done ? '✓' : item.failed ? '!' : item.saving ? '...' : 'o'}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {offlineReport ? (
        <div className="pose-report-content-top">{reportContent}</div>
      ) : (
        <>
          <div className="pose-report-empty">
            <strong>No report yet</strong>
            <p>{offlineFileSizeMbText !== 'Not selected' ? 'Click "Analyze Locally" to generate the report.' : 'Select a video file first, then click "Analyze Locally".'}</p>
          </div>
          <div className="pose-report-card pose-report-card-soft">
            <div className="pose-report-title">How this report works</div>
            <p className="pose-report-intro">
              The analyzer counts reps, checks form against exercise-specific rules, and flags trouble spots. Here is what each finding means:
            </p>
            <ul className="pose-criteria-list pose-criteria-list-soft">
              <li>
                <div className="pose-criteria-item-head">
                  <span className="pose-criteria-icon">01</span>
                  <span className="pose-criteria-label">Counted rep</span>
                </div>
                <span className="pose-criteria-text">A rep is counted only when the analyzer sees a complete movement cycle — not just part of the motion.</span>
              </li>
              <li>
                <div className="pose-criteria-item-head">
                  <span className="pose-criteria-icon">02</span>
                  <span className="pose-criteria-label">Form check</span>
                </div>
                <span className="pose-criteria-text">
                  Issues are judged across multiple frames for stability, so a single noisy frame won't decide the result.
                </span>
              </li>
              <li>
                <div className="pose-criteria-item-head">
                  <span className="pose-criteria-icon">03</span>
                  <span className="pose-criteria-label">Camera quality</span>
                </div>
                <span className="pose-criteria-text">
                  Poor lighting, partial body visibility, or unsteady camera angle may cause some reps to be counted but not scored.
                </span>
              </li>
              <li>
                <div className="pose-criteria-item-head">
                  <span className="pose-criteria-icon">04</span>
                  <span className="pose-criteria-label">Pro tip</span>
                </div>
                <span className="pose-criteria-text">
                  For best results: place the camera at hip height, keep 2-3 meters distance, and ensure shoulders-to-ankles stay fully visible.
                </span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
