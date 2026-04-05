import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth-context'
import { chooseMotionStandard } from '../lib/pose/analysisSelector'
import { drawDistanceGuide, drawMidpointSkeleton } from '../lib/pose/draw'
import { DistanceTracker, type DistanceState } from '../lib/pose/distanceTracker'
import { analyzeGenericMotion } from '../lib/pose/genericMotion'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../lib/pose/livePoseProvider'
import { extractPose33FromVideoUrl } from '../lib/pose/mediapipePose'
import { buildMotionStandardCompareReport } from '../lib/pose/motionStandardCompareReport'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type TrackingState } from '../lib/pose/movenetTracker'
import { buildGenericMotionReport, type PoseAnalysisReport } from '../lib/pose/report'
import { RealtimeSquatAnalyzer, type RealtimeFeedback } from '../lib/pose/realtimeSquat'
import {
  completePoseAnalysisTask,
  createPoseAnalysisTask,
  createPoseTraining,
  createPoseVideoObjectUrl,
  failPoseAnalysisTask,
  uploadPoseVideo,
  type PoseAnalysisTask
} from '../lib/poseApi'
import { openPdfPrint } from '../lib/report/print'
import { normalizeReportForArchive, renderReportPdfBodyHtml } from '../lib/report/unified'

const LIVE_TARGET_FPS = 24
const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

type Mode = 'live' | 'offline'
type OfflineProgress = { stage: string; processed: number; total: number } | null
type PreviewOrientation = 'landscape' | 'portrait'
type PreviewSize = 's' | 'm' | 'l' | 'xl'

export default function PoseToolPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('live')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const analyzerRef = useRef<RealtimeSquatAnalyzer | null>(null)
  const stabilizerRef = useRef<MoveNetStabilizer | null>(null)
  const distanceTrackerRef = useRef<DistanceTracker | null>(null)
  const fpsRef = useRef<{ windowStart: number; frames: number }>({ windowStart: performance.now(), frames: 0 })
  const lastProcessedTsRef = useRef(0)
  const sessionStartedAtRef = useRef<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const previewScaleRef = useRef(0.86)
  const previewMirrorRef = useRef(true)

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
  const [previewOrientation, setPreviewOrientation] = useState<PreviewOrientation>('landscape')
  const [previewMirror, setPreviewMirror] = useState(true)
  const [previewSize, setPreviewSize] = useState<PreviewSize>('xl')

  const [offlineFile, setOfflineFile] = useState<File | null>(null)
  const [offlinePreviewUrl, setOfflinePreviewUrl] = useState<string | null>(null)
  const [offlineViewAngle, setOfflineViewAngle] = useState<'unknown' | 'front' | 'side' | 'back'>('side')
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
    return () => {
      cleanupRef.current?.()
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const currentSuggestion = useMemo(() => {
    if (!feedback) return '启动摄像头后，系统会给出实时动作建议。'
    return feedback.warnings[0] ?? feedback.issues[0]?.message ?? feedback.lastRepMessage ?? '保持节奏稳定，膝盖与脚尖方向一致。'
  }, [feedback])

  const rangeStatus = useMemo(() => {
    if (!distance) return '等待检测'
    if (distance.status === 'calibrating') return '距离校准中'
    if (distance.status === 'lost') return '未检测到稳定人体'
    if (distance.label === 'too_close') return '距离过近'
    if (distance.label === 'too_far') return '距离过远'
    return '距离合适'
  }, [distance])

  const rangeCheck = useMemo(() => evaluateRangeCheck(feedback), [feedback])

  const rangeStatusText = useMemo(() => {
    if (!distance) return 'Waiting for detection'
    if (distance.status === 'calibrating') return 'Calibrating distance'
    if (distance.status === 'lost') return 'Stable body not detected'
    if (distance.label === 'too_close') return 'Too close'
    if (distance.label === 'too_far') return 'Too far'
    return 'Distance OK'
  }, [distance])

  const coachingTipText = useMemo(() => {
    if (!feedback) return 'Start the camera to receive live coaching feedback.'
    return feedback.warnings[0] ?? feedback.issues[0]?.message ?? feedback.lastRepMessage ?? 'Keep a steady tempo and align your knees with your toes.'
  }, [feedback])

  const liveReport = useMemo(() => {
    const summary = feedback
      ? `实时训练：总次数 ${feedback.session.totalReps}，正确 ${feedback.session.correctReps}，准确率 ${feedback.session.accuracyPct}%`
      : '尚未生成实时训练数据'
    return normalizeReportForArchive({
      version: 1,
      status: 'ok',
      tool: 'pose-live',
      generatedAt: new Date().toISOString(),
      summary,
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
      issues: feedback?.issues?.map((x) => x.message) ?? []
    })
  }, [currentSuggestion, effectiveFps, feedback])

  async function startLive() {
    setError(null)
    setLoading(true)
    setLoadingMsg('正在初始化模型与摄像头...')
    setSaveTrainingMsg(null)

    let provider: RealtimePoseProvider | null = null
    try {
      if (!analyzerRef.current) analyzerRef.current = new RealtimeSquatAnalyzer()
      if (!stabilizerRef.current) stabilizerRef.current = new MoveNetStabilizer(2500)
      if (!distanceTrackerRef.current) distanceTrackerRef.current = new DistanceTracker(3000)

      provider = await createBestRealtimePoseProvider()
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
      if (!video || !canvas) throw new Error('预览区域初始化失败')

      video.srcObject = stream
      await video.play()
      canvas.width = video.videoWidth || 720
      canvas.height = video.videoHeight || 1280

      sessionStartedAtRef.current = new Date().toISOString()
      fpsRef.current = { windowStart: performance.now(), frames: 0 }
      lastProcessedTsRef.current = 0
      setRunning(true)
      setLoading(false)
      setLoadingMsg(null)

      let cancelled = false
      cleanupRef.current = () => {
        cancelled = true
        provider?.close()
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
        drawCameraFrame(ctx, videoEl, canvasEl.width, canvasEl.height, previewScaleRef.current, previewMirrorRef.current)

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
                nextFeedback.issues.length > 0 ? 'bad' : 'ok'
              )
            }
            drawDistanceGuide(ctx, distanceState, canvasEl.width, canvasEl.height)
          } else {
            setTracking(null)
            setDistance(null)
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : '实时检测失败')
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
      provider?.close()
      setLoading(false)
      setLoadingMsg(null)
      setRunning(false)
      setError(e instanceof Error ? e.message : '无法打开摄像头')
    }
  }

  function stopLive() {
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
  }

  function resetLiveSession() {
    analyzerRef.current?.resetSession()
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
    sessionStartedAtRef.current = running ? new Date().toISOString() : sessionStartedAtRef.current
  }

  function exportJson(name: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf(title: string, data: Record<string, unknown>) {
    const body = renderReportPdfBodyHtml(data, {
      title,
      nowText: new Date().toLocaleString('zh-CN')
    })
    openPdfPrint(title, body)
  }

  async function saveTrainingRecord() {
    if (!user) {
      setSaveTrainingMsg('登录后才能保存训练记录。')
      return
    }
    const reps = feedback?.session.totalReps ?? 0
    if (reps <= 0) {
      setSaveTrainingMsg('当前没有可保存的训练次数。')
      return
    }

    setSavingTraining(true)
    setSaveTrainingMsg(null)
    try {
      const session = await createPoseTraining({
        started_at: sessionStartedAtRef.current ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        exercise_type: 'squat',
        note: 'Saved from live pose coaching',
        sets: [{ reps, note: coachingTipText }],
        report: liveReport as Record<string, unknown>
      })
      setSaveTrainingMsg(`已保存训练记录 #${session.id}`)
    } catch (e: unknown) {
      setSaveTrainingMsg(e instanceof Error ? e.message : '训练记录保存失败')
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
      setOfflineError('登录后才能上传视频并保存分析任务。')
      return
    }
    if (!offlineFile) {
      setOfflineError('请先选择视频文件。')
      return
    }
    if (offlineFile.size > MAX_VIDEO_BYTES) {
      setOfflineError('视频超过 80MB 限制，请压缩后重试。')
      return
    }

    setOfflineBusy(true)
    setOfflineError(null)
    setOfflineReport(null)
    setOfflineStatusMsg(null)
    setOfflineProgress({ stage: '上传视频', processed: 0, total: 1 })

    let taskId: number | null = null
    let serverObjectUrl: string | null = null

    try {
      const video = await uploadPoseVideo(offlineFile)
      setOfflineStatusMsg('视频已上传，正在创建分析任务。')
      setOfflineProgress({ stage: '创建任务', processed: 1, total: 1 })

      const task = await createPoseAnalysisTask({
        video_asset_id: video.id,
        exercise_type: 'squat',
        view_angle: offlineViewAngle,
        instruction: offlineInstruction.trim() || undefined
      })
      taskId = task.id
      setOfflineTask(task)

      serverObjectUrl = await createPoseVideoObjectUrl(video)
      const extracted = await extractPose33FromVideoUrl(serverObjectUrl, {
        onProgress: (p) => {
          setOfflineProgress({
            stage: p.stage === 'loading' ? '加载 MediaPipe 模型' : '提取姿态关键点',
            processed: p.processed,
            total: p.total
          })
        }
      })

      const standard = chooseMotionStandard({ viewAngle: offlineViewAngle, exerciseName: 'squat' })
      setOfflineProgress({ stage: standard ? '标准模板对比' : '通用动作分析', processed: 1, total: 1 })

      const report = standard
        ? buildMotionStandardCompareReport({
            taskId: String(task.id),
            viewAngle: offlineViewAngle,
            instruction: offlineInstruction.trim() || null,
            exercise: { id: 'squat', name: 'squat' },
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
            exercise: { id: 'squat', name: 'squat' },
            video: {
              id: String(video.id),
              originalName: video.original_name,
              mimeType: video.mime_type,
              sizeBytes: video.size_bytes
            },
            fps: extracted.fps,
            analysis: analyzeGenericMotion(extracted.frames)
          })

      setOfflineProgress({ stage: '回写分析结果', processed: 1, total: 1 })
      const completed = await completePoseAnalysisTask(task.id, report as unknown as Record<string, unknown>)
      setOfflineTask(completed)
      setOfflineReport(report)
      setOfflineStatusMsg('离线分析完成，结果已回写后端。')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '离线分析失败'
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
                    <span>Pose</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="pose-mode-switch mb-30">
            <button className={mode === 'live' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'} onClick={() => setMode('live')} type="button">
              实时纠错
            </button>
            <button className={mode === 'offline' ? 'cl_theme-btn' : 'pose-tool-ghost-btn pose-tool-light-btn'} onClick={() => setMode('offline')} type="button">
              离线视频分析
            </button>
          </div>

          {mode === 'live' ? (
            <div className="row">
              <div className="col-xl-7 col-lg-7">
                <div className="cl_blog-widget mb-30 pose-camera-panel">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">Realtime Camera</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">在当前 AI-FIT 工具页风格基础上扩展实时动作纠错能力。</p>
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

                  <div className="pose-camera-toolbar">
                    <div className="pose-orientation-switch">
                      <button
                        className={previewOrientation === 'landscape' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                        onClick={() => setPreviewOrientation('landscape')}
                        type="button"
                      >
                        横屏
                      </button>
                      <button
                        className={previewOrientation === 'portrait' ? 'cl_theme-btn pose-mini-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-mini-btn'}
                        onClick={() => setPreviewOrientation('portrait')}
                        type="button"
                      >
                        竖屏
                      </button>
                    </div>
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
                    <div className="pose-camera-toolbar__group">
                      <span className="pose-camera-toolbar__label">Size</span>
                      <div className="pose-size-switch">
                        {(['s', 'm', 'l', 'xl'] as const).map((item) => (
                          <button
                            key={item}
                            className={previewSize === item ? 'cl_theme-btn pose-size-btn' : 'pose-tool-ghost-btn pose-tool-light-btn pose-size-btn'}
                            onClick={() => setPreviewSize(item)}
                            type="button"
                          >
                            {item.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="pose-slider-control">
                      <span>画面缩放</span>
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
                    <span className="pose-camera-toolbar__hint">调低可显示更完整的人体，适合全身入镜。</span>
                  </div>

                  <div
                    className={`pose-stage ${previewOrientation === 'portrait' ? 'pose-stage-portrait' : 'pose-stage-landscape'} pose-stage-size-${previewSize}`}
                  >
                    <video ref={videoRef} autoPlay playsInline muted className="pose-stage-media pose-stage-video-hidden" />
                    <canvas ref={canvasRef} className="pose-stage-media pose-stage-canvas" />
                    {!running ? <div className="pose-stage-overlay">{loadingMsg ?? '点击 Start 开始实时动作检测'}</div> : null}
                  </div>

                  <div className="pose-meta-row pose-meta-row-light">
                    <span className="pose-status-tag pose-status-tag-light">{running ? 'Live' : 'Idle'}</span>
                    <span>Model: MoveNet Lightning</span>
                    <span>FPS: {effectiveFps ?? '-'}</span>
                    <span>Tracking: {tracking?.status ?? '-'}</span>
                    <span>Phase: {feedback?.phase ?? '-'}</span>
                  </div>

                  {error ? <div className="pose-error-box">{error}</div> : null}
                </div>
              </div>

              <div className="col-xl-5 col-lg-5">
                <div className="cl_blog-widget mb-30 pose-live-feedback">
                  <h4 className="cl_blog-widget-title mb-30">Live Feedback</h4>
                  <div className="pose-kpi-grid pose-kpi-grid-light">
                    <MetricCard label="Rep Count" value={feedback?.repCount ?? 0} />
                    <MetricCard label="Accuracy" value={feedback?.session.accuracyPct ?? 0} unit="%" />
                    <MetricCard label="Knee Angle" value={feedback?.kneeAngle ?? '-'} unit={feedback?.kneeAngle ? '°' : ''} />
                    <MetricCard label="Hip Angle" value={feedback?.hipAngle ?? '-'} unit={feedback?.hipAngle ? '°' : ''} />
                    <MetricCard label="Torso Angle" value={feedback?.torsoAngle ?? '-'} unit={feedback?.torsoAngle ? '°' : ''} />
                  </div>

                  <div className="pose-tip-card pose-tip-card-light">
                    <h6 className="sub-title mb-15 pose-section-title">纠错建议</h6>
                    <p>{currentSuggestion}</p>
                  </div>

                  <div className="pose-tip-card pose-tip-card-light">
                    <h6 className="sub-title mb-15 pose-section-title">状态信息</h6>
                    <ul className="pose-detail-list pose-detail-list-light">
                      <li>距离状态：{rangeStatus}</li>
                      <li>跟踪质量：{feedback ? `${Math.round(feedback.trackingQuality * 100)}%` : '-'}</li>
                      <li>正确次数：{feedback?.correctCount ?? 0}</li>
                      <li>最近结果：{feedback?.lastRepResult ?? '-'}</li>
                    </ul>
                  </div>

                  <div style={{ display: 'none' }}>
                  <div className="pose-tip-card pose-tip-card-light" style={{ display: 'none' }}>
                    <h6 className="sub-title mb-15 pose-section-title">Range Check</h6>
                    <div className="pose-range-check">
                      <span className={rangeCheck.ok ? 'pose-range-badge pose-range-badge-ok' : 'pose-range-badge pose-range-badge-bad'}>
                        {rangeCheck.ok ? 'In range' : 'Out of range'}
                      </span>
                      <span>{rangeCheck.reason}</span>
                    </div>
                    <p className="pose-range-copy">Frames in last rep: {feedback?.lastRepFrameCount ?? '-'}</p>
                    <MetricCard label="Side Offset" value={feedback?.offsetAngle ?? '-'} unit={feedback?.offsetAngle ? '°' : ''} />
                  </div>

                  </div>

                  <div className="pose-tip-card pose-tip-card-light" style={{ display: 'none' }}>
                    <h6 className="sub-title mb-15 pose-section-title">Range Check</h6>
                    <div className="pose-range-check">
                      <span className={rangeCheck.ok ? 'pose-range-badge pose-range-badge-ok' : 'pose-range-badge pose-range-badge-bad'}>
                        {rangeCheck.ok ? 'In range' : 'Out of range'}
                      </span>
                      <span>{rangeCheck.reason}</span>
                    </div>
                    <p className="pose-range-copy">Frames in last rep: {feedback?.lastRepFrameCount ?? '-'}</p>
                  </div>

                  <div className="pose-tip-card pose-tip-card-light">
                    <h6 className="sub-title mb-15 pose-section-title">Coaching Tip</h6>
                    <p>{coachingTipText}</p>
                  </div>

                  <div className="pose-tip-card pose-tip-card-light">
                    <h6 className="sub-title mb-15 pose-section-title">Status</h6>
                    <ul className="pose-detail-list pose-detail-list-light">
                      <li>Distance: {rangeStatusText}</li>
                      <li>Tracking Quality: {feedback ? `${Math.round(feedback.trackingQuality * 100)}%` : '-'}</li>
                      <li>Correct Reps: {feedback?.correctCount ?? 0}</li>
                      <li>Last Result: {feedback?.lastRepResult ?? '-'}</li>
                    </ul>
                  </div>

                  <div className="pose-export-row">
                    <button className="pose-tool-ghost-btn pose-tool-light-btn" onClick={() => exportJson('pose-live-report', liveReport)} type="button">
                      Export JSON
                    </button>
                    <button className="pose-tool-ghost-btn pose-tool-light-btn" onClick={() => exportPdf('AI-FIT Pose Realtime Report', liveReport as Record<string, unknown>)} type="button">
                      Export PDF
                    </button>
                    <button className="pose-tool-ghost-btn pose-tool-light-btn" disabled={savingTraining} onClick={() => void saveTrainingRecord()} type="button">
                      {savingTraining ? 'Saving...' : '保存训练记录'}
                    </button>
                  </div>

                  {saveTrainingMsg ? <div className="pose-inline-note">{saveTrainingMsg}</div> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-xl-7 col-lg-7">
                <div className="cl_blog-widget mb-30">
                  <div className="pose-tool-head">
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">Offline Video Analysis</h4>
                      <p className="pose-tool-subtitle pose-tool-subtitle-dark">上传视频后，前端使用 MediaPipe 提取关键点，完成分析后回写到新后端接口。</p>
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
                      placeholder="例如：关注深蹲底部稳定性和躯干前倾"
                      rows={4}
                      value={offlineInstruction}
                      onChange={(e) => setOfflineInstruction(e.target.value)}
                    />
                  </label>

                  <div className="pose-export-row">
                    <button className="cl_theme-btn" disabled={offlineBusy} onClick={() => void runOfflineAnalysis()} type="button">
                      {offlineBusy ? 'Analyzing...' : '上传并开始分析'}
                    </button>
                    <button
                      className="pose-tool-ghost-btn pose-tool-light-btn"
                      disabled={!offlineReport}
                      onClick={() => offlineReport && exportJson('pose-offline-report', offlineReport)}
                      type="button"
                    >
                      Export JSON
                    </button>
                    <button
                      className="pose-tool-ghost-btn pose-tool-light-btn"
                      disabled={!offlineReport}
                      onClick={() => offlineReport && exportPdf('AI-FIT Pose Offline Report', offlineReport as unknown as Record<string, unknown>)}
                      type="button"
                    >
                      Export PDF
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
                    <li>登录状态：{user ? `已登录 ${user.username}` : '未登录'}</li>
                    <li>当前动作：squat</li>
                    <li>任务状态：{offlineTask?.status ?? '-'}</li>
                    <li>视角：{offlineTask?.view_angle ?? offlineViewAngle}</li>
                    <li>文件：{offlineFile ? `${offlineFile.name} (${Math.round(offlineFile.size / 1024 / 1024)} MB)` : '-'}</li>
                  </ul>
                </div>

                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-30">Analysis Report</h4>
                  {offlineReport ? <ReportVisualization report={offlineReport} /> : <p className="pose-muted-copy">尚未生成离线分析报告。</p>}
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
  if (!sourceWidth || !sourceHeight) return

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
}

function evaluateRangeCheck(feedback: RealtimeFeedback | null) {
  if (!feedback) return { ok: false, reason: 'Waiting for stable tracking' }
  if (feedback.lastRepReasonLabels.length > 0) {
    return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' }
  }
  if (feedback.issues.length > 0) {
    return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' }
  }
  if (typeof feedback.torsoAngle === 'number' && feedback.torsoAngle < 20) {
    return { ok: false, reason: 'Excessive forward lean' }
  }
  if (typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
    return { ok: true, reason: 'Depth reached' }
  }
  return { ok: true, reason: 'Current rep is in range' }
}

function MetricCard(props: { label: string; value: string | number; unit?: string }) {
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
        <div className="pose-report-title">分析摘要</div>
        <div>{typeof report.summary === 'string' ? report.summary : '无摘要'}</div>
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
          <div className="pose-report-title">问题列表</div>
          {issues.length === 0 ? <div className="pose-muted-copy">未检测到明显问题</div> : null}
          <div className="pose-report-issue-list">
            {issues.map((issue, index) => (
              <div key={index} className="pose-report-issue">
                <strong>{String(issue.message ?? issue.code ?? 'Issue')}</strong>
                <span>
                  {String(issue.severity ?? '-')}
                  {typeof issue.atFrame === 'number' ? ` · frame ${issue.atFrame}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pose-report-card">
          <div className="pose-report-title">改进建议</div>
          {suggestions.length === 0 ? <div className="pose-muted-copy">暂无建议</div> : null}
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
      <div className="pose-report-title">关键时间线</div>
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
    reps: '次数',
    repEstimate: '估计次数',
    fps: 'FPS',
    standardId: '模板 ID',
    standardName: '模板名称',
    extractedFrames: '提取帧数',
    comparableFrames: '可对比帧',
    avgScore: '平均评分',
    minScore: '最低评分',
    maxScore: '最高评分',
    badFramePct: '异常帧占比',
    coverage: '可见率',
    stabilityScore: '稳定性',
    mobilityScore: '活动范围',
    rhythmScore: '节奏一致性',
    symmetryScore: '对称性',
    kneeAngleDeg: '膝关节角度',
    hipAngleDeg: '髋关节角度',
    torsoFromVerticalDeg: '躯干角度',
    kneeFlexDeg: '膝屈角',
    centerY: '重心高度'
  }
  return map[key] ?? key
}

function formatMetricValue(v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  if (v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
