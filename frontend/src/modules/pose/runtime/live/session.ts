import type { MutableRefObject } from 'react'
import { DistanceTracker, type DistanceState } from '../../vision/distanceTracker'
import type { RealtimePoseProvider } from '../../vision/livePoseProvider'
import { MoveNetStabilizer, type TrackingState } from '../../vision/movenetTracker'
import type { RealtimeFeedback } from '../../analyzer/types'
import { requestCameraStream } from '../../../../lib/media'
import type { RealtimeAnalyzer, SquatRepFinding, SquatTimelineRow } from '../../helpers'
import { drawCameraFrame } from '../../reporting/overlayReplay'
import { recordLiveFrameStats } from './stats'
import { drawLivePoseOverlay } from './overlay'

type StartLiveDetectionSessionArgs = {
  exerciseSlug: string
  provider: RealtimePoseProvider
  analyzer: RealtimeAnalyzer
  videoRef: MutableRefObject<HTMLVideoElement | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  stabilizerRef: MutableRefObject<MoveNetStabilizer | null>
  distanceTrackerRef: MutableRefObject<DistanceTracker | null>
  fpsRef: MutableRefObject<{ windowStart: number; frames: number }>
  lastProcessedTsRef: MutableRefObject<number>
  sessionStartedAtRef: MutableRefObject<string | null>
  sessionStartedPerfRef: MutableRefObject<number | null>
  previewScaleRef: MutableRefObject<number>
  drawModeRef: MutableRefObject<'midline' | 'full17'>
  liveTargetFrameMs: number
  issueFreqRef: MutableRefObject<Map<string, number>>
  trackingQualitySamplesRef: MutableRefObject<number[]>
  timelineRowsRef: MutableRefObject<SquatTimelineRow[]>
  repFindingsRef: MutableRefObject<SquatRepFinding[]>
  lastRepCountRef: MutableRefObject<number>
  analyzedFrameCountRef: MutableRefObject<number>
  onFeedback: (feedback: RealtimeFeedback | null) => void
  onTracking: (tracking: TrackingState | null) => void
  onDistance: (distance: DistanceState | null) => void
  onEffectiveFps: (fps: number) => void
  onDetectionError: (error: unknown) => void
}

// Owns camera setup and the requestAnimationFrame detection loop. The page keeps
// user-facing state, while this module owns the realtime IO pipeline.
export async function startLiveDetectionSession(args: StartLiveDetectionSessionArgs) {
  if (!args.stabilizerRef.current) args.stabilizerRef.current = new MoveNetStabilizer(2500)
  if (!args.distanceTrackerRef.current) args.distanceTrackerRef.current = new DistanceTracker(5000)

  const stream = await requestCameraStream({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user'
    },
    audio: false
  })

  const video = args.videoRef.current
  const canvas = args.canvasRef.current
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

  args.sessionStartedAtRef.current = new Date().toISOString()
  args.sessionStartedPerfRef.current = performance.now()
  args.fpsRef.current = { windowStart: performance.now(), frames: 0 }
  args.lastProcessedTsRef.current = 0

  let cancelled = false
  const tick = async () => {
    if (cancelled || !args.videoRef.current || !args.canvasRef.current) return
    const frameTs = performance.now()
    if (frameTs - args.lastProcessedTsRef.current < args.liveTargetFrameMs) {
      requestAnimationFrame(() => void tick())
      return
    }
    args.lastProcessedTsRef.current = frameTs

    const videoEl = args.videoRef.current
    const canvasEl = args.canvasRef.current
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
    const viewport = drawCameraFrame(ctx, videoEl, canvasEl.width, canvasEl.height, args.previewScaleRef.current, true)

    try {
      const detected = await args.provider.detect(videoEl, frameTs)
      const nativeKeypoints = detected.nativeKeypoints
      const hasNative = !!nativeKeypoints && nativeKeypoints.length > 0
      const stabilizer = args.stabilizerRef.current
      const distanceTracker = args.distanceTrackerRef.current
      if (hasNative && stabilizer && distanceTracker) {
        const nextFeedback = args.analyzer.analyzeNative(nativeKeypoints)
        args.onFeedback(nextFeedback)
        recordLiveFrameStats({
          exerciseSlug: args.exerciseSlug,
          feedback: nextFeedback,
          frameTs,
          liveTargetFrameMs: args.liveTargetFrameMs,
          sessionStartedPerf: args.sessionStartedPerfRef.current,
          issueFreqRef: args.issueFreqRef,
          trackingQualitySamplesRef: args.trackingQualitySamplesRef,
          timelineRowsRef: args.timelineRowsRef,
          repFindingsRef: args.repFindingsRef,
          lastRepCountRef: args.lastRepCountRef,
          analyzedFrameCountRef: args.analyzedFrameCountRef
        })

        const trackingState = stabilizer.ingest({ tMs: frameTs, keypoints: nativeKeypoints })
        args.onTracking(trackingState)
        const distanceState = distanceTracker.ingest({ tMs: frameTs, keypoints: nativeKeypoints })
        args.onDistance(distanceState)
        drawLivePoseOverlay({
          ctx,
          canvasWidth: canvasEl.width,
          canvasHeight: canvasEl.height,
          feedback: nextFeedback,
          trackingState,
          distanceState,
          drawMode: args.drawModeRef.current,
          viewport
        })
      } else {
        args.onTracking(null)
        args.onDistance(null)
      }
    } catch (e: unknown) {
      args.onDetectionError(e)
    }

    const bucket = args.fpsRef.current
    bucket.frames += 1
    if (frameTs - bucket.windowStart >= 1000) {
      args.onEffectiveFps(bucket.frames)
      args.fpsRef.current = { windowStart: frameTs, frames: 0 }
    }

    requestAnimationFrame(() => void tick())
  }

  void tick()
  return () => {
    cancelled = true
  }
}

