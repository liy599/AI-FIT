import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import {
  DistanceTracker,
  type DistanceState,
  LabelWithTip,
  MetricCard,
  MoveNetStabilizer,
  REALTIME_DEFAULT_SQUAT_TUNING,
  ReportVisualization,
  buildBentOverRowAlignedReport,
  buildBentOverRowVideoLiveStyleReport,
  buildPoseGuidePath,
  buildPoseHistoryPath,
  buildPoseToolPath,
  buildPoseVideoPath,
  buildPullupAlignedReport,
  buildPullupVideoLiveStyleReport,
  buildPushupAlignedReport,
  buildPushupVideoLiveStyleReport,
  buildSquatAlignedReport,
  buildSquatVideoLiveStyleReport,
  buildTrainingRecordName,
  buildLiveSuggestions,
  buildLateralRaiseAlignedReport,
  buildLateralRaiseVideoLiveStyleReport,
  collectLiveFrameIssueMessages,
  collectLiveIssueMessages,
  createAnalyzer,
  createBestRealtimePoseProvider,
  createPoseTraining,
  drawDistanceGuide,
  drawMidpointSkeleton,
  drawPoseJoints17,
  drawUpperLimbSkeleton,
  extractNativePoseFromVideoUrlWithMoveNet,
  formatDuration,
  getAnalyzerDefaults,
  getPoseExerciseBySlug,
  getRepsFromReport,
  getSessionComment,
  getSquatTuningConfig,
  getTopIssues,
  getTopRepIssuesFromFindings,
  getTopIssuesFromMessageFreq,
  humanizePoseReport,
  mapPoseFeedbackMessage,
  normalizeReportForArchive,
  pickLiveMainTip,
  prewarmMoveNet,
  poseTierLabel,
  requestCameraStream,
  toIssueCode,
  type MoveNetNativeFrame,
  type PoseAnalysisReport,
  type RealtimeAnalyzer,
  type RealtimeFeedback,
  type SquatRepFinding,
  type SquatTimelineRow,
  type SquatTuning,
  type TrackingState,
  updateSquatTuningConfig
} from '../features/pose'
import { resolvePoseToolMode } from '../features/pose/tool/mode'
import {
  buildOfflineOverlayFrames,
  drawCameraFrame
} from '../features/pose/tool/replay'
import { buildOfflineTaskUi, buildSideViewIndicator, getRangeStatusText, getTutorialVideoSrc } from '../features/pose/tool/ui'
import { getPoseTeachingCopy } from '../features/pose/tool/tutorial'
import { useOfflineFileHandler } from '../features/pose/tool/useOfflineFileHandler'
import { PoseOfflineReportPanel, PoseOfflineTeachingPanel } from '../features/pose/tool/PoseOfflinePanels'
import { useOfflinePoseAnalysis } from '../features/pose/tool/useOfflinePoseAnalysis'
import { useOfflineReplayOverlay } from '../features/pose/tool/useOfflineReplayOverlay'
import { useRealtimePoseProvider } from '../features/pose/tool/useRealtimePoseProvider'
import { usePoseRuntimePolicy } from '../features/pose/tool/usePoseRuntimePolicy'
import { useThrottledMainTip } from '../features/pose/tool/useThrottledMainTip'
import type {
  LiveSessionEndReason,
  LiveSessionStatus,
  LiveSessionSummary,
  OfflineOverlayFrame,
  OfflineOverlayTone,
  OfflineProgress,
  OfflineReplayData,
  PoseToolMode
} from '../features/pose/tool/types'

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
    exercise.slug === 'lateral-raise' || exercise.slug === 'pullup' ? 'front' : 'side'
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

  useEffect(() => {
    const runWarmup = () => {
      prewarmMoveNet('lightning').catch(() => {})
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(runWarmup)
      return () => {
        if ('cancelIdleCallback' in window) {
          ;(window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
        }
      }
    }
    const timer = globalThis.setTimeout(runWarmup, 300)
    return () => globalThis.clearTimeout(timer)
  }, [])

  const { posePolicy, liveTargetFps, liveTargetFrameMs, liveSessionLimitMs, maxVideoBytes } = usePoseRuntimePolicy(mode)
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
    let cancelled = false
    void (async () => {
      try {
        const cfg = await getSquatTuningConfig()
        if (cancelled) return
        if (cfg?.tuning) {
          setLiveSquatTuning((prev) => ({ ...prev, ...cfg.tuning }))
        }
      } catch {
        // Keep local defaults when backend config is unavailable.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exercise.slug])

  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    const v = videoRef.current
    const stream = v?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (v) v.srcObject = null
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
    const defaults = getAnalyzerDefaults(exercise.slug as never, 'live')
    if (exercise.slug === 'squat') analyzerRef.current.setTuning?.(liveSquatTuning)
    else if (defaults.tuning) analyzerRef.current.setTuning?.(defaults.tuning)
    if (defaults.tempo) analyzerRef.current.setTempo?.(defaults.tempo)
    analyzerRef.current.setAnalyzerFps?.(liveTargetFps)
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
    setOfflineViewAngle(exercise.slug === 'lateral-raise' || exercise.slug === 'pullup' ? 'front' : 'side')
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
      cleanupRef.current?.()
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
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
  const sideViewIndicator = useMemo(() => buildSideViewIndicator(exercise.slug, feedback?.offsetAngle), [exercise.slug, feedback?.offsetAngle])


  function resetLiveDedicatedSessionStats() {
    liveIssueFreqRef.current = new Map()
    liveTrackingQualitySamplesRef.current = []
    liveTimelineRowsRef.current = []
    liveRepFindingsRef.current = []
    liveLastRepCountRef.current = 0
    liveAnalyzedFrameCountRef.current = 0
  }

  const liveReport = useMemo(() => {
    if (exercise.slug === 'squat') {
      return buildSquatAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'side',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? liveTargetFps,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current
      })
    }
    if (exercise.slug === 'pullup') {
      return buildPullupAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'front',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? liveTargetFps,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current
      })
    }
    if (exercise.slug === 'lateral-raise') {
      return buildLateralRaiseAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'front',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? liveTargetFps,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current
      })
    }
    if (exercise.slug === 'pushup') {
      return buildPushupAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'side',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? liveTargetFps,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current
      })
    }
    if (exercise.slug === 'bent-over-row') {
      return buildBentOverRowAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'side',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? liveTargetFps,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current
      })
    }

    const summary = feedback
      ? `Live training: total ${feedback.session.totalReps}, correct ${feedback.session.correctReps}, accuracy ${feedback.session.accuracyPct}%`
      : 'No live training data yet'
    const issueMessages = collectLiveIssueMessages(feedback)
    const suggestions = buildLiveSuggestions(feedback, currentMainTip.label, exercise.slug)
    return humanizePoseReport(
      normalizeReportForArchive({
      version: 1,
      status: 'ok',
      tool: 'pose-live',
      generatedAt: new Date().toISOString(),
      summary,
      keyMetrics: {
        totalReps: feedback?.session.totalReps ?? 0,
        correctReps: feedback?.session.correctReps ?? 0,
        incorrectReps: feedback?.session.incorrectReps ?? 0,
        formAccuracyPct: feedback?.session.accuracyPct ?? 0
      },
      modelName: 'MoveNet Lightning',
      effectiveFps,
      repCount: feedback?.repCount ?? 0,
      correctCount: feedback?.correctCount ?? 0,
      incorrectCount: feedback?.incorrectCount ?? 0,
      kneeAngle: feedback?.kneeAngle ?? null,
      hipAngle: feedback?.hipAngle ?? null,
      torsoAngle: feedback?.torsoAngle ?? null,
      offsetAngle: feedback?.offsetAngle ?? null,
      trackingQuality: feedback?.trackingQuality ?? null,
      currentSuggestion: currentMainTip.label,
      warnings: feedback?.warnings ?? [],
      issues: issueMessages.map((message) => ({
        code: toIssueCode(message),
        severity: 'warning',
        message,
        atFrame: null
      })),
      suggestions
      }) as never
    )
  }, [currentMainTip.label, effectiveFps, exercise.displayName, exercise.slug, feedback, liveTargetFps])

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
      const defaults = getAnalyzerDefaults(exercise.slug as never, 'live')
      if (exercise.slug === 'squat') analyzerRef.current.setTuning?.(liveSquatTuning)
      else if (defaults.tuning) analyzerRef.current.setTuning?.(defaults.tuning)
      if (defaults.tempo) analyzerRef.current.setTempo?.(defaults.tempo)
      analyzerRef.current.setAnalyzerFps?.(liveTargetFps)
      if (!stabilizerRef.current) stabilizerRef.current = new MoveNetStabilizer(2500)
      if (!distanceTrackerRef.current) distanceTrackerRef.current = new DistanceTracker(5000)

      const provider = await getLiveProvider()
      const stream = await requestCameraStream({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: false
      })

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error('Preview area initialization failed')

      video.srcObject = stream
      await video.play()
      if (!video.videoWidth || !video.videoHeight) {
        await new Promise<void>((resolve) => {
          const done = () => resolve()
          video.addEventListener('loadedmetadata', done, { once: true })
          window.setTimeout(done, 400)
        })
      }
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720

      sessionStartedAtRef.current = new Date().toISOString()
      sessionStartedPerfRef.current = performance.now()
      fpsRef.current = { windowStart: performance.now(), frames: 0 }
      lastProcessedTsRef.current = 0
      setRunning(true)
      setLoading(false)
      setLoadingMsg(null)
      setLiveSessionStatus('running')

      let cancelled = false
      cleanupRef.current = () => {
        cancelled = true
      }

      const tick = async () => {
        if (cancelled || !provider || !videoRef.current || !canvasRef.current) return
        const frameTs = performance.now()
        if (frameTs - lastProcessedTsRef.current < liveTargetFrameMs) {
          requestAnimationFrame(() => void tick())
          return
        }
        lastProcessedTsRef.current = frameTs

        const videoEl = videoRef.current
        const canvasEl = canvasRef.current
        const ctx = canvasEl.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
        const viewport = drawCameraFrame(ctx, videoEl, canvasEl.width, canvasEl.height, previewScaleRef.current, true)

        try {
          const detected = await provider.detect(videoEl, frameTs)
          const nativeKeypoints = detected.nativeKeypoints
          const hasNative = !!nativeKeypoints && nativeKeypoints.length > 0
          if (hasNative && analyzerRef.current && stabilizerRef.current && distanceTrackerRef.current) {
            const nextFeedback = analyzerRef.current.analyzeNative(nativeKeypoints)
            setFeedback(nextFeedback)
            if (exercise.slug === 'squat' || exercise.slug === 'pullup' || exercise.slug === 'lateral-raise' || exercise.slug === 'bent-over-row') {
              liveAnalyzedFrameCountRef.current += 1
              if (Number.isFinite(nextFeedback.trackingQuality)) {
                liveTrackingQualitySamplesRef.current.push(nextFeedback.trackingQuality)
              }
              for (const message of collectLiveFrameIssueMessages(nextFeedback)) {
                const text = message.trim()
                if (!text) continue
                liveIssueFreqRef.current.set(text, (liveIssueFreqRef.current.get(text) ?? 0) + 1)
              }
              const startedPerf = sessionStartedPerfRef.current
              const tMs = startedPerf ? Math.max(0, Math.round(frameTs - startedPerf)) : Math.round(liveTimelineRowsRef.current.length * liveTargetFrameMs)
              liveTimelineRowsRef.current.push({
                frame: liveTimelineRowsRef.current.length,
                tMs,
                phase: nextFeedback.phase,
                trackingQuality: nextFeedback.trackingQuality,
                kneeAngleDeg: nextFeedback.kneeAngle,
                hipAngleDeg: nextFeedback.hipAngle,
                torsoFromVerticalDeg: nextFeedback.torsoAngle
              })
              if (nextFeedback.repCount > liveLastRepCountRef.current) {
                const result: SquatRepFinding['result'] =
                  nextFeedback.lastRepResult === 'correct' ? 'correct' : nextFeedback.lastRepResult === 'incorrect' ? 'incorrect' : 'invalid'
                const reasons = nextFeedback.lastRepReasonLabels.length > 0 ? [...nextFeedback.lastRepReasonLabels] : []
                const primaryIssue =
                  reasons[0] ??
                  nextFeedback.lastRepMessage ??
                  (result === 'correct' ? 'Rep passed quality check.' : 'Rep was counted but not valid for quality scoring.')
                for (let repNo = liveLastRepCountRef.current + 1; repNo <= nextFeedback.repCount; repNo++) {
                  liveRepFindingsRef.current.push({
                    repNumber: repNo,
                    result,
                    primaryIssue,
                    reasons,
                    atFrame: liveTimelineRowsRef.current.length - 1,
                    tMs
                  })
                }
                liveLastRepCountRef.current = nextFeedback.repCount
              }
            }

            const trackingState = stabilizerRef.current.ingest({ tMs: frameTs, keypoints: nativeKeypoints })
            setTracking(trackingState)

            const distanceState = distanceTrackerRef.current.ingest({ tMs: frameTs, keypoints: nativeKeypoints })
            setDistance(distanceState)

            const overlayColor = nextFeedback.issues.length > 0 ? 'bad' : nextFeedback.warnings.length > 0 ? 'warn' : 'ok'
            const activeDrawMode = drawModeRef.current
            if (trackingState && activeDrawMode === 'full17' && trackingState.joints2d.length > 0) {
              drawPoseJoints17(
                ctx,
                trackingState.joints2d,
                canvasEl.width,
                canvasEl.height,
                overlayColor,
                viewport ? { viewport, mirror: true } : { mirror: true }
              )
            } else if (trackingState && trackingState.joints2d.length > 0) {
              drawMidpointSkeleton(
                ctx,
                trackingState.joints2d,
                canvasEl.width,
                canvasEl.height,
                overlayColor,
                viewport ? { viewport, mirror: true } : { mirror: true }
              )
            }
            if (distanceState) {
              drawDistanceGuide(
                ctx,
                distanceState,
                canvasEl.width,
                canvasEl.height,
                viewport ? { viewport, mirror: true, showTarget: true } : { mirror: true, showTarget: true }
              )
            }
          } else {
            setTracking(null)
            setDistance(null)
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Live detection failed')
        }

        const bucket = fpsRef.current
        bucket.frames += 1
        if (frameTs - bucket.windowStart >= 1000) {
          setEffectiveFps(bucket.frames)
          fpsRef.current = { windowStart: frameTs, frames: 0 }
        }

        requestAnimationFrame(() => void tick())
      }

      void tick()
    } catch (e: unknown) {
      setLoading(false)
      setLoadingMsg(null)
      setRunning(false)
      setLiveSessionStatus('idle')
      setError(e instanceof Error ? e.message : 'Unable to access the camera')
    }
  }

  function stopLive(reason: Exclude<LiveSessionEndReason, null> = 'manual') {
    const startedAt = sessionStartedPerfRef.current
    const elapsedMs = startedAt ? Math.min(liveSessionLimitMs, Math.max(0, performance.now() - startedAt)) : liveSessionElapsedMs
    const snapshot = feedbackRef.current

    cleanupRef.current?.()
    cleanupRef.current = null
    const v = videoRef.current
    const stream = v?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (v) v.srcObject = null
    setRunning(false)
    setLoading(false)
    setLoadingMsg(null)
    setTracking(null)
    setDistance(null)
    setLiveSessionElapsedMs(elapsedMs)
    setLiveSessionStatus('ended')
    setLiveSessionEndReason(reason)
    const repLevelTopIssues = getTopRepIssuesFromFindings(liveRepFindingsRef.current)
    const frameLevelTopIssues = getTopIssuesFromMessageFreq(liveIssueFreqRef.current)
    const fallbackTopIssues =
      (snapshot?.session.incorrectReps ?? 0) > 0
        ? getTopIssues(snapshot)
        : frameLevelTopIssues.length > 0
          ? frameLevelTopIssues
          : []
    setLiveSessionSummary({
      durationSec: Math.round(elapsedMs / 1000),
      reps: snapshot?.session.totalReps ?? 0,
      correctReps: snapshot?.session.correctReps ?? 0,
      incorrectReps: snapshot?.session.incorrectReps ?? 0,
      accuracyPct: snapshot?.session.accuracyPct ?? 0,
      sessionComment: getSessionComment(snapshot?.session.accuracyPct ?? 0, snapshot?.session.totalReps ?? 0, exercise.slug),
      topIssues: repLevelTopIssues.length > 0 ? repLevelTopIssues : fallbackTopIssues
    })
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
    sessionStartedAtRef.current = running ? new Date().toISOString() : sessionStartedAtRef.current
    if (running) {
      sessionStartedPerfRef.current = performance.now()
      setLiveSessionElapsedMs(0)
      setLiveSessionStatus('running')
      setLiveSessionEndReason(null)
    } else {
      sessionStartedPerfRef.current = null
      setLiveSessionElapsedMs(0)
      setLiveSessionStatus('idle')
      setLiveSessionEndReason(null)
    }
    setLiveSessionSummary(null)
  }

  async function saveTrainingRecord() {
    if (!user) {
      setSaveTrainingMsg('Please log in to save training records.')
      return
    }
    const reps = feedback?.session.totalReps ?? 0
    if (reps <= 0) {
      setSaveTrainingMsg('No reps to save yet.')
      return
    }

    setSavingTraining(true)
    setSaveTrainingMsg(null)
    try {
      const startedAt = sessionStartedAtRef.current ?? new Date().toISOString()
      const session = await createPoseTraining({
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        exercise_type: exercise.exerciseType,
        note: buildTrainingRecordName({ startedAt, exerciseName: exercise.displayName }),
        sets: [{ reps, note: currentMainTip.label }],
        report: humanizePoseReport(liveReport as never) as unknown as Record<string, unknown>
      })
      setSaveTrainingMsg(`Saved training record #${session.id}`)
      setSavedLiveSessionId(session.id)
    } catch (e: unknown) {
      setSaveTrainingMsg(e instanceof Error ? e.message : 'Failed to save training record')
    } finally {
      setSavingTraining(false)
    }
  }

  async function saveSquatTuningAsBackendDefault() {
    if (exercise.slug !== 'squat') return
    setSavingSquatTuningConfig(true)
    setSquatTuningConfigMsg(null)
    try {
      const saved = await updateSquatTuningConfig(liveSquatTuning)
      setLiveSquatTuning(saved.tuning)
      setSquatTuningConfigMsg('Saved to backend defaults. It will persist across refresh and restart.')
    } catch (e: unknown) {
      setSquatTuningConfigMsg(e instanceof Error ? e.message : 'Failed to save backend defaults.')
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
    setOfflineOverlayReady,
    extractNativePoseFromVideoUrlWithMoveNet,
    buildSquatVideoLiveStyleReport,
    buildPullupVideoLiveStyleReport,
    buildLateralRaiseVideoLiveStyleReport,
    buildBentOverRowVideoLiveStyleReport,
    buildPushupVideoLiveStyleReport,
    humanizePoseReport,
    buildOfflineOverlayFrames,
    createPoseTraining,
    getRepsFromReport,
    buildTrainingRecordName
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
              <div className="pose-tool-live-col pose-tool-live-col-guide">
                <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card pose-live-guide-card">
                  <div className="pose-panel-head">
                    <span className="pose-panel-kicker">Guide</span>
                    <h4 className="pose-panel-title">{exercise.displayName} Quick Guide</h4>
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
                    <h4 className="pose-panel-title">{exercise.displayName} Teaching Video</h4>
                  </div>

                  <div className="pose-tip-card pose-tip-card-light pose-live-section">
                    {teachingCopy ? (
                      <>
                        <div className="pose-teaching-angle-box pose-teaching-angle-box-sticky">
                          <span className="pose-teaching-angle-label">Camera angle:</span> {teachingCopy.cameraAngle}
                        </div>
                        <details className="pose-guide-details pose-guide-details-top">
                          <summary className="pose-guide-details__summary">Tips</summary>
                          <ul className="pose-detail-list pose-detail-list-light pose-guide-details-list">
                            {teachingCopy.tipsLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </details>
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
              </div>

              <div className="pose-tool-live-col pose-tool-live-col-camera">
                <div className="cl_blog-widget mb-30 pose-camera-panel h-full w-full pose-live-camera-card">
                  <div className="pose-tool-head">
                    <div>
                    <h4 className="cl_blog-widget-title mb-15">{exercise.displayName} - Realtime Camera</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">{exercise.liveSubtitle}</p>
                    </div>
                    <div className="pose-tool-actions">
                      <button className="cl_theme-btn" onClick={() => void (running ? stopLive() : startLive())} type="button">
                        {running ? 'Stop' : loading ? 'Loading...' : 'Start'}
                      </button>
                      <button className="pose-tool-ghost-btn pose-tool-light-btn" onClick={resetLiveSession} type="button">
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="pose-tip-card pose-tip-card-light pose-live-session-card">
                    <div className="pose-session-status-head">
                      <strong>
                        {liveSessionStatus === 'running'
                          ? 'Started: Live coaching is in progress'
                          : liveSessionStatus === 'ended'
                            ? 'Terminated: Live coaching has ended'
                            : 'Ready: Click Start to begin live coaching'}
                      </strong>
                      <span className={`pose-session-status-pill pose-session-status-pill-${liveSessionStatus}`}>
                        {liveSessionStatus === 'running' ? 'STARTED' : liveSessionStatus === 'ended' ? 'TERMINATED' : 'IDLE'}
                      </span>
                    </div>
                    <progress
                      className={`pose-session-progress ${liveSessionStatus === 'ended' ? 'is-ended' : ''}`}
                      max={100}
                      value={Math.min(100, (liveSessionElapsedMs / liveSessionLimitMs) * 100)}
                    />
                    <div className="pose-session-progress-meta">
                      <span>Time Progress</span>
                      <span>{formatDuration(liveSessionElapsedMs)} / 02:00</span>
                    </div>
                    <div className="pose-live-metrics-line pose-live-metrics-line-top">
                      <span title="AI model used for real-time pose estimation.">AI Model: MoveNet</span>
                      <span title="Frames processed per second. Higher means smoother feedback.">Speed (FPS): {effectiveFps ?? '-'}</span>
                      <span title="Current pose keypoint detection stability.">Detection Status: {tracking?.status ?? '-'}</span>
                      <span title={exercise.liveStageTip}>Movement Stage: {feedback?.phase ?? '-'}</span>
                    </div>
                  </div>

                  <div
                    className="pose-stage pose-stage-landscape"
                  >
                    <video ref={videoRef} autoPlay playsInline muted className="pose-stage-media pose-stage-video-hidden" />
                    <canvas ref={canvasRef} className="pose-stage-media pose-stage-canvas" />
                    {!running ? <div className="pose-stage-overlay">{loadingMsg ?? 'Click Start to begin real-time pose detection'}</div> : null}
                  </div>

                  <div className="pose-camera-toolbar pose-camera-toolbar-compact">
                    <div className="pose-camera-toolbar__group">
                      <span className="pose-camera-toolbar__label">Overlay</span>
                      <button
                        className={drawMode === 'full17' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                        onClick={() => setDrawMode('full17')}
                        type="button"
                      >
                        Full Point
                      </button>
                      <button
                        className={drawMode === 'midline' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                        onClick={() => setDrawMode('midline')}
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
                        value={previewScale}
                        onChange={(e) => setPreviewScale(Number(e.target.value))}
                      />
                      <strong>{Math.round(previewScale * 100)}%</strong>
                    </label>
                  </div>

                  {error ? <div className="pose-error-box">{error}</div> : null}
                </div>
              </div>

              <div className="pose-tool-live-col pose-tool-live-col-feedback">
                {liveSessionStatus === 'ended' && liveSessionSummary ? (
                  <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card">
                    <div className="pose-panel-head">
                      <span className="pose-panel-kicker">Session Closed</span>
                      <h4 className="pose-panel-title">Training Summary</h4>
                      <p className="pose-panel-subtitle">{liveSessionEndReason === 'timeout' ? 'Auto-ended at 2-minute limit' : 'Ended manually by user'}</p>
                    </div>
                    <ul className="pose-detail-list pose-detail-list-light pose-live-summary-list pose-kv-grid">
                      <li className="pose-kv-item pose-kv-item-wide">
                        <span className="pose-kv-label">Session</span>
                        <strong className="pose-kv-value">{liveSessionEndReason === 'timeout' ? 'Ended by 2-minute limit' : 'Stopped by user'}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label" title="Total elapsed live session time.">Duration</span>
                        <strong className="pose-kv-value">{formatDuration(liveSessionElapsedMs)}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label" title="All completed reps, including invalid reps.">Total Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.reps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label" title="Assessed reps judged as correct form.">Correct Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.correctReps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label" title="Assessed reps judged as incorrect form.">Incorrect Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.incorrectReps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label" title="Correct / (Correct + Incorrect), excludes invalid reps.">Accuracy</span>
                        <strong className="pose-kv-value">{liveSessionSummary.accuracyPct}%</strong>
                      </li>
                    </ul>
                    <div className="pose-tip-card pose-tip-card-light pose-live-section">
                      <h6 className="sub-title mb-15 pose-section-title">Session Insight</h6>
                      <p>{liveSessionSummary.sessionComment}</p>
                    </div>
                    {liveSessionSummary.topIssues.length > 0 ? (
                      <div className="pose-tip-card pose-tip-card-light pose-live-section">
                        <h6 className="sub-title mb-15 pose-section-title">Top Issues</h6>
                        <ul className="pose-detail-list pose-detail-list-light">
                          {liveSessionSummary.topIssues.map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="pose-export-row">
                      <button className="pose-tool-ghost-btn pose-tool-light-btn" disabled={savingTraining} onClick={() => void saveTrainingRecord()} type="button">
                        {savingTraining ? 'Saving...' : 'Save Training'}
                      </button>
                    </div>
                    {saveTrainingMsg ? <div className="pose-inline-note">{saveTrainingMsg}</div> : null}
                  </div>
                ) : (
                  <div className="cl_blog-widget mb-30 pose-live-feedback h-full w-full pose-live-right-card">
                    <div className="pose-panel-head">
                      <span className="pose-panel-kicker">In Session</span>
                      <h4 className="pose-panel-title">Live Feedback</h4>
                      <p className="pose-panel-subtitle">Real-time form diagnostics and coaching cues</p>
                    </div>
                    <div className="pose-kpi-grid pose-kpi-grid-light">
                      <MetricCard label={<LabelWithTip label="Total Reps" tip="All completed reps, including reps that were not assessed due to view/quality limits." />} value={feedback?.repCount ?? 0} />
                      <MetricCard label={<LabelWithTip label="Effective Reps" tip="Reps that were fully assessed and judged as correct or incorrect." />} value={(feedback?.correctCount ?? 0) + (feedback?.incorrectCount ?? 0)} />
                      <MetricCard label={<LabelWithTip label="Invalid Reps" tip="Completed reps excluded from validity scoring (for example unstable side view or incomplete keypoints)." />} value={feedback?.session.unassessedReps ?? Math.max(0, (feedback?.repCount ?? 0) - ((feedback?.correctCount ?? 0) + (feedback?.incorrectCount ?? 0)))} />
                      <MetricCard label={<LabelWithTip label="Form Accuracy" tip="Accuracy among assessed reps only: correct / (correct + incorrect)." />} value={feedback?.session.accuracyPct ?? 0} unit="%" />
                      <MetricCard label={<LabelWithTip label={exercise.secondaryMetricLabel} tip={exercise.secondaryMetricTip} />} value={feedback?.kneeAngle ?? '-'} unit={feedback?.kneeAngle ? '°' : ''} />
                      <MetricCard label={<LabelWithTip label="Hip Bend" tip="Estimated hip joint angle during your movement." />} value={feedback?.hipAngle ?? '-'} unit={feedback?.hipAngle ? '°' : ''} />
                      <MetricCard label={<LabelWithTip label="Torso Lean" tip="Estimated torso angle relative to upright posture." />} value={feedback?.torsoAngle ?? '-'} unit={feedback?.torsoAngle ? '°' : ''} />
                    </div>

                    <div className="pose-tip-card pose-tip-card-light pose-live-section pose-live-section-split">
                      <div className="pose-live-tip-head">
                        <h6 className="sub-title mb-15 pose-section-title pose-section-title-compact">
                          Coaching Tip
                        </h6>
                        <span className={`pose-tier-pill pose-tier-${displayMainTip.tier}`}>{poseTierLabel(displayMainTip.tier)}</span>
                      </div>
                      <p className="pose-live-coaching-copy pose-live-coaching-copy-fill">{displayMainTip.label}</p>
                    </div>

                    <div className="pose-tip-card pose-tip-card-light pose-live-section">
                      <h6 className="sub-title mb-15 pose-section-title">Camera & Validity</h6>
                      <ul className="pose-detail-list pose-detail-list-light pose-kv-grid pose-status-kv-grid">
                        <li className="pose-kv-item pose-kv-item-wide">
                          <span className="pose-kv-label" title="Whether your camera distance is suitable for stable full-body detection.">Camera Distance</span>
                          <strong className="pose-kv-value">{rangeStatusText}</strong>
                        </li>
                        <li className="pose-kv-item">
                          <span className="pose-kv-label" title="Confidence and stability of keypoint tracking.">Detection Quality</span>
                          <strong className="pose-kv-value">{feedback ? `${Math.round(feedback.trackingQuality * 100)}%` : '-'}</strong>
                        </li>
                        <li className="pose-kv-item">
                          <span className="pose-kv-label" title="Result of your most recent completed rep.">Last Rep Result</span>
                          <strong className="pose-kv-value">{feedback?.lastRepResult ?? '-'}</strong>
                        </li>
                      </ul>
                    </div>


                    {saveTrainingMsg ? <div className="pose-inline-note">{saveTrainingMsg}</div> : null}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pose-video-layout pose-tool-video-grid">
              <div className="pose-tool-video-col pose-tool-video-col-main">
                <div className="cl_blog-widget mb-30 h-full w-full pose-video-analysis-card">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">{exercise.displayName} - Video Analysis</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">
                        Local mode (privacy-first): pose extraction and analysis run in your browser. Video files are not uploaded.
                      </p>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">
                        Limit: 2 minutes. If your video is longer than 2 minutes, only the first 2 minutes will be analyzed.
                      </p>
                    </div>
                  </div>

                <div className="pose-form-grid pose-form-grid-single">
                    <div className="pose-inline-note pose-inline-note-top">
                      Local mode keeps video processing on this device.
                    </div>
                    <label className="pose-form-field">
                      <span>Video File</span>
                      <input
                        ref={offlineFileInputRef}
                        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                        onChange={(e) => void handleOfflineFileChange(e.target.files?.[0] ?? null)}
                        type="file"
                        className="pose-file-input-hidden"
                      />
                      <div className="pose-file-picker">
                        <button
                          type="button"
                          className="pose-tool-ghost-btn pose-tool-light-btn"
                          onClick={() => offlineFileInputRef.current?.click()}
                        >
                          Choose Video
                        </button>
                        <span className="pose-file-picker__name">{offlineFile ? offlineFile.name : 'No file selected'}</span>
                      </div>
                    </label>
                  </div>

                  <div className="pose-export-row">
                    <button className="cl_theme-btn" disabled={offlineBusy} onClick={() => void runOfflineAnalysis()} type="button">
                      {offlineBusy ? 'Analyzing...' : 'Analyze Locally'}
                    </button>
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
                              {offlineOverlayTone.toUpperCase()}
                            </span>
                            <span className="pose-video-preview__message">
                              {offlineOverlayMessage ?? (offlineOverlayTone === 'ok' ? 'Good form' : '')}
                            </span>
                          </>
                        ) : (
                          <span className="pose-video-preview__message pose-video-preview__message-muted">
                            {offlineBusy ? 'Analyzing video... Overlay will be available after completion.' : 'Run analysis to enable replay overlay.'}
                          </span>
                        )}
                      </div>
                      <div className="pose-camera-toolbar pose-camera-toolbar-compact pose-camera-toolbar-offline">
                        <div className="pose-camera-toolbar__group">
                          <span className="pose-camera-toolbar__label">Overlay</span>
                          <button
                            className={drawMode === 'full17' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                            onClick={() => setDrawMode('full17')}
                            type="button"
                          >
                            Full Point
                          </button>
                          <button
                            className={drawMode === 'midline' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                            onClick={() => setDrawMode('midline')}
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
                      <span>
                        {offlineProgress.processed}/{offlineProgress.total}
                      </span>
                    </div>
                  ) : null}

                  {offlineStatusMsg ? <div className="pose-inline-note">{offlineStatusMsg}</div> : null}
                  {offlineError ? <div className="pose-error-box pose-error-box-light">{offlineError}</div> : null}
                </div>
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



