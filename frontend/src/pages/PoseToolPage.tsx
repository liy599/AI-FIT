import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import { chooseMotionStandard } from '../lib/pose/analysisSelector'
import { drawDistanceGuide, drawMidpointSkeleton } from '../lib/pose/draw'
import { DistanceTracker, type DistanceState } from '../lib/pose/distanceTracker'
import { buildPoseGuidePath, buildPoseHistoryPath, getPoseExerciseBySlug } from '../lib/pose/exercises'
import { analyzeGenericMotion } from '../lib/pose/genericMotion'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../lib/pose/livePoseProvider'
import { extractPose33FromVideoUrl } from '../lib/pose/mediapipePose'
import { buildMotionStandardCompareReport } from '../lib/pose/motionStandardCompareReport'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type TrackingState } from '../lib/pose/movenetTracker'
import { buildGenericMotionReport, type PoseAnalysisReport } from '../lib/pose/report'
import { RealtimeSquatAnalyzer, type RealtimeFeedback } from '../lib/pose/realtimeSquat'
import { RealtimeLateralRaiseAnalyzer } from '../lib/pose/realtimeLateralRaise'
import { RealtimePushupAnalyzer } from '../lib/pose/realtimePushup'
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
  const previewScaleRef = useRef(0.86)
  const previewMirrorRef = useRef(true)
  const feedbackRef = useRef<RealtimeFeedback | null>(null)
  const liveProviderRef = useRef<RealtimePoseProvider | null>(null)
  const liveProviderPromiseRef = useRef<Promise<RealtimePoseProvider> | null>(null)

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
  const [previewScale, setPreviewScale] = useState(0.86)
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
  const [offlineInstruction, setOfflineInstruction] = useState('')
  const [offlineTask, setOfflineTask] = useState<PoseAnalysisTask | null>(null)
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(null)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineReport, setOfflineReport] = useState<PoseAnalysisReport | null>(null)
  const [offlineStatusMsg, setOfflineStatusMsg] = useState<string | null>(null)

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
    setLiveSessionSummary(null)
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    setOfflineTask(null)
    setOfflineReport(null)
    setOfflineError(null)
    setOfflineStatusMsg(null)
    setOfflineInstruction('')
    setOfflineViewAngle(exercise.slug === 'lateral-raise' ? 'front' : 'side')
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
      feedback.warnings[0] ??
      feedback.issues[0]?.message ??
      feedback.lastRepMessage ??
      (exercise.slug === 'lateral-raise'
        ? 'Move both arms together, keep shoulders down, and avoid torso swing.'
        : exercise.slug === 'pushup'
          ? 'Brace your core, keep your body line straight, and lower under control.'
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

  const liveReport = useMemo(() => {
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
  }, [currentSuggestion, effectiveFps, exercise.slug, feedback])

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
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    setLiveSessionSummary(null)
    sessionStartedPerfRef.current = null

    try {
      if (!analyzerRef.current) analyzerRef.current = createAnalyzer(exercise.slug)
      if (!stabilizerRef.current) stabilizerRef.current = new MoveNetStabilizer(2500)
      if (!distanceTrackerRef.current) distanceTrackerRef.current = new DistanceTracker(3000)

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
      canvas.width = video.videoWidth || 720
      canvas.height = video.videoHeight || 1280

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
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
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
      const session = await createPoseTraining({
        started_at: sessionStartedAtRef.current ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        exercise_type: exercise.exerciseType,
        note: 'Saved from live pose coaching',
        sets: [{ reps, note: currentSuggestion }],
        report: liveReport as Record<string, unknown>
      })
      setSaveTrainingMsg(`Saved training record #${session.id}`)
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
    setOfflineError(null)
    setOfflineReport(null)
    setOfflineStatusMsg(null)
    setOfflineProgress({ stage: 'Uploading video', processed: 0, total: 1 })

    let taskId: number | null = null
    let serverObjectUrl: string | null = null

    try {
      const video = await uploadPoseVideo(offlineFile)
      setOfflineStatusMsg('Video uploaded. Creating an analysis task...')
      setOfflineProgress({ stage: 'Creating task', processed: 1, total: 1 })

      const task = await createPoseAnalysisTask({
        video_asset_id: video.id,
        exercise_type: exercise.exerciseType,
        view_angle: offlineViewAngle,
        instruction: offlineInstruction.trim() || undefined
      })
      taskId = task.id
      setOfflineTask(task)

      serverObjectUrl = await createPoseVideoObjectUrl(video)
      const extracted = await extractPose33FromVideoUrl(serverObjectUrl, {
        onProgress: (p) => {
          setOfflineProgress({
            stage: p.stage === 'loading' ? 'Loading MediaPipe model' : 'Extracting pose keypoints',
            processed: p.processed,
            total: p.total
          })
        }
      })

      const standard = chooseMotionStandard({ viewAngle: offlineViewAngle, exerciseName: exercise.exerciseType })
      setOfflineProgress({ stage: standard ? 'Comparing with motion standard' : 'Generic motion analysis', processed: 1, total: 1 })

      const report = standard
        ? buildMotionStandardCompareReport({
            taskId: String(task.id),
            viewAngle: offlineViewAngle,
            instruction: offlineInstruction.trim() || null,
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
            viewAngle: offlineViewAngle,
            instruction: offlineInstruction.trim() || null,
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

      setOfflineProgress({ stage: 'Writing back results', processed: 1, total: 1 })
      const completed = await completePoseAnalysisTask(task.id, report as unknown as Record<string, unknown>)
      setOfflineTask(completed)
      setOfflineReport(report)
      setOfflineStatusMsg('Offline analysis completed. Results have been saved to the backend.')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Offline analysis failed'
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
                    <span>{mode === 'live' ? 'Live Coaching' : 'Offline Video Analysis'}</span>
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
              Offline Video Analysis
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
                      <h4 className="cl_blog-widget-title mb-15">Realtime Camera</h4>
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
                    </div>
                    <label className="pose-slider-control">
                      <span>Zoom</span>
                      <input
                        type="range"
                        min="0.7"
                        max="1.15"
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
              <div className="col-xl-7 col-lg-7">
                <div className="cl_blog-widget mb-30">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">Offline Video Analysis</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">Upload a video and extract keypoints with MediaPipe in the browser, then save the report to the backend.</p>
                    </div>
                  </div>

                  <div className="pose-form-grid">
                    <label className="pose-form-field">
                      <span>Video File</span>
                      <input
                        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                        onChange={(e) => handleOfflineFileChange(e.target.files?.[0] ?? null)}
                        type="file"
                      />
                    </label>

                    <label className="pose-form-field">
                      <span>View Angle</span>
                      <select value={offlineViewAngle} onChange={(e) => setOfflineViewAngle(e.target.value as 'unknown' | 'front' | 'side' | 'back')}>
                        <option value="side">Side</option>
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </label>
                  </div>

                  <label className="pose-form-field">
                    <span>Instruction</span>
                    <textarea
                      placeholder={exercise.offlineInstructionPlaceholder}
                      rows={4}
                      value={offlineInstruction}
                      onChange={(e) => setOfflineInstruction(e.target.value)}
                    />
                  </label>

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

              <div className="col-xl-5 col-lg-5">
                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-30">Task Snapshot</h4>
                  <ul className="pose-detail-list pose-detail-list-light">
                    <li>Account: {user ? `Signed in as ${user.username}` : 'Not signed in'}</li>
                    <li>Exercise: {exercise.exerciseType}</li>
                    <li>Task Status: {offlineTask?.status ?? '-'}</li>
                    <li>View Angle: {offlineTask?.view_angle ?? offlineViewAngle}</li>
                    <li>File: {offlineFile ? `${offlineFile.name} (${Math.round(offlineFile.size / 1024 / 1024)} MB)` : '-'}</li>
                  </ul>
                </div>

                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-30">Analysis Report</h4>
                  {offlineReport ? <ReportVisualization report={offlineReport} /> : <p className="pose-muted-copy">No offline analysis report yet.</p>}
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

  const safeScale = Math.min(1.15, Math.max(0.7, previewScale))
  const fitScale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * safeScale
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

function evaluateRangeCheck(feedback: RealtimeFeedback | null, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup') {
  if (!feedback) return { ok: false, reason: 'Waiting for stable tracking' }
  if (feedback.lastRepReasonLabels.length > 0) {
    return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' }
  }
  if (feedback.issues.length > 0) {
    return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' }
  }
  if (exerciseSlug === 'squat' && typeof feedback.torsoAngle === 'number' && feedback.torsoAngle < 20) {
    return { ok: false, reason: 'Excessive forward lean' }
  }
  if (exerciseSlug === 'lateral-raise' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle >= 60) {
    return { ok: true, reason: 'Raise height reached' }
  }
  if (exerciseSlug === 'pushup' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
    return { ok: true, reason: 'Push-up depth reached' }
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
            <div className="pose-report-value">{formatMetricValue(value)}</div>
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
    kneeAngleDeg: 'Knee Angle',
    hipAngleDeg: 'Hip Angle',
    torsoFromVerticalDeg: 'Torso Angle',
    kneeFlexDeg: 'Knee Flexion',
    centerY: 'Center Height'
  }
  return map[key] ?? key
}

function formatMetricValue(v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  if (v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getSessionComment(accuracyPct: number, reps: number, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup') {
  if (reps <= 0) {
    return exerciseSlug === 'lateral-raise'
      ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
      : exerciseSlug === 'pushup'
        ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
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

function buildLiveSuggestions(feedback: RealtimeFeedback | null, fallbackSuggestion: string, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup') {
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
        : 'Keep your movement controlled and maintain a stable side-view camera angle.'
    )
  }
  return Array.from(suggestions).slice(0, 4)
}

function mapSuggestionFromIssue(issue: string, exerciseSlug: 'squat' | 'lateral-raise' | 'pushup') {
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
  if (text.includes('torso lean')) return 'Brace your core and keep your chest up during the descent.'
  if (text.includes('knee') && text.includes('toes')) return 'Control knee travel and keep pressure through mid-foot and heel.'
  if (text.includes('side view')) return 'Rotate to a clearer side-view and keep your full body in frame.'
  if (text.includes('confidence') || text.includes('frame')) return 'Improve lighting and move slightly back so joints stay visible.'
  return ''
}

function createAnalyzer(exerciseSlug: 'squat' | 'lateral-raise' | 'pushup'): RealtimeAnalyzer {
  if (exerciseSlug === 'lateral-raise') return new RealtimeLateralRaiseAnalyzer()
  if (exerciseSlug === 'pushup') return new RealtimePushupAnalyzer()
  return new RealtimeSquatAnalyzer()
}

function toIssueCode(message: string) {
  return message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

