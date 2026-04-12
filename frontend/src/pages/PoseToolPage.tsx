import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import { drawDistanceGuide, drawMidpointSkeleton, drawUpperLimbSkeleton } from '../lib/pose/draw'
import { DistanceTracker, type DistanceState } from '../lib/pose/distanceTracker'
import { buildPoseGuidePath, buildPoseHistoryPath, buildPoseReportPath, getPoseExerciseBySlug } from '../lib/pose/exercises'
import { buildTrainingRecordName } from '../lib/pose/trainingName'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../lib/pose/livePoseProvider'
import { extractPose33FromVideoUrl } from '../lib/pose/mediapipePose'
import { extractPose33FromVideoUrlWithMoveNet } from '../lib/pose/movenetPose'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type TrackingState } from '../lib/pose/movenetTracker'
import { type PoseAnalysisReport } from '../lib/pose/report'
import { type RealtimeFeedback } from '../lib/pose/realtimeSquat'
import { createPoseTraining } from '../lib/poseApi'
import { normalizeReportForArchive } from '../lib/report/unified'
import { requestCameraStream } from '../lib/media'
import {
  buildLiveSuggestions,
  buildPushupAlignedReport,
  buildPushupVideoLiveStyleReport,
  buildBenchPressVideoLiveStyleReport,
  buildSquatAlignedReport,
  buildSquatVideoLiveStyleReport,
  collectLiveFrameIssueMessages,
  collectLiveIssueMessages,
  createAnalyzer,
  evaluateRangeCheck,
  formatDuration,
  getRepsFromReport,
  getSessionComment,
  getTopIssues,
  toIssueCode,
  type RealtimeAnalyzer,
  type SquatTimelineRow
} from './poseTool/poseToolHelpers'
import { LabelWithTip, MetricCard, MetricCardPlaceholder, ReportVisualization } from './poseTool/PoseToolWidgets'

const LIVE_TARGET_FPS = 24
const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const LIVE_SESSION_LIMIT_MS = 2 * 60 * 1000
const OFFLINE_DEDICATED_REPLAY_ACTIONS = new Set(['squat', 'pushup', 'bench-press'])

type Mode = 'live' | 'offline'
type OfflineProgress = { stage: string; processed: number; total: number } | null
type LiveSessionStatus = 'idle' | 'running' | 'ended'
type LiveSessionEndReason = 'manual' | 'timeout' | null
type LiveSessionSummary = {
  durationSec: number
  reps: number
  correctReps: number
  incorrectReps: number
  accuracyPct: number
  sessionComment: string
  topIssues: string[]
}
export default function PoseToolPage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('live')

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
  const previewMirrorRef = useRef(true)
  const offlineFileInputRef = useRef<HTMLInputElement | null>(null)
  const feedbackRef = useRef<RealtimeFeedback | null>(null)
  const liveProviderRef = useRef<RealtimePoseProvider | null>(null)
  const liveProviderPromiseRef = useRef<Promise<RealtimePoseProvider> | null>(null)
  const liveIssueFreqRef = useRef<Map<string, number>>(new Map())
  const liveTrackingQualitySamplesRef = useRef<number[]>([])
  const liveTimelineRowsRef = useRef<SquatTimelineRow[]>([])
  const liveAnalyzedFrameCountRef = useRef(0)

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null)
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [distance, setDistance] = useState<DistanceState | null>(null)
  const [effectiveFps, setEffectiveFps] = useState<number | null>(null)
  const [savingTraining, setSavingTraining] = useState(false)
  const [saveTrainingMsg, setSaveTrainingMsg] = useState<string | null>(null)
  const [savedLiveSessionId, setSavedLiveSessionId] = useState<number | null>(null)
  const [previewScale, setPreviewScale] = useState(0.78)
  const [previewMirror, setPreviewMirror] = useState(true)
  const [liveSessionStatus, setLiveSessionStatus] = useState<LiveSessionStatus>('idle')
  const [liveSessionEndReason, setLiveSessionEndReason] = useState<LiveSessionEndReason>(null)
  const [liveSessionElapsedMs, setLiveSessionElapsedMs] = useState(0)
  const [liveSessionSummary, setLiveSessionSummary] = useState<LiveSessionSummary | null>(null)

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

  useEffect(() => {
    previewScaleRef.current = previewScale
  }, [previewScale])

  useEffect(() => {
    previewMirrorRef.current = previewMirror
  }, [previewMirror])

  useEffect(() => {
    feedbackRef.current = feedback
  }, [feedback])

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

    analyzerRef.current = createAnalyzer(exercise.slug)
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
    liveIssueFreqRef.current = new Map()
    liveTrackingQualitySamplesRef.current = []
    liveTimelineRowsRef.current = []
    liveAnalyzedFrameCountRef.current = 0
  }, [exercise.slug])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const startedAt = sessionStartedPerfRef.current
      if (!startedAt) return
      const elapsed = Math.min(LIVE_SESSION_LIMIT_MS, Math.max(0, performance.now() - startedAt))
      setLiveSessionElapsedMs(elapsed)
      if (elapsed >= LIVE_SESSION_LIMIT_MS) {
        stopLive('timeout')
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      liveProviderRef.current?.close()
      liveProviderRef.current = null
      liveProviderPromiseRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!liveProviderRef.current && !liveProviderPromiseRef.current) {
      const preload = createBestRealtimePoseProvider()
        .then((provider) => {
          if (!active) {
            provider.close()
            return provider
          }
          liveProviderRef.current = provider
          return provider
        })
      liveProviderPromiseRef.current = preload
      void preload.catch(() => {
          liveProviderPromiseRef.current = null
        })
    }
    return () => {
      active = false
    }
  }, [])

  const currentSuggestion = useMemo(() => {
    if (!feedback) return 'Start the camera to receive live form coaching.'
    return (
      feedback.issues[0]?.message ??
      feedback.warnings[0] ??
      feedback.lastRepMessage ??
      (exercise.slug === 'lateral-raise'
        ? 'Move both arms together, keep shoulders down, and avoid torso swing.'
        : exercise.slug === 'pushup'
          ? 'Brace your core, keep your body line straight, and lower under control.'
          : exercise.slug === 'pullup'
            ? 'Pull smoothly, avoid swinging, and lower under control.'
            : exercise.slug === 'bench-press'
              ? 'Lower under control, keep wrists stacked, and press in a smooth path.'
        : 'Keep a steady tempo and align your knees with your toes.')
    )
  }, [exercise.slug, feedback])

  const rangeCheck = useMemo(() => evaluateRangeCheck(feedback, exercise.slug), [exercise.slug, feedback])

  const rangeStatusText = useMemo(() => {
    if (!distance) return 'Waiting for detection'
    if (distance.status === 'calibrating') return 'Calibrating distance'
    if (distance.status === 'lost') return 'Stable body not detected'
    if (distance.label === 'too_close') return 'Too close'
    if (distance.label === 'too_far') return 'Too far'
    return 'Distance OK'
  }, [distance])

  function resetLiveDedicatedSessionStats() {
    liveIssueFreqRef.current = new Map()
    liveTrackingQualitySamplesRef.current = []
    liveTimelineRowsRef.current = []
    liveAnalyzedFrameCountRef.current = 0
  }

  const liveReport = useMemo(() => {
    if (exercise.slug === 'squat') {
      return buildSquatAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'unknown',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? LIVE_TARGET_FPS,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current
      })
    }
    if (exercise.slug === 'pushup') {
      return buildPushupAlignedReport({
        source: 'live',
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        viewAngle: 'unknown',
        exercise: { id: exercise.slug, name: exercise.displayName },
        video: null,
        fps: effectiveFps ?? LIVE_TARGET_FPS,
        lastFeedback: feedback,
        messageFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current
      })
    }

    const summary = feedback
      ? `Live training: total ${feedback.session.totalReps}, correct ${feedback.session.correctReps}, accuracy ${feedback.session.accuracyPct}%`
      : 'No live training data yet'
    const issueMessages = collectLiveIssueMessages(feedback)
    const suggestions = buildLiveSuggestions(feedback, currentSuggestion, exercise.slug)
    return normalizeReportForArchive({
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
      currentSuggestion,
      warnings: feedback?.warnings ?? [],
      issues: issueMessages.map((message) => ({
        code: toIssueCode(message),
        severity: 'warning',
        message,
        atFrame: null
      })),
      suggestions
    })
  }, [currentSuggestion, effectiveFps, exercise.displayName, exercise.slug, feedback])

  async function getLiveProvider() {
    if (liveProviderRef.current) return liveProviderRef.current
    if (!liveProviderPromiseRef.current) {
      liveProviderPromiseRef.current = createBestRealtimePoseProvider()
        .then((provider) => {
          liveProviderRef.current = provider
          return provider
        })
        .catch((e) => {
          liveProviderPromiseRef.current = null
          throw e
        })
    }
    return liveProviderPromiseRef.current
  }

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
      if (!analyzerRef.current) analyzerRef.current = createAnalyzer(exercise.slug)
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
        if (frameTs - lastProcessedTsRef.current < LIVE_TARGET_FRAME_MS) {
          requestAnimationFrame(() => void tick())
          return
        }
        lastProcessedTsRef.current = frameTs

        const videoEl = videoRef.current
        const canvasEl = canvasRef.current
        const ctx = canvasEl.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
        const viewport = drawCameraFrame(ctx, videoEl, canvasEl.width, canvasEl.height, previewScaleRef.current, previewMirrorRef.current)

        try {
          const detected = await provider.detect(videoEl, frameTs)
          const landmarks = detected.landmarks
          if (landmarks && analyzerRef.current && stabilizerRef.current && distanceTrackerRef.current) {
            const nextFeedback = analyzerRef.current.analyze(landmarks)
            setFeedback(nextFeedback)
            if (exercise.slug === 'squat' || exercise.slug === 'pushup') {
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
              const tMs = startedPerf ? Math.max(0, Math.round(frameTs - startedPerf)) : Math.round(liveTimelineRowsRef.current.length * LIVE_TARGET_FRAME_MS)
              liveTimelineRowsRef.current.push({
                frame: liveTimelineRowsRef.current.length,
                tMs,
                phase: nextFeedback.phase,
                trackingQuality: nextFeedback.trackingQuality,
                kneeAngleDeg: nextFeedback.kneeAngle,
                hipAngleDeg: nextFeedback.hipAngle,
                torsoFromVerticalDeg: nextFeedback.torsoAngle
              })
            }

            const trackingState = stabilizerRef.current.ingest(mediapipeToMoveNetFrame(landmarks, frameTs))
            setTracking(trackingState)

            const distanceState = distanceTrackerRef.current.ingest({
              tMs: frameTs,
              landmarks,
              worldLandmarks: detected.worldLandmarks
            })
            setDistance(distanceState)

            if (trackingState.joints2d.length > 0) {
              drawMidpointSkeleton(
                ctx,
                trackingState.joints2d,
                canvasEl.width,
                canvasEl.height,
                nextFeedback.issues.length > 0 ? 'bad' : 'ok',
                viewport
                  ? { viewport, mirror: previewMirrorRef.current }
                  : { mirror: previewMirrorRef.current }
              )
              if (exercise.slug === 'bench-press') {
                drawUpperLimbSkeleton(
                  ctx,
                  trackingState.joints2d,
                  canvasEl.width,
                  canvasEl.height,
                  nextFeedback.issues.length > 0 ? 'bad' : 'ok',
                  viewport
                    ? { viewport, mirror: previewMirrorRef.current }
                    : { mirror: previewMirrorRef.current }
                )
              }
            }
            drawDistanceGuide(
              ctx,
              distanceState,
              canvasEl.width,
              canvasEl.height,
              viewport
                ? { viewport, mirror: previewMirrorRef.current }
                : { mirror: previewMirrorRef.current }
            )
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
    const elapsedMs = startedAt ? Math.min(LIVE_SESSION_LIMIT_MS, Math.max(0, performance.now() - startedAt)) : liveSessionElapsedMs
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
    setLiveSessionSummary({
      durationSec: Math.round(elapsedMs / 1000),
      reps: snapshot?.session.totalReps ?? 0,
      correctReps: snapshot?.session.correctReps ?? 0,
      incorrectReps: snapshot?.session.incorrectReps ?? 0,
      accuracyPct: snapshot?.session.accuracyPct ?? 0,
      sessionComment: getSessionComment(snapshot?.session.accuracyPct ?? 0, snapshot?.session.totalReps ?? 0, exercise.slug),
      topIssues: getTopIssues(snapshot)
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

  function recalibrateDistance() {
    if (!distanceTrackerRef.current) return
    distanceTrackerRef.current.recalibrate(performance.now())
    setDistance(null)
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
        sets: [{ reps, note: currentSuggestion }],
        report: liveReport as Record<string, unknown>
      })
      setSaveTrainingMsg(`Saved training record #${session.id}`)
      setSavedLiveSessionId(session.id)
    } catch (e: unknown) {
      setSaveTrainingMsg(e instanceof Error ? e.message : 'Failed to save training record')
    } finally {
      setSavingTraining(false)
    }
  }

  function handleOfflineFileChange(file: File | null) {
    setOfflineFile(file)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineLocalStatus('idle')
    setOfflineRunStarted(false)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineStatusMsg(null)
    setOfflineProgress(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    if (!file) {
      setOfflinePreviewUrl(null)
      return
    }
    const nextUrl = URL.createObjectURL(file)
    previewUrlRef.current = nextUrl
    setOfflinePreviewUrl(nextUrl)
  }

  async function runOfflineAnalysis() {
    if (!offlineFile) {
      setOfflineError('Please choose a video file first.')
      return
    }
    if (offlineFile.size > MAX_VIDEO_BYTES) {
      setOfflineError('Video exceeds the 80MB limit. Please compress it and try again.')
      return
    }
    if (!OFFLINE_DEDICATED_REPLAY_ACTIONS.has(exercise.slug)) {
      setOfflineError(
        `Offline analysis for "${exercise.displayName}" is disabled until a dedicated replay analyzer and report builder are implemented.`
      )
      return
    }

    setOfflineBusy(true)
    setOfflineRunStarted(true)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineLocalStatus('running')
    setOfflineStatusMsg(null)
    setOfflineProgress({ stage: 'Preparing local video', processed: 0, total: 1 })

    let localObjectUrl: string | null = null
    try {
      localObjectUrl = URL.createObjectURL(offlineFile)
      setOfflineCompletedStep(1)
      setOfflineStatusMsg('Local video ready. Extracting pose keypoints...')
      setOfflineProgress({ stage: 'Preparing local video', processed: 1, total: 1 })

      const effectiveViewAngle: 'unknown' | 'front' | 'side' | 'back' =
        exercise.slug === 'squat' || exercise.slug === 'pushup' || exercise.slug === 'pullup' || exercise.slug === 'bench-press'
          ? 'side'
          : offlineViewAngle
      const localVideoMeta = {
        id: `local-${Date.now()}`,
        originalName: offlineFile.name,
        mimeType: offlineFile.type || 'video/mp4',
        sizeBytes: offlineFile.size
      }

      const extracted =
        exercise.slug === 'squat'
          ? await extractPose33FromVideoUrlWithMoveNet(localObjectUrl, {
              onProgress: (p) => {
                setOfflineProgress({
                  stage: p.stage === 'loading' ? 'Loading MoveNet model' : 'Extracting pose keypoints',
                  processed: p.processed,
                  total: p.total
                })
              }
            })
          : await extractPose33FromVideoUrl(localObjectUrl, {
              onProgress: (p) => {
                setOfflineProgress({
                  stage: p.stage === 'loading' ? 'Loading MediaPipe model' : 'Extracting pose keypoints',
                  processed: p.processed,
                  total: p.total
                })
              }
            })
      URL.revokeObjectURL(localObjectUrl)
      localObjectUrl = null
      setOfflineCompletedStep(2)

      const taskId = `local-${Date.now()}`
      const report =
        exercise.slug === 'squat'
          ? buildSquatVideoLiveStyleReport({
              taskId,
              viewAngle: effectiveViewAngle,
              exercise: { id: exercise.id, name: exercise.exerciseType },
              video: localVideoMeta,
              fps: extracted.fps,
              frames: extracted.frames,
              onProgress: (processed, total) => {
                setOfflineProgress({ stage: 'Replaying real-time squat analyzer', processed, total })
              }
            })
          : buildPushupVideoLiveStyleReport({
              taskId,
              viewAngle: effectiveViewAngle,
              exercise: { id: exercise.id, name: exercise.exerciseType },
              video: localVideoMeta,
              fps: extracted.fps,
              frames: extracted.frames,
              onProgress: (processed, total) => {
                setOfflineProgress({ stage: 'Replaying real-time push-up analyzer', processed, total })
              }
            })
      setOfflineCompletedStep(3)

      setOfflineProgress({ stage: 'Finalizing local report', processed: 1, total: 1 })
      setOfflineReport(report)
      setOfflineLocalStatus('succeeded')
      setOfflineCompletedStep(4)
      try {
        if (!user) throw new Error('Please log in if you want to save this local report to training history.')
        setOfflineArchiveStatus('saving')
        const reps = getRepsFromReport(report)
        const startedAt = new Date(Date.now() - Math.max(1000, Math.round((extracted.frames.length / Math.max(1, extracted.fps)) * 1000))).toISOString()
        const session = await createPoseTraining({
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          exercise_type: exercise.exerciseType,
          note: buildTrainingRecordName({ startedAt, exerciseName: exercise.displayName }),
          sets: [{ reps, note: 'Auto-saved from video analysis report' }],
          report: report as Record<string, unknown>
        })
        setOfflineReportSessionId(session.id)
        setOfflineArchiveStatus('done')
        setOfflineCompletedStep(5)
        setOfflineStatusMsg('Local video analysis completed and archived. You can open the detailed report or training history.')
      } catch (archiveError: unknown) {
        setOfflineArchiveStatus('failed')
        const archiveMessage =
          archiveError instanceof Error && archiveError.message
            ? archiveError.message
            : 'Local video analysis completed. Report is ready; training archive save failed this time.'
        setOfflineStatusMsg(archiveMessage)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Video analysis failed'
      setOfflineError(message)
      setOfflineLocalStatus('failed')
    } finally {
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl)
      setOfflineBusy(false)
      setOfflineProgress(null)
    }
  }

  const currentViewAngle =
    exercise.slug === 'squat' || exercise.slug === 'pushup' || exercise.slug === 'pullup' || exercise.slug === 'bench-press'
      ? 'side'
      : offlineViewAngle
  const taskStatusText = offlineBusy
    ? 'Analyzing video...'
    : offlineLocalStatus === 'succeeded'
      ? 'Completed'
      : offlineLocalStatus === 'failed'
        ? 'Failed'
        : offlineLocalStatus === 'running'
          ? 'Processing'
          : 'Ready to analyze'
  const taskStatusToneClass = offlineBusy
    ? 'pose-status-pill-info'
    : offlineLocalStatus === 'succeeded'
      ? 'pose-status-pill-success'
      : offlineLocalStatus === 'failed'
        ? 'pose-status-pill-danger'
        : offlineLocalStatus === 'running'
          ? 'pose-status-pill-info'
          : 'pose-status-pill-muted'
  const analysisStarted = offlineRunStarted || offlineCompletedStep > 0 || offlineBusy || !!offlineReport
  const progressStage = (offlineProgress?.stage ?? '').toLowerCase()
  const progressStep =
    progressStage.includes('preparing local video')
      ? 1
      : progressStage.includes('loading movenet') || progressStage.includes('loading mediapipe') || progressStage.includes('extracting pose keypoints')
        ? 2
        : progressStage.includes('replaying')
          ? 3
          : progressStage.includes('finalizing local report')
            ? 4
            : 0
  const checklist = [
    { label: 'Prepare local video', done: offlineCompletedStep >= 1 || progressStep >= 2 },
    { label: 'Extract pose keypoints', done: offlineCompletedStep >= 2 || progressStep >= 3 },
    { label: 'Run motion analysis', done: offlineCompletedStep >= 3 || progressStep >= 4 },
    { label: 'Finalize local report', done: offlineCompletedStep >= 4 || !!offlineReport },
    { label: 'Archive to training history', done: offlineArchiveStatus === 'done', failed: offlineArchiveStatus === 'failed', saving: offlineArchiveStatus === 'saving' }
  ]

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
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
        <div className="container">
          <div className="pose-mode-switch mb-30">
            <button className={mode === 'live' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'} onClick={() => setMode('live')} type="button">
              Live Coaching
            </button>
            <button className={mode === 'offline' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'} onClick={() => setMode('offline')} type="button">
              Video Analysis
            </button>
            <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
              Training History
            </Link>
          </div>

          {mode === 'live' ? (
            <div className="row pose-live-layout pose-live-shell">
              <div className="col-xl-8 col-lg-7 d-flex">
                <div className="cl_blog-widget mb-30 pose-camera-panel h-100 w-100 pose-live-camera-card">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">{exercise.displayName} · Realtime Camera</h4>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>
                        {liveSessionStatus === 'running'
                          ? 'Started: Live coaching is in progress'
                          : liveSessionStatus === 'ended'
                            ? 'Terminated: Live coaching has ended'
                            : 'Ready: Click Start to begin live coaching'}
                      </strong>
                      <span
                        style={{
                          borderRadius: 9999,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: liveSessionStatus === 'running' ? '#dcfce7' : liveSessionStatus === 'ended' ? '#fee2e2' : '#e2e8f0',
                          color: liveSessionStatus === 'running' ? '#166534' : liveSessionStatus === 'ended' ? '#991b1b' : '#334155'
                        }}
                      >
                        {liveSessionStatus === 'running' ? 'STARTED' : liveSessionStatus === 'ended' ? 'TERMINATED' : 'IDLE'}
                      </span>
                    </div>
                    <div style={{ marginTop: 10, height: 8, borderRadius: 9999, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (liveSessionElapsedMs / LIVE_SESSION_LIMIT_MS) * 100)}%`,
                          height: '100%',
                          background: liveSessionStatus === 'ended' ? '#ef4444' : '#10b981',
                          transition: 'width 0.2s linear'
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                      <span>Time Progress</span>
                      <span>{formatDuration(liveSessionElapsedMs)} / 02:00</span>
                    </div>
                    <div className="pose-live-metrics-line" style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: '#475569' }}>
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
                      <span className="pose-camera-toolbar__label">Mirror</span>
                      <button
                        className={previewMirror ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                        onClick={() => setPreviewMirror((value) => !value)}
                        type="button"
                      >
                        {previewMirror ? 'On' : 'Off'}
                      </button>
                      <button
                        className="pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn"
                        onClick={recalibrateDistance}
                        type="button"
                        disabled={!running}
                        title="Recalibrate distance target without stopping the current live session."
                      >
                        Recalibrate Distance
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

              <div className="col-xl-4 col-lg-5 d-flex">
                {liveSessionStatus === 'ended' && liveSessionSummary ? (
                  <div className="cl_blog-widget mb-30 pose-live-feedback h-100 w-100 pose-live-right-card">
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
                        <span className="pose-kv-label">Duration</span>
                        <strong className="pose-kv-value">{formatDuration(liveSessionElapsedMs)}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label">Total Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.reps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label">Correct Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.correctReps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label">Incorrect Reps</span>
                        <strong className="pose-kv-value">{liveSessionSummary.incorrectReps}</strong>
                      </li>
                      <li className="pose-kv-item">
                        <span className="pose-kv-label">Accuracy</span>
                        <strong className="pose-kv-value">{liveSessionSummary.accuracyPct}%</strong>
                      </li>
                      <li className="pose-kv-item pose-kv-item-placeholder" aria-hidden="true">
                        <span className="pose-kv-label pose-placeholder-hidden">Placeholder</span>
                        <strong className="pose-kv-value pose-placeholder-hidden">0</strong>
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
                      {savedLiveSessionId ? (
                        <Link to={buildPoseReportPath(exercise.slug, savedLiveSessionId)} className="cl_theme-btn">
                          Open Report
                        </Link>
                      ) : null}
                    </div>
                    {saveTrainingMsg ? <div className="pose-inline-note">{saveTrainingMsg}</div> : null}
                  </div>
                ) : (
                  <div className="cl_blog-widget mb-30 pose-live-feedback h-100 w-100 pose-live-right-card">
                    <div className="pose-panel-head">
                      <span className="pose-panel-kicker">In Session</span>
                      <h4 className="pose-panel-title">Live Feedback</h4>
                      <p className="pose-panel-subtitle">Real-time form diagnostics and coaching cues</p>
                    </div>
                    <div className="pose-kpi-grid pose-kpi-grid-light">
                      <MetricCard label={<LabelWithTip label="Completed Reps" tip={exercise.completedRepsTip} />} value={feedback?.repCount ?? 0} />
                      <MetricCard label={<LabelWithTip label="Form Accuracy" tip="Percentage of reps judged as good form." />} value={feedback?.session.accuracyPct ?? 0} unit="%" />
                      <MetricCard label={<LabelWithTip label={exercise.secondaryMetricLabel} tip={exercise.secondaryMetricTip} />} value={feedback?.kneeAngle ?? '-'} unit={feedback?.kneeAngle ? '°' : ''} />
                      <MetricCard label={<LabelWithTip label="Hip Bend" tip="Estimated hip joint angle during your movement." />} value={feedback?.hipAngle ?? '-'} unit={feedback?.hipAngle ? '°' : ''} />
                      <MetricCard label={<LabelWithTip label="Torso Lean" tip="Estimated torso angle relative to upright posture." />} value={feedback?.torsoAngle ?? '-'} unit={feedback?.torsoAngle ? '°' : ''} />
                      <MetricCardPlaceholder />
                    </div>

                    <div className="pose-tip-card pose-tip-card-light pose-live-section">
                      <h6 className="sub-title mb-15 pose-section-title">Coaching Tip</h6>
                      <p className="pose-live-coaching-copy">{currentSuggestion}</p>
                    </div>

                    <div className="pose-tip-card pose-tip-card-light pose-live-section">
                      <h6 className="sub-title mb-15 pose-section-title">Status</h6>
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
                          <span className="pose-kv-label" title="How many reps were judged as acceptable form.">Good Reps</span>
                          <strong className="pose-kv-value">{feedback?.correctCount ?? 0}</strong>
                        </li>
                        <li className="pose-kv-item">
                          <span className="pose-kv-label" title="Result of your most recent completed rep.">Last Rep Result</span>
                          <strong className="pose-kv-value">{feedback?.lastRepResult ?? '-'}</strong>
                        </li>
                        <li className="pose-kv-item pose-kv-item-placeholder" aria-hidden="true">
                          <span className="pose-kv-label pose-placeholder-hidden">Placeholder</span>
                          <strong className="pose-kv-value pose-placeholder-hidden">0</strong>
                        </li>
                      </ul>
                    </div>

                    <div className="pose-tip-card pose-tip-card-light pose-live-section">
                      <h6 className="sub-title mb-15 pose-section-title">{exercise.rangeSectionTitle}</h6>
                      <div className="pose-range-check">
                        <span className={rangeCheck.ok ? 'pose-range-badge pose-range-badge-ok' : 'pose-range-badge pose-range-badge-bad'}>
                          {rangeCheck.ok ? 'In range' : 'Out of range'}
                        </span>
                        <p className="pose-range-reason">{rangeCheck.reason}</p>
                      </div>
                      <MetricCard
                        label={<LabelWithTip label={exercise.rangeAlignmentLabel} tip={exercise.rangeAlignmentTip} />}
                        value={feedback?.offsetAngle ?? '-'}
                        unit={feedback?.offsetAngle ? '°' : ''}
                      />
                    </div>

                    {saveTrainingMsg ? <div className="pose-inline-note">{saveTrainingMsg}</div> : null}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-12">
                <div className="cl_blog-widget mb-30">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">{exercise.displayName} · Video Analysis</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">Select a local video and run pose extraction plus motion analysis entirely in your browser. Video files are not uploaded to the server.</p>
                    </div>
                  </div>

                  <div className="pose-form-grid">
                    <label className="pose-form-field">
                      <span>Video File</span>
                      <input
                        ref={offlineFileInputRef}
                        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                        onChange={(e) => handleOfflineFileChange(e.target.files?.[0] ?? null)}
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

                    <label className="pose-form-field">
                      <span>View Angle</span>
                      {exercise.slug === 'squat' || exercise.slug === 'pullup' || exercise.slug === 'bench-press' ? (
                        <input value="Side (required)" readOnly />
                      ) : (
                        <select value={offlineViewAngle} onChange={(e) => setOfflineViewAngle(e.target.value as 'unknown' | 'front' | 'side' | 'back')}>
                          <option value="side">Side</option>
                          <option value="front">Front</option>
                          <option value="back">Back</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      )}
                    </label>
                  </div>

                  <div className="pose-export-row">
                    <button className="cl_theme-btn" disabled={offlineBusy} onClick={() => void runOfflineAnalysis()} type="button">
                      {offlineBusy ? 'Analyzing...' : 'Analyze Locally'}
                    </button>
                  </div>

                  {offlinePreviewUrl ? (
                    <div className="pose-video-preview">
                      <video controls src={offlinePreviewUrl} className="pose-video-preview__media" />
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

              <div className="col-12">
                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-30">Analysis Report</h4>
                  <div className="pose-report-overview">
                    <span className={`pose-status-pill ${taskStatusToneClass}`}>{taskStatusText}</span>
                    <span className="pose-status-pill pose-status-pill-muted">View: {currentViewAngle}</span>
                    <span className="pose-status-pill pose-status-pill-muted">Video: {offlineFile ? `${Math.round(offlineFile.size / 1024 / 1024)} MB` : 'Not selected'}</span>
                  </div>
                  {analysisStarted ? (
                    <div className="pose-task-checklist">
                      {checklist.map((item) => (
                        <div
                          key={item.label}
                          className={`pose-task-checklist__item${item.done ? ' is-done' : ''}${item.failed ? ' is-failed' : ''}`}
                        >
                          <span className="pose-task-checklist__icon">{item.done ? '✓' : item.failed ? '!' : item.saving ? '…' : '○'}</span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {offlineReport ? (
                    <>
                      <div className="pose-export-row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        <Link
                          to={offlineReportSessionId ? buildPoseReportPath(exercise.slug, offlineReportSessionId) : '#'}
                          className="cl_theme-btn"
                          aria-disabled={offlineReportSessionId ? undefined : true}
                          style={offlineReportSessionId ? undefined : { opacity: 0.5, pointerEvents: 'none' }}
                          onClick={(e) => {
                            if (!offlineReportSessionId) e.preventDefault()
                          }}
                        >
                          Open Detailed Report
                        </Link>
                        <Link to={buildPoseHistoryPath(exercise.slug)} className="pose-tool-ghost-btn pose-tool-light-btn">
                          Go To Training History
                        </Link>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <ReportVisualization report={offlineReport} />
                      </div>
                    </>
                  ) : (
                    <div className="pose-report-empty">
                      <strong>No report yet</strong>
                      <p>{offlineFile ? 'Click "Analyze Locally" to generate the report.' : 'Select a video file first, then click "Analyze Locally".'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function drawCameraFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  previewScale: number,
  mirror: boolean
) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) return null

  // Use contain-fit (not cover-fit) so the live preview keeps the full camera frame.
  const safeScale = Math.min(1.05, Math.max(0.55, previewScale))
  const fitScale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * safeScale
  const drawWidth = sourceWidth * fitScale
  const drawHeight = sourceHeight * fitScale
  const offsetX = (canvasWidth - drawWidth) / 2
  const offsetY = (canvasHeight - drawHeight) / 2

  ctx.save()
  ctx.fillStyle = '#020617'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  if (mirror) {
    ctx.translate(canvasWidth, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, canvasWidth - offsetX - drawWidth, offsetY, drawWidth, drawHeight)
  } else {
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)
  }
  ctx.restore()

  return { x: offsetX, y: offsetY, w: drawWidth, h: drawHeight }
}


