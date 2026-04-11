import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import { chooseMotionStandard } from '../lib/pose/analysisSelector'
import { drawDistanceGuide, drawMidpointSkeleton } from '../lib/pose/draw'
import { DistanceTracker, type DistanceState } from '../lib/pose/distanceTracker'
import { buildPoseGuidePath, buildPoseHistoryPath, buildPoseReportPath, getPoseExerciseBySlug } from '../lib/pose/exercises'
import { buildTrainingRecordName } from '../lib/pose/trainingName'
import { analyzeGenericMotion } from '../lib/pose/genericMotion'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../lib/pose/livePoseProvider'
import { extractPose33FromVideoUrl, type PoseFrame } from '../lib/pose/mediapipePose'
import { buildMotionStandardCompareReport } from '../lib/pose/motionStandardCompareReport'
import { extractPose33FromVideoUrlWithMoveNet } from '../lib/pose/movenetPose'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type TrackingState } from '../lib/pose/movenetTracker'
import { buildGenericMotionReport, type PoseAnalysisReport } from '../lib/pose/report'
import { RealtimeSquatAnalyzer, type RealtimeFeedback } from '../lib/pose/realtimeSquat'
import { RealtimeLateralRaiseAnalyzer } from '../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../lib/pose/realtimePushup'
import { RealtimePullupAnalyzer } from '../lib/pose/realtimePullup'
import { RealtimeBenchPressAnalyzer } from '../lib/pose/realtimeBenchPress'
import {
  completePoseAnalysisTask,
  createPoseAnalysisTask,
  createPoseTraining,
  createPoseVideoObjectUrl,
  failPoseAnalysisTask,
  uploadPoseVideo,
  type PoseAnalysisTask
} from '../lib/poseApi'
import { normalizeReportForArchive } from '../lib/report/unified'

const LIVE_TARGET_FPS = 24
const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const LIVE_SESSION_LIMIT_MS = 2 * 60 * 1000

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
type SquatTimelineRow = {
  frame: number
  tMs: number
  phase: string
  trackingQuality: number | null
  kneeAngleDeg: number | null
  hipAngleDeg: number | null
  torsoFromVerticalDeg: number | null
}

type RealtimeAnalyzer = {
  analyze: (landmarks: Parameters<RealtimeSquatAnalyzer['analyze']>[0]) => RealtimeFeedback
  resetSession: () => void
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
  const [offlineTask, setOfflineTask] = useState<PoseAnalysisTask | null>(null)
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(null)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineReport, setOfflineReport] = useState<PoseAnalysisReport | null>(null)
  const [offlineStatusMsg, setOfflineStatusMsg] = useState<string | null>(null)
  const [offlineReportSessionId, setOfflineReportSessionId] = useState<number | null>(null)
  const [offlineArchiveStatus, setOfflineArchiveStatus] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')
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
    setOfflineTask(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
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

  function resetLiveSquatSessionStats() {
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
    resetLiveSquatSessionStats()

    try {
      if (!analyzerRef.current) analyzerRef.current = createAnalyzer(exercise.slug)
      if (!stabilizerRef.current) stabilizerRef.current = new MoveNetStabilizer(2500)
      if (!distanceTrackerRef.current) distanceTrackerRef.current = new DistanceTracker(5000)

      const provider = await getLiveProvider()
      const stream = await navigator.mediaDevices.getUserMedia({
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
            if (exercise.slug === 'squat') {
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
    resetLiveSquatSessionStats()
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
    setOfflineTask(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
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
    if (!user) {
      setOfflineError('Please log in to upload videos and save analysis tasks.')
      return
    }
    if (!offlineFile) {
      setOfflineError('Please choose a video file first.')
      return
    }
    if (offlineFile.size > MAX_VIDEO_BYTES) {
      setOfflineError('Video exceeds the 80MB limit. Please compress it and try again.')
      return
    }

    setOfflineBusy(true)
    setOfflineRunStarted(true)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineStatusMsg(null)
    setOfflineProgress({ stage: 'Uploading video', processed: 0, total: 1 })

    let taskId: number | null = null
    let serverObjectUrl: string | null = null

    try {
      const video = await uploadPoseVideo(offlineFile)
      setOfflineCompletedStep(1)
      setOfflineStatusMsg('Video uploaded. Creating an analysis task...')
      setOfflineProgress({ stage: 'Creating task', processed: 1, total: 1 })

      const effectiveViewAngle: 'unknown' | 'front' | 'side' | 'back' =
        exercise.slug === 'squat' || exercise.slug === 'pullup' || exercise.slug === 'bench-press' ? 'side' : offlineViewAngle
      const task = await createPoseAnalysisTask({
        video_asset_id: video.id,
        exercise_type: exercise.exerciseType,
        view_angle: effectiveViewAngle
      })
      taskId = task.id
      setOfflineTask(task)
      setOfflineCompletedStep(2)

      serverObjectUrl = await createPoseVideoObjectUrl(video)
      const extracted =
        exercise.slug === 'squat'
          ? await extractPose33FromVideoUrlWithMoveNet(serverObjectUrl, {
              onProgress: (p) => {
                setOfflineProgress({
                  stage: p.stage === 'loading' ? 'Loading MoveNet model' : 'Extracting pose keypoints',
                  processed: p.processed,
                  total: p.total
                })
              }
            })
          : await extractPose33FromVideoUrl(serverObjectUrl, {
              onProgress: (p) => {
                setOfflineProgress({
                  stage: p.stage === 'loading' ? 'Loading MediaPipe model' : 'Extracting pose keypoints',
                  processed: p.processed,
                  total: p.total
                })
              }
            })
      setOfflineCompletedStep(3)

      const report =
        exercise.slug === 'squat'
          ? buildSquatVideoLiveStyleReport({
              taskId: String(task.id),
              viewAngle: effectiveViewAngle,
              exercise: { id: exercise.id, name: exercise.exerciseType },
              video: {
                id: String(video.id),
                originalName: video.original_name,
                mimeType: video.mime_type,
                sizeBytes: video.size_bytes
              },
              fps: extracted.fps,
              frames: extracted.frames,
              onProgress: (processed, total) => {
                setOfflineProgress({ stage: 'Replaying real-time squat analyzer', processed, total })
              }
            })
          : (() => {
              const standard = chooseMotionStandard({ viewAngle: effectiveViewAngle, exerciseName: exercise.exerciseType })
              setOfflineProgress({ stage: standard ? 'Comparing with motion standard' : 'Generic motion analysis', processed: 1, total: 1 })
              return standard
                ? buildMotionStandardCompareReport({
                    taskId: String(task.id),
                    viewAngle: effectiveViewAngle,
                    instruction: null,
                    exercise: { id: exercise.id, name: exercise.exerciseType },
                    video: {
                      id: String(video.id),
                      originalName: video.original_name,
                      mimeType: video.mime_type,
                      sizeBytes: video.size_bytes
                    },
                    fps: extracted.fps,
                    frames: extracted.frames,
                    standard
                  })
                : buildGenericMotionReport({
                    taskId: String(task.id),
                    viewAngle: effectiveViewAngle,
                    instruction: null,
                    exercise: { id: exercise.id, name: exercise.exerciseType },
                    video: {
                      id: String(video.id),
                      originalName: video.original_name,
                      mimeType: video.mime_type,
                      sizeBytes: video.size_bytes
                    },
                    fps: extracted.fps,
                    analysis: analyzeGenericMotion(extracted.frames)
                  })
            })()
      setOfflineCompletedStep(4)

      setOfflineProgress({ stage: 'Writing back results', processed: 1, total: 1 })
      const completed = await completePoseAnalysisTask(task.id, report as unknown as Record<string, unknown>)
      setOfflineTask(completed)
      setOfflineReport(report)
      setOfflineCompletedStep(5)
      try {
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
        setOfflineCompletedStep(6)
        setOfflineStatusMsg('Video analysis completed and archived. You can open the detailed report or training history.')
      } catch {
        setOfflineArchiveStatus('failed')
        setOfflineStatusMsg('Video analysis completed. Report is ready; training archive save failed this time.')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Video analysis failed'
      setOfflineError(message)
      if (taskId !== null) {
        try {
          const failedTask = await failPoseAnalysisTask(taskId, message)
          setOfflineTask(failedTask)
        } catch {
          // ignore secondary failure
        }
      }
    } finally {
      if (serverObjectUrl) URL.revokeObjectURL(serverObjectUrl)
      setOfflineBusy(false)
      setOfflineProgress(null)
    }
  }

  const currentViewAngle = exercise.slug === 'squat' || exercise.slug === 'pullup' || exercise.slug === 'bench-press' ? 'side' : offlineViewAngle
  const taskStatusText = offlineBusy
    ? 'Analyzing video...'
    : offlineTask?.status === 'succeeded'
      ? 'Completed'
      : offlineTask?.status === 'failed'
        ? 'Failed'
        : offlineTask?.status === 'running'
          ? 'Processing'
          : offlineTask?.status === 'uploaded'
            ? 'Uploaded, waiting for analysis'
            : 'Ready to analyze'
  const taskStatusToneClass = offlineBusy
    ? 'pose-status-pill-info'
    : offlineTask?.status === 'succeeded'
      ? 'pose-status-pill-success'
      : offlineTask?.status === 'failed'
        ? 'pose-status-pill-danger'
        : offlineTask?.status === 'running'
          ? 'pose-status-pill-info'
          : 'pose-status-pill-muted'
  const analysisStarted = offlineRunStarted || offlineCompletedStep > 0 || offlineBusy || !!offlineTask || !!offlineReport
  const progressStage = (offlineProgress?.stage ?? '').toLowerCase()
  const progressStep =
    progressStage.includes('upload')
      ? 1
      : progressStage.includes('creating task')
        ? 2
        : progressStage.includes('loading movenet') || progressStage.includes('loading mediapipe') || progressStage.includes('extracting pose keypoints')
          ? 3
          : progressStage.includes('replaying') || progressStage.includes('comparing') || progressStage.includes('generic motion')
            ? 4
            : progressStage.includes('writing back')
              ? 5
              : 0
  const checklist = [
    { label: 'Upload video', done: offlineCompletedStep >= 1 || progressStep >= 2 },
    { label: 'Create analysis task', done: offlineCompletedStep >= 2 || progressStep >= 3 },
    { label: 'Extract pose keypoints', done: offlineCompletedStep >= 3 || progressStep >= 4 },
    { label: 'Run motion analysis', done: offlineCompletedStep >= 4 || progressStep >= 5 },
    { label: 'Save analysis report', done: offlineCompletedStep >= 5 || !!offlineReport },
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
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">Upload a fixed video, extract pose keypoints frame by frame, replay the real-time analyzer logic, and archive the same-style report.</p>
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
                      {offlineBusy ? 'Analyzing...' : 'Upload & Analyze'}
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
                    <span className="pose-status-pill pose-status-pill-muted">View: {offlineTask?.view_angle ?? currentViewAngle}</span>
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
                      <p>{offlineFile ? 'Click "Upload & Analyze" to generate the report.' : 'Select a video file first, then click "Upload & Analyze".'}</p>
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

function buildSquatAlignedReport(input: {
  source: 'live' | 'video'
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  lastFeedback: RealtimeFeedback | null
  messageFreq: Map<string, number>
  analyzedFrameCount: number
  trackingQualitySamples: number[]
  timelineRows: SquatTimelineRow[]
}): PoseAnalysisReport {
  const sortedIssues = Array.from(input.messageFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const avgTrackingQuality =
    input.trackingQualitySamples.length > 0
      ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
      : 0
  const fallbackSuggestion = 'Keep a steady tempo and align your knees with your toes.'
  const currentSuggestion = input.lastFeedback
    ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
    : input.source === 'video'
      ? 'No valid pose frames were detected. Keep your full body in frame and try another video.'
      : 'No valid pose frames were detected in the live session.'
  const issueMessages = sortedIssues
    .filter(([message, count]) => {
      const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
      const text = message.toLowerCase()
      const isSideViewWarn = text.includes('side view')
      const isLowConfidenceWarn = text.includes('low keypoint confidence')
      if (text.includes('try to stay in a clear side view for more stable tracking')) return false

      if ((isSideViewWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) {
        return ratio >= 0.35
      }
      return true
    })
    .map(([message]) => message)

  const tempoCheck = analyzeSquatTempoFromTimeline(input.timelineRows)
  const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0
  const phaseFastRepCount = Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount)
  const unifiedFastRepCount = Math.max(sessionFastRepCount, phaseFastRepCount)
  const issues =
    issueMessages.length > 0
      ? issueMessages.map((message) => {
          const count = input.messageFreq.get(message) ?? 0
          const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0
          const severity: 'info' | 'warning' | 'error' = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info'
          return {
            code: toIssueCode(message),
            severity,
            message,
            atFrame: null
          }
        })
      : [
          {
            code: 'NO_OBVIOUS_ISSUES',
            severity: 'info' as const,
            message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
            atFrame: null
          }
        ]
  if (tempoCheck.fastDescentCount > 0) {
    issues.push({
      code: 'DESCENT_TOO_FAST',
      severity: tempoCheck.fastDescentCount >= 2 ? 'warning' : 'info',
      message: `Descent too fast detected (${tempoCheck.fastDescentCount} rep${tempoCheck.fastDescentCount > 1 ? 's' : ''}).`,
      atFrame: null
    })
  }
  if (tempoCheck.fastAscentCount > 0) {
    issues.push({
      code: 'ASCENT_TOO_FAST',
      severity: tempoCheck.fastAscentCount >= 2 ? 'warning' : 'info',
      message: `Ascent too fast detected (${tempoCheck.fastAscentCount} rep${tempoCheck.fastAscentCount > 1 ? 's' : ''}).`,
      atFrame: null
    })
  }

  const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis'
  const summary = input.lastFeedback
    ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%, avg rep ${input.lastFeedback.session.avgRepDurationSec ?? '-'}s.`
    : `${summaryPrefix}: no stable pose frames were detected.`
  const suggestions = buildSquatReplaySuggestions(input.lastFeedback, sortedIssues, fallbackSuggestion)
  const keyMetrics = {
    totalReps: input.lastFeedback?.session.totalReps ?? 0,
    correctReps: input.lastFeedback?.session.correctReps ?? 0,
    incorrectReps: input.lastFeedback?.session.incorrectReps ?? 0,
    formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
    avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
    fastRepCount: unifiedFastRepCount,
    slowRepCount: input.lastFeedback?.session.slowRepCount ?? 0,
    effectiveFps: input.fps
  }
  const generatedAt = new Date().toISOString()
  const timelineSampled = sampleTimelineRows(input.timelineRows, 180)

  return normalizeReportForArchive({
    version: 3,
    generatedAt,
    status: 'ok',
    task: { id: input.taskId, viewAngle: input.viewAngle, instruction: null },
    exercise: input.exercise,
    video: input.video,
    summary,
    keyMetrics,
    issues,
    suggestions,
    details: {
      type: input.source === 'video' ? 'video_live_replay_squat' : 'live_realtime_squat',
      modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
      analyzer: 'RealtimeSquatAnalyzer',
      effectiveFps: input.fps,
      repCount: input.lastFeedback?.repCount ?? 0,
      correctCount: input.lastFeedback?.correctCount ?? 0,
      incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
      kneeAngle: input.lastFeedback?.kneeAngle ?? null,
      hipAngle: input.lastFeedback?.hipAngle ?? null,
      torsoAngle: input.lastFeedback?.torsoAngle ?? null,
      offsetAngle: input.lastFeedback?.offsetAngle ?? null,
      trackingQuality: input.lastFeedback?.trackingQuality ?? null,
      avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
      currentSuggestion,
      warnings: input.lastFeedback?.warnings ?? [],
      tempo: tempoCheck,
      timelineSampled
    },
    sections: {
      overview: {
        generatedAt,
        status: 'ok',
        taskId: input.taskId,
        viewAngle: input.viewAngle,
        exerciseName: input.exercise?.name ?? null,
        summary
      },
      metrics: keyMetrics,
      errorStats: computeReportErrorStats(issues),
      suggestions,
      timelineSampled
    }
  })
}

function buildSquatVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  frames: PoseFrame[]
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  const analyzer = new RealtimeSquatAnalyzer()
  let lastFeedback: RealtimeFeedback | null = null
  let analyzedFrameCount = 0
  const messageFreq = new Map<string, number>()
  const trackingQualitySamples: number[] = []
  const timelineRows: SquatTimelineRow[] = []
  const total = input.frames.length

  for (let i = 0; i < input.frames.length; i++) {
    const frame = input.frames[i]!
    if (frame.landmarks) {
      const feedback = analyzer.analyze(frame.landmarks)
      lastFeedback = feedback
      analyzedFrameCount += 1
      if (Number.isFinite(feedback.trackingQuality)) trackingQualitySamples.push(feedback.trackingQuality)
      for (const message of collectLiveFrameIssueMessages(feedback)) {
        const text = message.trim()
        if (!text) continue
        messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1)
      }
      timelineRows.push({
        frame: i,
        tMs: frame.tMs,
        phase: feedback.phase,
        trackingQuality: feedback.trackingQuality,
        kneeAngleDeg: feedback.kneeAngle,
        hipAngleDeg: feedback.hipAngle,
        torsoFromVerticalDeg: feedback.torsoAngle
      })
    }
    if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) {
      input.onProgress(i + 1, total)
    }
  }
  return buildSquatAlignedReport({
    source: 'video',
    taskId: input.taskId,
    viewAngle: input.viewAngle,
    exercise: input.exercise,
    video: input.video,
    fps: input.fps,
    lastFeedback,
    messageFreq,
    analyzedFrameCount,
    trackingQualitySamples,
    timelineRows
  })
}

function getRepsFromReport(report: PoseAnalysisReport) {
  const keyMetrics = (report as unknown as Record<string, unknown>).keyMetrics
  if (keyMetrics && typeof keyMetrics === 'object' && !Array.isArray(keyMetrics)) {
    const totalReps = (keyMetrics as Record<string, unknown>).totalReps
    if (typeof totalReps === 'number' && Number.isFinite(totalReps) && totalReps >= 0) return Math.max(0, Math.round(totalReps))
  }
  const repCount = (report as unknown as Record<string, unknown>).repCount
  if (typeof repCount === 'number' && Number.isFinite(repCount) && repCount >= 0) return Math.max(0, Math.round(repCount))
  return 0
}

function sampleTimelineRows<
  T
>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max <= 0) return []
  const step = Math.max(1, Math.ceil(items.length / max))
  const out: T[] = []
  for (let i = 0; i < items.length; i += step) out.push(items[i]!)
  return out.slice(0, max)
}

function computeReportErrorStats(issues: Array<{ code: string; severity: 'info' | 'warning' | 'error' }>) {
  const bySeverity = { info: 0, warning: 0, error: 0 }
  const byCode = new Map<string, { count: number; maxSeverity: 'info' | 'warning' | 'error' }>()

  function rank(value: 'info' | 'warning' | 'error') {
    if (value === 'error') return 3
    if (value === 'warning') return 2
    return 1
  }

  for (const issue of issues) {
    bySeverity[issue.severity] += 1
    const prev = byCode.get(issue.code)
    if (!prev) {
      byCode.set(issue.code, { count: 1, maxSeverity: issue.severity })
      continue
    }
    prev.count += 1
    if (rank(issue.severity) > rank(prev.maxSeverity)) prev.maxSeverity = issue.severity
  }

  return {
    total: issues.length,
    bySeverity,
    byCode: Array.from(byCode.entries())
      .map(([code, value]) => ({ code, count: value.count, maxSeverity: value.maxSeverity }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }
}

function evaluateRangeCheck(feedback: RealtimeFeedback | null, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press') {
  if (!feedback) return { ok: false, reason: 'Waiting for stable tracking' }
  if (feedback.lastRepReasonLabels.length > 0) {
    return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' }
  }
  if (feedback.issues.length > 0) {
    return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.torsoAngle === 'number' && feedback.torsoAngle > 35) {
    return { ok: false, reason: 'Excessive forward lean' }
  }
  if (exerciseSlug === 'lateral-raise' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle >= 60) {
    return { ok: true, reason: 'Raise height reached' }
  }
  if (exerciseSlug === 'pushup' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
    return { ok: true, reason: 'Push-up depth reached' }
  }
  if (exerciseSlug === 'pullup' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
    return { ok: true, reason: 'Top position reached' }
  }
  if (exerciseSlug === 'bench-press' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
    return { ok: true, reason: 'Bench depth reached' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
    return { ok: true, reason: 'Depth reached' }
  }
  return { ok: true, reason: 'Current rep is in range' }
}

function MetricCard(props: { label: ReactNode; value: string | number; unit?: string }) {
  return (
    <div className="pose-metric-card pose-metric-card-light">
      <span className="pose-metric-label pose-metric-label-light">{props.label}</span>
      <strong className="pose-metric-value pose-metric-value-light">
        {props.value}
        {props.unit ?? ''}
      </strong>
    </div>
  )
}

function LabelWithTip(props: { label: string; tip: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{props.label}</span>
      <span title={props.tip} style={{ cursor: 'help', color: '#64748b', fontSize: 12 }}>
        ⓘ
      </span>
    </span>
  )
}

function MetricCardPlaceholder() {
  return (
    <div className="pose-metric-card pose-metric-card-light pose-metric-card-placeholder" aria-hidden="true">
      <span className="pose-metric-label pose-metric-label-light pose-placeholder-hidden">Placeholder</span>
      <strong className="pose-metric-value pose-metric-value-light pose-placeholder-hidden">0</strong>
    </div>
  )
}

function ReportVisualization(props: { report: PoseAnalysisReport }) {
  const report = props.report as unknown as Record<string, unknown>
  const keyMetrics = asRecord(report.keyMetrics) ?? {}
  const issues = Array.isArray(report.issues) ? (report.issues as Array<Record<string, unknown>>) : []
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : []
  const details = asRecord(report.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []

  return (
    <div className="pose-report-stack">
      <div className="pose-report-card pose-report-card-accent">
        <div className="pose-report-title">Summary</div>
        <div>{typeof report.summary === 'string' ? report.summary : 'No summary'}</div>
      </div>

      <div className="pose-report-metrics">
        {Object.entries(keyMetrics).map(([key, value]) => (
          <div key={key} className="pose-report-card">
            <div className="pose-report-label">{prettyMetricName(key)}</div>
            <div className="pose-report-value">{formatMetricValue(key, value)}</div>
          </div>
        ))}
      </div>

      {timeline.length > 0 ? <TimelinePreview timeline={timeline} /> : null}

      <div className="pose-report-columns">
        <div className="pose-report-card">
          <div className="pose-report-title">Issues</div>
          {issues.length === 0 ? <div className="pose-muted-copy">No obvious issues detected</div> : null}
          <div className="pose-report-issue-list">
            {issues.map((issue, index) => (
              <div key={index} className="pose-report-issue">
                <strong>{String(issue.message ?? issue.code ?? 'Issue')}</strong>
                <span>
                  {String(issue.severity ?? '-')}
                  {typeof issue.atFrame === 'number' ? ` 路 frame ${issue.atFrame}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pose-report-card">
          <div className="pose-report-title">Suggestions</div>
          {suggestions.length === 0 ? <div className="pose-muted-copy">No suggestions</div> : null}
          <ol className="pose-report-suggestions">
            {suggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function TimelinePreview(props: { timeline: unknown[] }) {
  const rows = props.timeline.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
  const candidates = ['kneeAngleDeg', 'hipAngleDeg', 'torsoFromVerticalDeg', 'kneeFlexDeg', 'centerY']
  const series = candidates
    .map((key) => ({
      key,
      values: rows.map((row) => row[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    }))
    .filter((item) => item.values.length >= 3)
    .slice(0, 3)

  if (series.length === 0) return null

  return (
    <div className="pose-report-card">
      <div className="pose-report-title">Key Timeline</div>
      <div className="pose-report-line-stack">
        {series.map((item) => (
          <div key={item.key}>
            <div className="pose-report-label">{prettyMetricName(item.key)}</div>
            <MiniLine values={item.values} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniLine(props: { values: number[] }) {
  const width = 600
  const height = 110
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const range = Math.max(1e-6, max - min)
  const points = props.values
    .map((v, i) => {
      const x = (i / Math.max(1, props.values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pose-mini-line">
      <polyline points={points} fill="none" stroke="#0f766e" strokeWidth="2" />
    </svg>
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    reps: 'Reps',
    repEstimate: 'Estimated Reps',
    fps: 'FPS',
    standardId: 'Standard ID',
    standardName: 'Standard Name',
    extractedFrames: 'Extracted Frames',
    comparableFrames: 'Comparable Frames',
    avgScore: 'Average Score',
    minScore: 'Min Score',
    maxScore: 'Max Score',
    badFramePct: 'Bad Frame %',
    coverage: 'Visibility',
    stabilityScore: 'Stability',
    mobilityScore: 'Mobility',
    rhythmScore: 'Rhythm',
    symmetryScore: 'Symmetry',
    avgRepDurationSec: 'Avg Rep Duration',
    fastRepCount: 'Fast Reps',
    slowRepCount: 'Slow Reps',
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle',
    kneeFlexDeg: 'Knee Flexion',
    centerY: 'Center Height'
  }
  return map[key] ?? key
}

function formatMetricValue(key: string, v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  const percentLike01Keys = new Set(['coverage', 'badFramePct'])
  if (percentLike01Keys.has(key) && v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getSessionComment(accuracyPct: number, reps: number, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press') {
  if (reps <= 0) {
    return exerciseSlug === 'lateral-raise'
      ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
      : exerciseSlug === 'pushup'
        ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
        : exerciseSlug === 'pullup'
          ? 'No completed reps were detected. Pull with full range and lower under control.'
          : exerciseSlug === 'bench-press'
            ? 'No completed reps were detected. Lower to stable depth and press with a controlled path.'
      : 'No completed reps were detected. Try a full-depth squat with a steady tempo.'
  }
  if (accuracyPct >= 90) return 'Excellent consistency. Keep the same depth and tempo in your next set.'
  if (accuracyPct >= 75) return 'Good overall form. Focus on the repeated issues to improve consistency.'
  if (accuracyPct >= 50) return 'Mixed quality set. Slow down and prioritize controlled reps.'
  return 'Form is not stable yet. Reduce speed and focus on one correction cue at a time.'
}

function getTopIssues(snapshot: RealtimeFeedback | null) {
  if (!snapshot) return []
  const raw = [
    ...(snapshot.lastRepReasonLabels ?? []),
    ...(snapshot.issues?.map((x) => x.message) ?? []),
    ...(snapshot.warnings ?? [])
  ]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const normalized = item.trim()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(normalized)
    if (deduped.length >= 2) break
  }
  return deduped
}

function collectLiveIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [
    ...(feedback.issues?.map((x) => x.message) ?? []),
    ...(feedback.lastRepReasonLabels ?? []),
    ...(feedback.warnings ?? [])
  ]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

function collectLiveFrameIssueMessages(feedback: RealtimeFeedback | null) {
  if (!feedback) return []
  const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.warnings ?? [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of raw) {
    const text = item.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    deduped.push(text)
  }
  return deduped
}

function buildSquatReplaySuggestions(
  feedback: RealtimeFeedback | null,
  sortedIssues: Array<[string, number]>,
  fallbackSuggestion: string
) {
  const suggestions = new Set<string>()
  const prioritizedIssues = [...sortedIssues].sort((a, b) => {
    const aKnee = a[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0
    const bKnee = b[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0
    if (aKnee !== bKnee) return bKnee - aKnee
    return b[1] - a[1]
  })

  for (const [message] of prioritizedIssues) {
    const mapped = mapSuggestionFromIssue(message, 'squat')
    if (mapped) suggestions.add(mapped)
    if (suggestions.size >= 4) break
  }

  if (feedback) {
    if ((feedback.session.totalReps ?? 0) <= 0) {
      suggestions.add('Start fully upright, descend until thighs are near parallel, then stand tall to complete each rep.')
    }
    if ((feedback.session.accuracyPct ?? 0) < 70) {
      suggestions.add('Slow down each rep: 2 seconds down, brief pause, then drive up with controlled tempo.')
    }
    if ((feedback.trackingQuality ?? 0) < 0.5) {
      suggestions.add('Place the camera at hip height, keep your full body visible, and improve front lighting.')
    }
    const avgRepDurationSec = feedback.session.avgRepDurationSec ?? null
    const fastRepCount = feedback.session.fastRepCount ?? 0
    const slowRepCount = feedback.session.slowRepCount ?? 0
    if (avgRepDurationSec !== null) {
      if (fastRepCount >= 1 || avgRepDurationSec < 1.15) {
        suggestions.add('Your squat tempo is a bit fast. Aim for about 2s down, brief pause, and controlled rise.')
      } else if (slowRepCount >= 1 || avgRepDurationSec > 3.8) {
        suggestions.add('Your squat tempo is quite slow. Keep tension, but try a smoother continuous rhythm per rep.')
      } else {
        suggestions.add('Tempo looks stable. Keep this rhythm to maintain depth control and consistent form.')
      }
    }
  }

  if (suggestions.size === 0) suggestions.add(fallbackSuggestion.trim())
  return Array.from(suggestions).slice(0, 5)
}

function analyzeSquatTempoFromTimeline(
  timelineRows: Array<{
    frame: number
    tMs: number
    phase: string
    trackingQuality: number | null
    kneeAngleDeg: number | null
    hipAngleDeg: number | null
    torsoFromVerticalDeg: number | null
  }>
) {
  const DESCENT_FAST_SEC = 0.62
  const ASCENT_FAST_SEC = 0.58
  const MIN_PHASE_SEC = 0.2
  const DIRECTION_SWITCH_MIN_FRAMES = 2
  let fastDescentCount = 0
  let fastAscentCount = 0

  let prevKnee: number | null = null
  let phaseMode: 'idle' | 'descent' | 'ascent' = 'idle'
  let phaseStartMs: number | null = null
  let descentStreak = 0
  let ascentStreak = 0

  function resetDirectionStreak() {
    descentStreak = 0
    ascentStreak = 0
  }

  function maybeCountFast(phase: 'descent' | 'ascent', sec: number) {
    if (sec < MIN_PHASE_SEC) return
    if (phase === 'descent' && sec < DESCENT_FAST_SEC) fastDescentCount += 1
    if (phase === 'ascent' && sec < ASCENT_FAST_SEC) fastAscentCount += 1
  }

  for (const row of timelineRows) {
    const knee = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null
    if (row.phase === 'bottom') {
      if (phaseMode === 'descent' && phaseStartMs !== null) {
        const sec = (row.tMs - phaseStartMs) / 1000
        maybeCountFast('descent', sec)
      }
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevKnee = knee
      continue
    }
    if (row.phase === 'up') {
      if (phaseMode === 'ascent' && phaseStartMs !== null) {
        const sec = (row.tMs - phaseStartMs) / 1000
        maybeCountFast('ascent', sec)
      }
      phaseMode = 'idle'
      phaseStartMs = null
      resetDirectionStreak()
      prevKnee = knee
      continue
    }

    if (row.phase !== 'bottom' && knee !== null && prevKnee !== null) {
      const diff = knee - prevKnee
      if (diff <= -1.2) {
        descentStreak += 1
        ascentStreak = 0
        if (descentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'descent') {
          phaseMode = 'descent'
          phaseStartMs = row.tMs
        }
      } else if (diff >= 1.2) {
        ascentStreak += 1
        descentStreak = 0
        if (ascentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'ascent') {
          phaseMode = 'ascent'
          phaseStartMs = row.tMs
        }
      } else {
        resetDirectionStreak()
      }
    }

    prevKnee = knee
  }

  return { fastDescentCount, fastAscentCount }
}

function buildLiveSuggestions(feedback: RealtimeFeedback | null, fallbackSuggestion: string, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press') {
  const suggestions = new Set<string>()
  const messages = collectLiveIssueMessages(feedback)
  for (const message of messages) {
    const mapped = mapSuggestionFromIssue(message, exerciseSlug)
    if (mapped) suggestions.add(mapped)
  }
  if (suggestions.size === 0 && fallbackSuggestion.trim()) {
    suggestions.add(fallbackSuggestion.trim())
  }
  if (suggestions.size === 0) {
    suggestions.add(
      exerciseSlug === 'lateral-raise'
        ? 'Keep your movement controlled and face the camera for balanced left-right tracking.'
        : exerciseSlug === 'pushup'
          ? 'Keep your core tight and move through a full push-up range with controlled tempo.'
          : exerciseSlug === 'pullup'
            ? 'Use a steady pull-up tempo and avoid body swing during both ascent and descent.'
            : exerciseSlug === 'bench-press'
              ? 'Keep your setup stable and press with controlled tempo through full range.'
        : 'Keep your movement controlled and maintain a stable side-view camera angle.'
    )
  }
  return Array.from(suggestions).slice(0, 4)
}

function mapSuggestionFromIssue(issue: string, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press') {
  const text = issue.toLowerCase()
  if (exerciseSlug === 'lateral-raise') {
    if (text.includes('torso sway')) return 'Lower the load, brace your core, and avoid swinging the torso.'
    if (text.includes('symmetry')) return 'Lift both arms together and match left-right height at the top.'
    if (text.includes('elbow') || text.includes('curl')) return 'Keep a soft elbow bend and move from the shoulder joint.'
    if (text.includes('face the camera') || text.includes('front')) return 'Rotate to face the camera so both arms stay visible.'
  }
  if (exerciseSlug === 'pushup') {
    if (text.includes('torso') || text.includes('hips')) return 'Brace your core and keep shoulders, hips, and ankles in one line.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve depth and body-line checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'pullup') {
    if (text.includes('kipping') || text.includes('sway') || text.includes('swing')) return 'Reduce swing, brace your core, and keep the pull path controlled.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve pull-up range and alignment checks.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep your full body visible throughout each rep.'
  }
  if (exerciseSlug === 'bench-press') {
    if (text.includes('torso') || text.includes('bridge')) return 'Keep your torso braced and avoid excessive arch changes between reps.'
    if (text.includes('side-view') || text.includes('side view')) return 'Rotate to a clearer side-view to improve bench depth and elbow tracking.'
    if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and keep shoulders, elbows, wrists, and torso visible.'
  }
  if (text.includes('torso lean')) return 'Brace your core and keep your chest up during the descent.'
  if (text.includes('knee') && text.includes('toes')) {
    return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.'
  }
  if (text.includes('side view')) return 'Set the camera exactly side-on at hip height, 2-3 meters away, with your full body always in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.'
  return ''
}

function createAnalyzer(exerciseSlug: 'squat' | 'lateral-raise' | 'pushup' | 'pullup' | 'bench-press'): RealtimeAnalyzer {
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  if (exerciseSlug === 'pullup') return new RealtimePullupAnalyzer()
  if (exerciseSlug === 'bench-press') return new RealtimeBenchPressAnalyzer()
  return new RealtimeSquatAnalyzer()
}

function toIssueCode(message: string) {
  return message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

