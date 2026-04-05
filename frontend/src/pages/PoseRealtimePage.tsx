import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { drawDistanceGuide, drawMidpointSkeleton } from '../lib/pose/draw'
import { DistanceTracker, type DistanceState } from '../lib/pose/distanceTracker'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '../lib/pose/livePoseProvider'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type TrackingState } from '../lib/pose/movenetTracker'
import { RealtimeSquatAnalyzer, type RealtimeFeedback } from '../lib/pose/realtimeSquat'
import { openPdfPrint } from '../lib/report/print'
import { normalizeReportForArchive, renderReportPdfBodyHtml } from '../lib/report/unified'

const LIVE_TARGET_FPS = 24
const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS

export default function PoseRealtimePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const analyzerRef = useRef<RealtimeSquatAnalyzer | null>(null)
  const stabilizerRef = useRef<MoveNetStabilizer | null>(null)
  const distanceTrackerRef = useRef<DistanceTracker | null>(null)
  const fpsRef = useRef<{ windowStart: number; frames: number }>({ windowStart: performance.now(), frames: 0 })
  const lastProcessedTsRef = useRef(0)

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null)
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [distance, setDistance] = useState<DistanceState | null>(null)
  const [effectiveFps, setEffectiveFps] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      const v = videoRef.current
      const stream = v?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
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

  const report = useMemo(() => {
    const summary = feedback
      ? `实时训练：总次数 ${feedback.session.totalReps}，正确 ${feedback.session.correctReps}，准确率 ${feedback.session.accuracyPct}%`
      : '尚未生成实时训练数据'
    return normalizeReportForArchive({
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

  async function start() {
    setError(null)
    setLoading(true)
    setLoadingMsg('正在初始化模型与摄像头...')

    let provider: RealtimePoseProvider | null = null
    try {
      if (!analyzerRef.current) analyzerRef.current = new RealtimeSquatAnalyzer()
      if (!stabilizerRef.current) stabilizerRef.current = new MoveNetStabilizer(2500)
      if (!distanceTrackerRef.current) distanceTrackerRef.current = new DistanceTracker(3000)

      provider = await createBestRealtimePoseProvider()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 1280 },
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
          requestAnimationFrame(() => {
            void tick()
          })
          return
        }
        lastProcessedTsRef.current = frameTs

        const videoEl = videoRef.current
        const canvasEl = canvasRef.current
        const ctx = canvasEl.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

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
        if (frameTs - bucket.windowStart >= 1000) {
          setEffectiveFps(bucket.frames)
          fpsRef.current = { windowStart: frameTs, frames: 0 }
        } else {
          bucket.frames += 1
        }

        requestAnimationFrame(() => {
          void tick()
        })
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

  function stop() {
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

  function resetSession() {
    analyzerRef.current?.resetSession()
    setFeedback(null)
    setError(null)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pose-live-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const title = 'AI-FIT Pose Realtime Report'
    const body = renderReportPdfBodyHtml(report as Record<string, unknown>, {
      title,
      nowText: new Date().toLocaleString('zh-CN')
    })
    openPdfPrint(title, body)
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
          <div className="row">
            <div className="col-xl-7 col-lg-7">
              <div className="cl_blog-widget mb-30">
                <div className="pose-tool-head">
                  <div>
                    <h4 className="cl_blog-widget-title mb-15">Realtime Camera</h4>
                    <p className="pose-tool-subtitle">在当前 AI-FIT 工具页风格基础上扩展实时动作纠错能力。</p>
                  </div>
                  <div className="pose-tool-actions">
                    <button className="cl_theme-btn" onClick={() => void (running ? stop() : start())} type="button">
                      {running ? 'Stop' : loading ? 'Loading...' : 'Start'}
                    </button>
                    <button className="pose-tool-ghost-btn" onClick={resetSession} type="button">
                      Reset
                    </button>
                  </div>
                </div>

                <div className="pose-stage">
                  <video ref={videoRef} autoPlay playsInline muted className="pose-stage-media" />
                  <canvas ref={canvasRef} className="pose-stage-media pose-stage-canvas" />
                  {!running ? <div className="pose-stage-overlay">{loadingMsg ?? '点击 Start 开始实时动作检测'}</div> : null}
                </div>

                <div className="pose-meta-row">
                  <span className="pose-status-tag">{running ? 'Live' : 'Idle'}</span>
                  <span>Model: MoveNet Lightning</span>
                  <span>FPS: {effectiveFps ?? '-'}</span>
                  <span>Tracking: {tracking?.status ?? '-'}</span>
                </div>

                {error ? <div className="pose-error-box">{error}</div> : null}
              </div>
            </div>

            <div className="col-xl-5 col-lg-5">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Realtime Analysis</h4>
                <div className="pose-kpi-grid">
                  <MetricCard label="Reps" value={feedback?.repCount ?? 0} />
                  <MetricCard label="Knee Angle" value={feedback?.kneeAngle ?? '-'} unit={feedback?.kneeAngle ? '°' : ''} />
                  <MetricCard label="Hip Angle" value={feedback?.hipAngle ?? '-'} unit={feedback?.hipAngle ? '°' : ''} />
                  <MetricCard label="Torso Angle" value={feedback?.torsoAngle ?? '-'} unit={feedback?.torsoAngle ? '°' : ''} />
                </div>

                <div className="pose-tip-card">
                  <h6 className="sub-title mb-15">纠错建议</h6>
                  <p>{currentSuggestion}</p>
                </div>

                <div className="pose-tip-card">
                  <h6 className="sub-title mb-15">状态信息</h6>
                  <ul className="pose-detail-list">
                    <li>距离状态：{rangeStatus}</li>
                    <li>跟踪质量：{feedback ? `${Math.round(feedback.trackingQuality * 100)}%` : '-'}</li>
                    <li>正确次数：{feedback?.correctCount ?? 0}</li>
                    <li>最近结果：{feedback?.lastRepResult ?? '-'}</li>
                  </ul>
                </div>

                <div className="pose-export-row">
                  <button className="pose-tool-ghost-btn" onClick={exportJson} type="button">
                    Export JSON
                  </button>
                  <button className="pose-tool-ghost-btn" onClick={exportPdf} type="button">
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function MetricCard(props: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="pose-metric-card">
      <span className="pose-metric-label">{props.label}</span>
      <strong className="pose-metric-value">
        {props.value}
        {props.unit ?? ''}
      </strong>
    </div>
  )
}
