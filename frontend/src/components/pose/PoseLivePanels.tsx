import type { Ref } from 'react'
import type { RealtimeFeedback, TrackingState } from '../../modules/pose'
import { formatDuration, LabelWithTip, MetricCard, poseTierLabel } from '../../modules/pose'
import type { LiveSessionEndReason, LiveSessionStatus, LiveSessionSummary } from '../../modules/pose'

type TeachingCopy = {
  cameraAngle: string
  tipsLines: string[]
} | null

type MainTip = {
  label: string
  tier: 'gate' | 'warning' | 'issue' | 'rep_fail'
}

export function PoseLiveModePanels(props: {
  exerciseDisplayName: string
  liveSubtitle: string
  liveStageTip: string
  secondaryMetricLabel: string
  secondaryMetricTip: string
  teachingCopy: TeachingCopy
  tutorialVideoSrc: string | null
  running: boolean
  loading: boolean
  loadingMsg: string | null
  error: string | null
  liveSessionStatus: LiveSessionStatus
  liveSessionEndReason: LiveSessionEndReason
  liveSessionElapsedMs: number
  liveSessionLimitMs: number
  liveSessionSummary: LiveSessionSummary | null
  effectiveFps: number | null
  tracking: TrackingState | null
  feedback: RealtimeFeedback | null
  rangeStatusText: string
  displayMainTip: MainTip
  drawMode: 'midline' | 'full17'
  previewScale: number
  savingTraining: boolean
  saveTrainingMsg: string | null
  videoRef: Ref<HTMLVideoElement>
  canvasRef: Ref<HTMLCanvasElement>
  onToggleLive: () => void
  onResetLive: () => void
  onSaveTraining: () => void
  onDrawModeChange: (mode: 'midline' | 'full17') => void
  onPreviewScaleChange: (value: number) => void
}) {
  return (
    <>
      <PoseLiveGuidePanel
        exerciseDisplayName={props.exerciseDisplayName}
        teachingCopy={props.teachingCopy}
        tutorialVideoSrc={props.tutorialVideoSrc}
      />
      <PoseLiveCameraPanel {...props} />
      <PoseLiveFeedbackPanel {...props} />
    </>
  )
}

function PoseLiveGuidePanel(props: {
  exerciseDisplayName: string
  teachingCopy: TeachingCopy
  tutorialVideoSrc: string | null
}) {
  return (
    <div className="pose-tool-live-col pose-tool-live-col-guide">
      <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card pose-live-guide-card">
        <div className="pose-panel-head">
          <span className="pose-panel-kicker">Guide</span>
          <h4 className="pose-panel-title">{props.exerciseDisplayName} Quick Guide</h4>
          <p className="pose-panel-subtitle">How to operate, read the camera overlay, and follow form cues.</p>
        </div>

        <details className="pose-guide-details pose-tip-card pose-tip-card-light pose-live-section">
          <summary className="pose-guide-details__summary">1) Setup</summary>
          <ul className="pose-detail-list pose-detail-list-light">
            <li>Place the camera steady and keep your full body in frame.</li>
            <li>Tap Start and move at a controlled tempo.</li>
            <li>Tap Stop to end the set, then save if it looks valid.</li>
          </ul>
        </details>

        <details className="pose-guide-details pose-tip-card pose-tip-card-light pose-live-section">
          <summary className="pose-guide-details__summary">2) Color Overlay</summary>
          <ul className="pose-detail-list pose-detail-list-light">
            <li>Body box: Green = OK, Orange = too close, Red = too far.</li>
            <li>Skeleton lines: Green = normal, Yellow = warning, Red = issue.</li>
            <li>Use Live Feedback to correct form between reps.</li>
          </ul>
        </details>

        <details className="pose-guide-details pose-tip-card pose-tip-card-light pose-live-section">
          <summary className="pose-guide-details__summary">3) Validity & Scoring</summary>
          <ul className="pose-detail-list pose-detail-list-light">
            <li>Keep camera distance at OK and avoid leaving the frame.</li>
            <li>Maintain the required view angle for your exercise.</li>
            <li>Unstable tracking can reduce assessed rep coverage.</li>
          </ul>
        </details>

        <div className="pose-panel-head">
          <span className="pose-panel-kicker">Tip</span>
          <h4 className="pose-panel-title">{props.exerciseDisplayName} Teaching Video</h4>
        </div>

        <div className="pose-tip-card pose-tip-card-light pose-live-section">
          {props.teachingCopy ? (
            <>
              <div className="pose-teaching-angle-box pose-teaching-angle-box-sticky">
                <span className="pose-teaching-angle-label">Camera angle:</span> {props.teachingCopy.cameraAngle}
              </div>
              <details className="pose-guide-details pose-guide-details-top">
                <summary className="pose-guide-details__summary">Tips</summary>
                <ul className="pose-detail-list pose-detail-list-light pose-guide-details-list">
                  {props.teachingCopy.tipsLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
              <div className="pose-spacer-sm" />
            </>
          ) : null}
          {props.tutorialVideoSrc ? (
            <div className="pose-video-preview pose-video-preview-no-top">
              <video className="pose-video-preview__media" autoPlay muted loop playsInline controls src={props.tutorialVideoSrc} />
            </div>
          ) : (
            <div className="pose-muted-copy">&nbsp;</div>
          )}
        </div>
      </div>
    </div>
  )
}

function PoseLiveCameraPanel(props: Parameters<typeof PoseLiveModePanels>[0]) {
  return (
    <div className="pose-tool-live-col pose-tool-live-col-camera">
      <div className="cl_blog-widget mb-30 pose-camera-panel h-full w-full pose-live-camera-card">
        <div className="pose-tool-head">
          <div>
            <h4 className="cl_blog-widget-title mb-15">{props.exerciseDisplayName} - Realtime Camera</h4>
            <p className="pose-tool-subtitle pose-tool-subtitle-dark">{props.liveSubtitle}</p>
          </div>
          <div className="pose-tool-actions">
            <button className="cl_theme-btn" onClick={props.onToggleLive} type="button">
              {props.running ? 'Stop' : props.loading ? 'Loading...' : 'Start'}
            </button>
            <button className="pose-tool-ghost-btn pose-tool-light-btn" onClick={props.onResetLive} type="button">
              Reset
            </button>
          </div>
        </div>

        <div className="pose-tip-card pose-tip-card-light pose-live-session-card">
          <div className="pose-session-status-head">
            <strong>
              {props.liveSessionStatus === 'running'
                ? 'Started: Live coaching is in progress'
                : props.liveSessionStatus === 'ended'
                  ? 'Terminated: Live coaching has ended'
                  : 'Ready: Click Start to begin live coaching'}
            </strong>
            <span className={`pose-session-status-pill pose-session-status-pill-${props.liveSessionStatus}`}>
              {props.liveSessionStatus === 'running' ? 'STARTED' : props.liveSessionStatus === 'ended' ? 'TERMINATED' : 'IDLE'}
            </span>
          </div>
          <progress
            className={`pose-session-progress ${props.liveSessionStatus === 'ended' ? 'is-ended' : ''}`}
            max={100}
            value={Math.min(100, (props.liveSessionElapsedMs / props.liveSessionLimitMs) * 100)}
          />
          <div className="pose-session-progress-meta">
            <span>Time Progress</span>
            <span>{formatDuration(props.liveSessionElapsedMs)} / 02:00</span>
          </div>
          <div className="pose-live-metrics-line pose-live-metrics-line-top">
            <span title="AI model used for real-time pose estimation.">AI Model: MoveNet</span>
            <span title="Frames processed per second. Higher means smoother feedback.">Speed (FPS): {props.effectiveFps ?? '-'}</span>
            <span title="Current pose keypoint detection stability.">Detection Status: {props.tracking?.status ?? '-'}</span>
            <span title={props.liveStageTip}>Movement Stage: {props.feedback?.phase ?? '-'}</span>
          </div>
        </div>

        <div className="pose-stage pose-stage-landscape">
          <video ref={props.videoRef} autoPlay playsInline muted className="pose-stage-media pose-stage-video-hidden" />
          <canvas ref={props.canvasRef} className="pose-stage-media pose-stage-canvas" />
          {!props.running ? <div className="pose-stage-overlay">{props.loadingMsg ?? 'Click Start to begin real-time pose detection'}</div> : null}
        </div>

        <div className="pose-camera-toolbar pose-camera-toolbar-compact">
          <div className="pose-camera-toolbar__group">
            <span className="pose-camera-toolbar__label">Overlay</span>
            <button
              className={props.drawMode === 'full17' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
              onClick={() => props.onDrawModeChange('full17')}
              type="button"
            >
              Full Point
            </button>
            <button
              className={props.drawMode === 'midline' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
              onClick={() => props.onDrawModeChange('midline')}
              type="button"
            >
              Midline
            </button>
          </div>
          <label className="pose-slider-control">
            <span>Zoom</span>
            <input
              type="range"
              min="0.55"
              max="1.05"
              step="0.01"
              value={props.previewScale}
              onChange={(event) => props.onPreviewScaleChange(Number(event.target.value))}
            />
            <strong>{Math.round(props.previewScale * 100)}%</strong>
          </label>
        </div>

        {props.error ? <div className="pose-error-box">{props.error}</div> : null}
      </div>
    </div>
  )
}

function PoseLiveFeedbackPanel(props: Parameters<typeof PoseLiveModePanels>[0]) {
  if (props.liveSessionStatus === 'ended' && props.liveSessionSummary) {
    return (
      <div className="pose-tool-live-col pose-tool-live-col-feedback">
        <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card">
          <div className="pose-panel-head">
            <span className="pose-panel-kicker">Session Closed</span>
            <h4 className="pose-panel-title">Training Summary</h4>
            <p className="pose-panel-subtitle">{props.liveSessionEndReason === 'timeout' ? 'Auto-ended at 2-minute limit' : 'Ended manually by user'}</p>
          </div>
          <ul className="pose-detail-list pose-detail-list-light pose-live-summary-list pose-kv-grid">
            <li className="pose-kv-item pose-kv-item-wide">
              <span className="pose-kv-label">Session</span>
              <strong className="pose-kv-value">{props.liveSessionEndReason === 'timeout' ? 'Ended by 2-minute limit' : 'Stopped by user'}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Total elapsed live session time.">Duration</span>
              <strong className="pose-kv-value">{formatDuration(props.liveSessionElapsedMs)}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="All completed reps, including invalid reps.">Total Reps</span>
              <strong className="pose-kv-value">{props.liveSessionSummary.reps}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Assessed reps judged as correct form.">Correct Reps</span>
              <strong className="pose-kv-value">{props.liveSessionSummary.correctReps}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Assessed reps judged as incorrect form.">Incorrect Reps</span>
              <strong className="pose-kv-value">{props.liveSessionSummary.incorrectReps}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Correct / (Correct + Incorrect), excludes invalid reps.">Accuracy</span>
              <strong className="pose-kv-value">{props.liveSessionSummary.accuracyPct}%</strong>
            </li>
          </ul>
          <div className="pose-tip-card pose-tip-card-light pose-live-section">
            <h6 className="sub-title mb-15 pose-section-title">Session Insight</h6>
            <p>{props.liveSessionSummary.sessionComment}</p>
          </div>
          {props.liveSessionSummary.topIssues.length > 0 ? (
            <div className="pose-tip-card pose-tip-card-light pose-live-section">
              <h6 className="sub-title mb-15 pose-section-title">Top Issues</h6>
              <ul className="pose-detail-list pose-detail-list-light">
                {props.liveSessionSummary.topIssues.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="pose-export-row">
            <button className="pose-tool-ghost-btn pose-tool-light-btn" disabled={props.savingTraining} onClick={props.onSaveTraining} type="button">
              {props.savingTraining ? 'Saving...' : 'Save Training'}
            </button>
          </div>
          {props.saveTrainingMsg ? <div className="pose-inline-note">{props.saveTrainingMsg}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="pose-tool-live-col pose-tool-live-col-feedback">
      <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card">
        <div className="pose-panel-head">
          <span className="pose-panel-kicker">In Session</span>
          <h4 className="pose-panel-title">Live Feedback</h4>
          <p className="pose-panel-subtitle">Real-time form diagnostics and coaching cues</p>
        </div>
        <div className="pose-kpi-grid pose-kpi-grid-light">
          <MetricCard label={<LabelWithTip label="Total Reps" tip="All completed reps, including reps that were not assessed due to view/quality limits." />} value={props.feedback?.repCount ?? 0} />
          <MetricCard label={<LabelWithTip label="Effective Reps" tip="Reps that were fully assessed and judged as correct or incorrect." />} value={(props.feedback?.correctCount ?? 0) + (props.feedback?.incorrectCount ?? 0)} />
          <MetricCard label={<LabelWithTip label="Invalid Reps" tip="Completed reps excluded from validity scoring (for example unstable side view or incomplete keypoints)." />} value={props.feedback?.session.unassessedReps ?? Math.max(0, (props.feedback?.repCount ?? 0) - ((props.feedback?.correctCount ?? 0) + (props.feedback?.incorrectCount ?? 0)))} />
          <MetricCard label={<LabelWithTip label="Form Accuracy" tip="Accuracy among assessed reps only: correct / (correct + incorrect)." />} value={props.feedback?.session.accuracyPct ?? 0} unit="%" />
          <MetricCard label={<LabelWithTip label={props.secondaryMetricLabel} tip={props.secondaryMetricTip} />} value={props.feedback?.kneeAngle ?? '-'} unit={props.feedback?.kneeAngle ? '°' : ''} />
          <MetricCard label={<LabelWithTip label="Hip Bend" tip="Estimated hip joint angle during your movement." />} value={props.feedback?.hipAngle ?? '-'} unit={props.feedback?.hipAngle ? '°' : ''} />
          <MetricCard label={<LabelWithTip label="Torso Lean" tip="Estimated torso angle relative to upright posture." />} value={props.feedback?.torsoAngle ?? '-'} unit={props.feedback?.torsoAngle ? '°' : ''} />
        </div>

        <div className="pose-tip-card pose-tip-card-light pose-live-section pose-live-section-split">
          <div className="pose-live-tip-head">
            <h6 className="sub-title mb-15 pose-section-title pose-section-title-compact">Coaching Tip</h6>
            <span className={`pose-tier-pill pose-tier-${props.displayMainTip.tier}`}>{poseTierLabel(props.displayMainTip.tier)}</span>
          </div>
          <p className="pose-live-coaching-copy pose-live-coaching-copy-fill">{props.displayMainTip.label}</p>
        </div>

        <div className="pose-tip-card pose-tip-card-light pose-live-section">
          <h6 className="sub-title mb-15 pose-section-title">Camera & Validity</h6>
          <ul className="pose-detail-list pose-detail-list-light pose-kv-grid pose-status-kv-grid">
            <li className="pose-kv-item pose-kv-item-wide">
              <span className="pose-kv-label" title="Whether your camera distance is suitable for stable full-body detection.">Camera Distance</span>
              <strong className="pose-kv-value">{props.rangeStatusText}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Confidence and stability of keypoint tracking.">Detection Quality</span>
              <strong className="pose-kv-value">{props.feedback ? `${Math.round(props.feedback.trackingQuality * 100)}%` : '-'}</strong>
            </li>
            <li className="pose-kv-item">
              <span className="pose-kv-label" title="Result of your most recent completed rep.">Last Rep Result</span>
              <strong className="pose-kv-value">{props.feedback?.lastRepResult ?? '-'}</strong>
            </li>
          </ul>
        </div>

        {props.saveTrainingMsg ? <div className="pose-inline-note">{props.saveTrainingMsg}</div> : null}
      </div>
    </div>
  )
}

