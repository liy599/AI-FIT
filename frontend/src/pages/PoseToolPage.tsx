import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import {
  DistanceTracker,
  type DistanceState,
  MoveNetStabilizer,
  REALTIME_DEFAULT_SQUAT_TUNING,
  ReportVisualization,
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseToolPath,
  buildPoseVideoPath,
  buildTrainingRecordName,
  configureAnalyzer,
  createAnalyzer,
  createBestRealtimePoseProvider,
  createPoseTraining,
  getPoseExerciseBySlug,
  getSquatTuningConfig,
  humanizePoseReport,
  pickLiveMainTip,
  prewarmMoveNet,
  resolveAnalyzerTuning,
  type PoseAnalysisReport,
  type RealtimeAnalyzer,
  type RealtimeFeedback,
  type SquatRepFinding,
  type SquatTimelineRow,
  type SquatTuning,
  type TrackingState,
  updateSquatTuningConfig
} from '../modules/pose'
import {
  POSE_TOOL_MESSAGES,
  buildOfflineTaskUi,
  getPoseTeachingCopy,
  getRangeStatusText,
  getTutorialVideoSrc,
  poseToolErrorMessage,
  resolvePoseToolMode
} from '../modules/pose/tool/shared'
import { useOfflineFileHandler } from '../modules/pose/tool/useOfflineFileHandler'
import { PoseOfflineAnalysisPanel, PoseOfflineReportPanel, PoseOfflineTeachingPanel } from '../components/pose/PoseOfflinePanels'
import { useOfflinePoseAnalysis } from '../modules/pose/tool/useOfflinePoseAnalysis'
import { useOfflineReplayOverlay } from '../modules/pose/tool/useOfflineReplayOverlay'
import { useRealtimePoseProvider } from '../modules/pose/tool/useRealtimePoseProvider'
import { usePoseRuntimePolicy } from '../modules/pose/tool/usePoseRuntimePolicy'
import { usePoseModelWarmup } from '../modules/pose/tool/usePoseModelWarmup'
import { useThrottledMainTip } from '../modules/pose/tool/useThrottledMainTip'
import { PoseLiveModePanels } from '../components/pose/PoseLivePanels'
import { resetLiveStats } from '../modules/pose/tool/liveFrameStats'
import { startLiveDetectionSession } from '../modules/pose/tool/liveDetectionSession'
import { cleanupLiveMedia } from '../modules/pose/tool/liveMediaCleanup'
import { buildLiveReport, buildLiveSessionSummary, buildLiveTrainingPayload, resolveResetLiveState, resolveStopLiveState, validateLiveTrainingSave } from '../modules/pose/tool/liveSession'
import { buildSquatTuningSavePayload, resolveSquatTuningSaveMessage, validateSquatTuningSave } from '../modules/pose/tool/squatTuningSave'
import type {
  LiveSessionEndReason,
  LiveSessionStatus,
  LiveSessionSummary,
  OfflineOverlayTone,
  OfflineProgress,
  OfflineReplayData,
  PoseToolMode
} from '../modules/pose/tool/types'

export default function PoseToolPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const { user } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  const mode = useMemo<PoseToolMode>(() => resolvePoseToolMode(location.pathname, location.search), [location.pathname, location.search])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const analyzerRef = useRef<RealtimeAnalyzer | null>(null)
  const stabilizerRef = useRef<MoveNetStabilizer | null>(null)
  const distanceTrackerRef = useRef<DistanceTracker | null>(null)
  const fpsRef = useRef<{ windowStart: number; frames: number }>({ windowStart: performance.now(), frames: 0 })
  const lastProcessedTsRef = useRef(0)
  const sessionStartedAtRef = useRef<string | null>(null)
  const sessionStartedPerfRef = useRef<number | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const previewScaleRef = useRef(0.78)
  const drawModeRef = useRef<'midline' | 'full17'>('full17')
  const offlineFileInputRef = useRef<HTMLInputElement | null>(null)
  const offlineVideoRef = useRef<HTMLVideoElement | null>(null)
  const offlineCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const offlineReplayDataRef = useRef<OfflineReplayData | null>(null)
  const offlineReplayRafRef = useRef<number | null>(null)
  const offlineOverlayUiRef = useRef<{ tone: OfflineOverlayTone | null; message: string | null }>({ tone: null, message: null })
  const offlineDrawNowRef = useRef<(() => void) | null>(null)
  const feedbackRef = useRef<RealtimeFeedback | null>(null)
  const liveIssueFreqRef = useRef<Map<string, number>>(new Map())
  const liveTrackingQualitySamplesRef = useRef<number[]>([])
  const liveTimelineRowsRef = useRef<SquatTimelineRow[]>([])
  const liveRepFindingsRef = useRef<SquatRepFinding[]>([])
  const liveLastRepCountRef = useRef(0)
  const liveAnalyzedFrameCountRef = useRef(0)
  const { getProvider: getLiveProvider } = useRealtimePoseProvider(createBestRealtimePoseProvider)

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null)
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [distance, setDistance] = useState<DistanceState | null>(null)
  const [effectiveFps, setEffectiveFps] = useState<number | null>(null)
  const [drawMode, setDrawMode] = useState<'midline' | 'full17'>('full17')
  const [savingTraining, setSavingTraining] = useState(false)
  const [saveTrainingMsg, setSaveTrainingMsg] = useState<string | null>(null)
  const [, setSavedLiveSessionId] = useState<number | null>(null)
  const [previewScale, setPreviewScale] = useState(0.78)
  const [liveSessionStatus, setLiveSessionStatus] = useState<LiveSessionStatus>('idle')
  const [liveSessionEndReason, setLiveSessionEndReason] = useState<LiveSessionEndReason>(null)
  const [liveSessionElapsedMs, setLiveSessionElapsedMs] = useState(0)
  const [liveSessionSummary, setLiveSessionSummary] = useState<LiveSessionSummary | null>(null)
  const [liveSquatTuning, setLiveSquatTuning] = useState<SquatTuning>({ ...REALTIME_DEFAULT_SQUAT_TUNING })
  const [savingSquatTuningConfig, setSavingSquatTuningConfig] = useState(false)
  const [squatTuningConfigMsg, setSquatTuningConfigMsg] = useState<string | null>(null)

  const [offlineFile, setOfflineFile] = useState<File | null>(null)
  const [offlinePreviewUrl, setOfflinePreviewUrl] = useState<string | null>(null)
  const [offlineViewAngle, setOfflineViewAngle] = useState<'unknown' | 'front' | 'side' | 'back'>(
    exercise.slug === 'lateral-raise' ? 'front' : 'side'
  )
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(null)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineReport, setOfflineReport] = useState<PoseAnalysisReport | null>(null)
  const [offlineStatusMsg, setOfflineStatusMsg] = useState<string | null>(null)
  const [offlineReportSessionId, setOfflineReportSessionId] = useState<number | null>(null)
  const [offlineArchiveStatus, setOfflineArchiveStatus] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')
  const [offlineLocalStatus, setOfflineLocalStatus] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle')
  const [offlineRunStarted, setOfflineRunStarted] = useState(false)
  const [offlineCompletedStep, setOfflineCompletedStep] = useState(0)
  const [offlineOverlayTone, setOfflineOverlayTone] = useState<OfflineOverlayTone | null>(null)
  const [offlineOverlayMessage, setOfflineOverlayMessage] = useState<string | null>(null)
  const [offlineOverlayReady, setOfflineOverlayReady] = useState(false)

  useEffect(() => {
    previewScaleRef.current = previewScale
  }, [previewScale])

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  useEffect(() => {
    feedbackRef.current = feedback
  }, [feedback])

  usePoseModelWarmup(prewarmMoveNet)

  const {
    posePolicy,
    posePolicyVersion,
    liveTargetFps,
    liveTargetFrameMs,
    liveSessionLimitMs,
    maxVideoBytes,
    localInferenceDefault,
    serverConsentRequired,
    tempoFastThresholdSec,
    poseRuntimeRules,
    policySquatTuning
  } = usePoseRuntimePolicy(mode)
  useOfflineReplayOverlay({
    mode,
    drawMode,
    drawModeRef,
    offlineOverlayReady,
    offlinePreviewUrl,
    offlineVideoRef,
    offlineCanvasRef,
    offlineReplayDataRef,
    offlineReplayRafRef,
    offlineOverlayUiRef,
    offlineDrawNowRef,
    setOfflineOverlayTone,
    setOfflineOverlayMessage
  })

  useEffect(() => {
    if (exercise.slug !== 'squat') return
    analyzerRef.current?.setTuning?.(liveSquatTuning)
  }, [exercise.slug, liveSquatTuning])

  useEffect(() => {
    if (exercise.slug !== 'squat') return
    // Policy baseline first, then optional admin tuning override from backend config API.
    setLiveSquatTuning((prev) => ({ ...prev, ...policySquatTuning }))
    let cancelled = false
    void (async () => {
      try {
        const cfg = await getSquatTuningConfig()
        if (cancelled) return
        if (cfg?.tuning) {
          setLiveSquatTuning((prev) => ({ ...prev, ...policySquatTuning, ...cfg.tuning }))
        }
      } catch {
        // Keep policy-backed defaults when config API is unavailable.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exercise.slug, policySquatTuning])

  useEffect(() => {
    cleanupLiveMedia({ cleanupRef, videoRef })
    setRunning(false)
    setLoading(false)
    setLoadingMsg(null)
    setTracking(null)
    setDistance(null)

    try {
      analyzerRef.current = createAnalyzer(exercise.slug)
    } catch (e: unknown) {
      analyzerRef.current = null
      setError(e instanceof Error ? e.message : 'Analyzer initialization failed')
      return
    }
    configureAnalyzer(analyzerRef.current, exercise.slug, 'live', {
      tuningOverride: resolveAnalyzerTuning(exercise.slug, poseRuntimeRules, liveSquatTuning),
      analyzerFps: liveTargetFps
    })
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    setLiveSessionSummary(null)
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineLocalStatus('idle')
    setOfflineRunStarted(false)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineStatusMsg(null)
    setOfflineViewAngle(exercise.slug === 'lateral-raise' ? 'front' : 'side')
    setSquatTuningConfigMsg(null)
    liveIssueFreqRef.current = new Map()
    liveTrackingQualitySamplesRef.current = []
    liveTimelineRowsRef.current = []
    liveRepFindingsRef.current = []
    liveLastRepCountRef.current = 0
    liveAnalyzedFrameCountRef.current = 0
  }, [exercise.slug])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const startedAt = sessionStartedPerfRef.current
      if (!startedAt) return
      const elapsed = Math.min(liveSessionLimitMs, Math.max(0, performance.now() - startedAt))
      setLiveSessionElapsedMs(elapsed)
      if (elapsed >= liveSessionLimitMs) {
        stopLive('timeout')
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, liveSessionLimitMs])

  useEffect(() => {
    return () => {
      cleanupLiveMedia({ cleanupRef, videoRef })
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const currentMainTip = useMemo(
    () =>
      pickLiveMainTip({
        exerciseSlug: exercise.slug,
        feedback: feedback
          ? {
              warnings: feedback.warnings ?? [],
              issues: feedback.issues?.map((x) => ({ message: x.message })) ?? [],
              lastRepMessage: feedback.lastRepMessage ?? null,
              lastRepReasonLabels: feedback.lastRepReasonLabels ?? []
            }
          : null
      }),
    [exercise.slug, feedback]
  )

  const displayMainTip = useThrottledMainTip(currentMainTip, 1000)

  const rangeStatusText = useMemo(() => getRangeStatusText(distance), [distance])


  function resetLiveDedicatedSessionStats() {
    resetLiveStats({
      issueFreqRef: liveIssueFreqRef,
      trackingQualitySamplesRef: liveTrackingQualitySamplesRef,
      timelineRowsRef: liveTimelineRowsRef,
      repFindingsRef: liveRepFindingsRef,
      lastRepCountRef: liveLastRepCountRef,
      analyzedFrameCountRef: liveAnalyzedFrameCountRef
    })
  }

  const liveReport = useMemo(
    () =>
      buildLiveReport({
        exercise: { slug: exercise.slug, displayName: exercise.displayName },
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        effectiveFps,
        liveTargetFps,
        feedback,
        issueFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current,
        currentMainTipLabel: currentMainTip.label,
        tempoFastThresholdSec,
        poseRuntimeRules
      }),
    [currentMainTip.label, effectiveFps, exercise.displayName, exercise.slug, feedback, liveTargetFps, tempoFastThresholdSec, poseRuntimeRules]
  )

  async function startLive() {
    setError(null)
    setLoading(true)
    setLoadingMsg('Initializing model and camera...')
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    setLiveSessionSummary(null)
    sessionStartedPerfRef.current = null
    resetLiveDedicatedSessionStats()

    try {
      if (!analyzerRef.current) {
        try {
          analyzerRef.current = createAnalyzer(exercise.slug)
        } catch (e: unknown) {
          setLoading(false)
          setLoadingMsg(null)
          setError(e instanceof Error ? e.message : 'Analyzer initialization failed')
          return
        }
      }
      configureAnalyzer(analyzerRef.current, exercise.slug, 'live', {
        tuningOverride: resolveAnalyzerTuning(exercise.slug, poseRuntimeRules, liveSquatTuning),
        analyzerFps: liveTargetFps
      })
      const provider = await getLiveProvider()
      cleanupRef.current = await startLiveDetectionSession({
        exerciseSlug: exercise.slug,
        provider,
        analyzer: analyzerRef.current,
        videoRef,
        canvasRef,
        stabilizerRef,
        distanceTrackerRef,
        fpsRef,
        lastProcessedTsRef,
        sessionStartedAtRef,
        sessionStartedPerfRef,
        previewScaleRef,
        drawModeRef,
        liveTargetFrameMs,
        issueFreqRef: liveIssueFreqRef,
        trackingQualitySamplesRef: liveTrackingQualitySamplesRef,
        timelineRowsRef: liveTimelineRowsRef,
        repFindingsRef: liveRepFindingsRef,
        lastRepCountRef: liveLastRepCountRef,
        analyzedFrameCountRef: liveAnalyzedFrameCountRef,
        onFeedback: setFeedback,
        onTracking: setTracking,
        onDistance: setDistance,
        onEffectiveFps: setEffectiveFps,
        onDetectionError: (e) => setError(e instanceof Error ? e.message : 'Live detection failed')
      })
      setRunning(true)
      setLoading(false)
      setLoadingMsg(null)
      setLiveSessionStatus('running')
    } catch (e: unknown) {
      setLoading(false)
      setLoadingMsg(null)
      setRunning(false)
      setLiveSessionStatus('idle')
      setError(e instanceof Error ? e.message : 'Unable to access the camera')
    }
  }

  function stopLive(reason: Exclude<LiveSessionEndReason, null> = 'manual') {
    const stopState = resolveStopLiveState({
      startedPerfAt: sessionStartedPerfRef.current,
      nowPerf: performance.now(),
      liveSessionLimitMs,
      liveSessionElapsedMs,
      reason
    })
    const snapshot = feedbackRef.current

    cleanupLiveMedia({ cleanupRef, videoRef })
    setRunning(false)
    setLoading(false)
    setLoadingMsg(null)
    setTracking(null)
    setDistance(null)
    setLiveSessionElapsedMs(stopState.elapsedMs)
    setLiveSessionStatus(stopState.status)
    setLiveSessionEndReason(stopState.endReason)
    setLiveSessionSummary(
      buildLiveSessionSummary({
        snapshot,
        elapsedMs: stopState.elapsedMs,
        exerciseSlug: exercise.slug,
        repFindings: liveRepFindingsRef.current,
        issueFreq: liveIssueFreqRef.current
      })
    )
    sessionStartedPerfRef.current = null
    if (reason === 'timeout') {
      setSaveTrainingMsg('Session reached the 2-minute limit and stopped automatically.')
    }
  }

  function resetLiveSession() {
    analyzerRef.current?.resetSession()
    resetLiveDedicatedSessionStats()
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    const resetState = resolveResetLiveState({
      running,
      nowIso: new Date().toISOString(),
      nowPerf: performance.now(),
      previousStartedAt: sessionStartedAtRef.current
    })
    sessionStartedAtRef.current = resetState.startedAt
    sessionStartedPerfRef.current = resetState.startedPerfAt
    setLiveSessionElapsedMs(0)
    setLiveSessionStatus(resetState.status)
    setLiveSessionEndReason(resetState.endReason)
    setLiveSessionSummary(null)
  }

  async function saveTrainingRecord() {
    const reps = feedback?.session.totalReps ?? 0
    const validationMsg = validateLiveTrainingSave(user, reps)
    if (validationMsg) {
      setSaveTrainingMsg(validationMsg)
      return
    }

    setSavingTraining(true)
    setSaveTrainingMsg(null)
    try {
      const startedAt = sessionStartedAtRef.current ?? new Date().toISOString()
      const payload = buildLiveTrainingPayload({
        startedAt,
        endedAt: new Date().toISOString(),
        exerciseType: exercise.exerciseType,
        exerciseDisplayName: exercise.displayName,
        reps,
        mainTipLabel: currentMainTip.label,
        report: humanizePoseReport(liveReport as never) as unknown as Record<string, unknown>,
        posePolicyVersion,
        buildTrainingRecordName
      })
      const session = await createPoseTraining(payload)
      setSaveTrainingMsg(`Saved training record #${session.id}`)
      setSavedLiveSessionId(session.id)
    } catch (e: unknown) {
      setSaveTrainingMsg(poseToolErrorMessage(e, POSE_TOOL_MESSAGES.liveTrainingSaveFailed))
    } finally {
      setSavingTraining(false)
    }
  }

  async function saveSquatTuningAsBackendDefault() {
    const guard = validateSquatTuningSave(exercise.slug)
    if (guard) return
    setSavingSquatTuningConfig(true)
    setSquatTuningConfigMsg(null)
    try {
      const saved = await updateSquatTuningConfig(buildSquatTuningSavePayload(liveSquatTuning))
      setLiveSquatTuning(saved.tuning)
      setSquatTuningConfigMsg(resolveSquatTuningSaveMessage(true))
    } catch (e: unknown) {
      setSquatTuningConfigMsg(resolveSquatTuningSaveMessage(false, e))
    } finally {
      setSavingSquatTuningConfig(false)
    }
  }

  const handleOfflineFileChange = useOfflineFileHandler({
    maxVideoBytes,
    offlineFileInputRef,
    offlineCanvasRef,
    offlineReplayDataRef,
    offlineReplayRafRef,
    previewUrlRef,
    setOfflineFile,
    setOfflineReport,
    setOfflineReportSessionId,
    setOfflineArchiveStatus,
    setOfflineLocalStatus,
    setOfflineRunStarted,
    setOfflineCompletedStep,
    setOfflineError,
    setOfflineStatusMsg,
    setOfflineProgress,
    setOfflineOverlayTone,
    setOfflineOverlayMessage,
    setOfflineOverlayReady,
    setOfflinePreviewUrl
  })

  const runOfflineAnalysis = useOfflinePoseAnalysis({
    offlineFile,
    posePolicy,
    offlineViewAngle,
    exercise: { id: exercise.id, slug: exercise.slug, displayName: exercise.displayName, exerciseType: exercise.exerciseType },
    liveSquatTuning,
    tempoFastThresholdSec,
    posePolicyVersion,
    poseRuntimeRules,
    user,
    offlineReplayDataRef,
    setOfflineBusy,
    setOfflineRunStarted,
    setOfflineCompletedStep,
    setOfflineError,
    setOfflineReport,
    setOfflineReportSessionId,
    setOfflineArchiveStatus,
    setOfflineLocalStatus,
    setOfflineStatusMsg,
    setOfflineProgress,
    setOfflineOverlayTone,
    setOfflineOverlayMessage,
    setOfflineOverlayReady
  })

  const { taskStatusText, taskStatusToneClass, analysisStarted, checklist } = buildOfflineTaskUi({
    offlineBusy,
    offlineLocalStatus,
    offlineRunStarted,
    offlineCompletedStep,
    offlineProgressStage: offlineProgress?.stage ?? null,
    hasOfflineReport: !!offlineReport,
    offlineArchiveStatus
  })
  const tutorialVideoSrc = getTutorialVideoSrc(exercise.slug, exercise.displayName)
  const teachingCopy = getPoseTeachingCopy(exercise.slug)

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Pose Tool</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span><Link to={buildPoseGuidePath(exercise.slug)}>{exercise.displayName}</Link></span>
                    <span>{mode === 'live' ? 'Live Coaching' : 'Video Analysis'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 pose-tool-page">
        <div className="page-container">
          <div className="pose-mode-switch mb-30">
            <button
              className={mode === 'live' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'}
              onClick={() => nav(buildPoseToolPath(exercise.slug))}
              type="button"
            >
              Live Coaching
            </button>
            <button
              className={mode === 'offline' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'}
              onClick={() => nav(buildPoseVideoPath(exercise.slug))}
              type="button"
            >
              Video Analysis
            </button>
            <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn pose-mode-switch__history">
              Training History
            </Link>
          </div>

          {mode === 'live' ? (
            <div className="pose-live-layout pose-live-shell pose-tool-live-grid">
              <PoseLiveModePanels
                exerciseDisplayName={exercise.displayName}
                liveSubtitle={exercise.liveSubtitle}
                liveStageTip={exercise.liveStageTip}
                secondaryMetricLabel={exercise.secondaryMetricLabel}
                secondaryMetricTip={exercise.secondaryMetricTip}
                teachingCopy={teachingCopy}
                tutorialVideoSrc={tutorialVideoSrc}
                running={running}
                loading={loading}
                loadingMsg={loadingMsg}
                error={error}
                liveSessionStatus={liveSessionStatus}
                liveSessionEndReason={liveSessionEndReason}
                liveSessionElapsedMs={liveSessionElapsedMs}
                liveSessionLimitMs={liveSessionLimitMs}
                liveSessionSummary={liveSessionSummary}
                effectiveFps={effectiveFps}
                tracking={tracking}
                feedback={feedback}
                rangeStatusText={rangeStatusText}
                displayMainTip={displayMainTip}
                drawMode={drawMode}
                previewScale={previewScale}
                savingTraining={savingTraining}
                saveTrainingMsg={saveTrainingMsg}
                videoRef={videoRef}
                canvasRef={canvasRef}
                onToggleLive={() => void (running ? stopLive() : startLive())}
                onResetLive={resetLiveSession}
                onSaveTraining={() => void saveTrainingRecord()}
                onDrawModeChange={setDrawMode}
                onPreviewScaleChange={setPreviewScale}
              />

            </div>
          ) : (
            <div className="pose-video-layout pose-tool-video-grid">
              <div className="pose-tool-video-col pose-tool-video-col-main">
                <PoseOfflineAnalysisPanel
                  exerciseDisplayName={exercise.displayName}
                  posePolicyVersion={posePolicyVersion}
                  localInferenceDefault={localInferenceDefault}
                  serverConsentRequired={serverConsentRequired}
                  offlineFile={offlineFile}
                  offlineBusy={offlineBusy}
                  offlinePreviewUrl={offlinePreviewUrl}
                  offlineOverlayReady={offlineOverlayReady}
                  offlineOverlayTone={offlineOverlayTone}
                  offlineOverlayMessage={offlineOverlayMessage}
                  offlineProgress={offlineProgress}
                  offlineStatusMsg={offlineStatusMsg}
                  offlineError={offlineError}
                  drawMode={drawMode}
                  offlineFileInputRef={offlineFileInputRef}
                  offlineVideoRef={offlineVideoRef}
                  offlineCanvasRef={offlineCanvasRef}
                  onChooseFile={() => offlineFileInputRef.current?.click()}
                  onFileChange={(file) => void handleOfflineFileChange(file)}
                  onAnalyze={() => void runOfflineAnalysis()}
                  onDrawModeChange={setDrawMode}
                />
              </div>

              <div className="pose-tool-video-col pose-tool-video-col-teaching">
                <PoseOfflineTeachingPanel
                  exerciseDisplayName={exercise.displayName}
                  teachingCopy={teachingCopy}
                  tutorialVideoSrc={tutorialVideoSrc}
                />
              </div>

              <div className="pose-tool-video-col pose-tool-video-col-report">
                <PoseOfflineReportPanel
                  taskStatusToneClass={taskStatusToneClass}
                  taskStatusText={taskStatusText}
                  offlineFileSizeMbText={offlineFile ? `${Math.round(offlineFile.size / 1024 / 1024)} MB` : 'Not selected'}
                  analysisStarted={analysisStarted}
                  checklist={checklist}
                  offlineReport={offlineReport}
                  reportContent={offlineReport ? <ReportVisualization report={offlineReport} /> : null}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}



