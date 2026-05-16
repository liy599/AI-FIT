import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import { drawDistanceGuide, drawMidpointSkeleton, drawPoseJoints17 } from '../../vision/draw'
import type { MoveNetNativeFrame } from '../../vision/movenetPose'
import { computeContainViewport, findClosestTmsIndex } from '../../reporting/overlayReplay'
import type { OfflineOverlayTone, OfflineReplayData } from '../types'

type OverlayUiRef = {
  tone: OfflineOverlayTone | null
  message: string | null
  gateHint: string | null
  mainHint: string | null
  lastMainAt: number
  lastGateAt: number
  lastGateSeenAt: number
  pendingAt: number
  pendingTone: OfflineOverlayTone | null
  pendingGateHint: string | null
  pendingMainHint: string | null
}

type UseOfflineReplayOverlayParams = {
  drawMode: 'midline' | 'full17'
  drawModeRef: MutableRefObject<'midline' | 'full17'>
  offlineOverlayReady: boolean
  offlinePreviewUrl: string | null
  offlineVideoRef: MutableRefObject<HTMLVideoElement | null>
  offlineCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  offlineReplayDataRef: MutableRefObject<OfflineReplayData | null>
  offlineReplayRafRef: MutableRefObject<number | null>
  offlineOverlayUiRef: MutableRefObject<OverlayUiRef>
  offlineDrawNowRef: MutableRefObject<(() => void) | null>
  setOfflineOverlayTone: Dispatch<SetStateAction<OfflineOverlayTone | null>>
  setOfflineOverlayMessage: Dispatch<SetStateAction<string | null>>
}

export function useOfflineReplayOverlay({
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
}: UseOfflineReplayOverlayParams): void {
  useEffect(() => {
    offlineDrawNowRef.current?.()
  }, [drawMode, offlineOverlayReady, offlinePreviewUrl, offlineDrawNowRef])

  useEffect(() => {
    const video = offlineVideoRef.current
    const canvas = offlineCanvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let last = { cssW: 0, cssH: 0, dpr: 1 }

    const syncSize = () => {
      const rect = video.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      const dpr = window.devicePixelRatio || 1
      const nextCssW = Math.max(1, Math.round(rect.width))
      const nextCssH = Math.max(1, Math.round(rect.height))
      const nextW = Math.max(1, Math.round(nextCssW * dpr))
      const nextH = Math.max(1, Math.round(nextCssH * dpr))
      if (canvas.width !== nextW) canvas.width = nextW
      if (canvas.height !== nextH) canvas.height = nextH
      last = { cssW: nextCssW, cssH: nextCssH, dpr }
      return last
    }

    const clear = (metrics: { cssW: number; cssH: number; dpr: number } | null) => {
      const safe = metrics ?? syncSize()
      if (!safe) return
      ctx.setTransform(safe.dpr, 0, 0, safe.dpr, 0, 0)
      ctx.clearRect(0, 0, safe.cssW, safe.cssH)
    }

    const drawNow = () => {
      const data = offlineReplayDataRef.current
      const metrics = syncSize()
      if (!metrics || !data || !data.overlayFrames.length || !data.nativeFrames.length) {
        clear(metrics)
        if (offlineOverlayUiRef.current.tone !== null) {
          offlineOverlayUiRef.current.tone = null
          setOfflineOverlayTone(null)
        }
        if (offlineOverlayUiRef.current.message !== null) {
          offlineOverlayUiRef.current.message = null
          setOfflineOverlayMessage(null)
        }
        offlineOverlayUiRef.current.gateHint = null
        offlineOverlayUiRef.current.mainHint = null
        offlineOverlayUiRef.current.lastMainAt = 0
        offlineOverlayUiRef.current.lastGateAt = 0
        offlineOverlayUiRef.current.lastGateSeenAt = 0
        offlineOverlayUiRef.current.pendingAt = 0
        offlineOverlayUiRef.current.pendingTone = null
        offlineOverlayUiRef.current.pendingGateHint = null
        offlineOverlayUiRef.current.pendingMainHint = null
        return
      }

      const sourceW = video.videoWidth
      const sourceH = video.videoHeight
      if (!sourceW || !sourceH) {
        clear(metrics)
        return
      }
      const viewport = computeContainViewport(sourceW, sourceH, metrics.cssW, metrics.cssH)

      const tMs = Math.max(0, video.currentTime * 1000)
      const idx = findClosestTmsIndex(data.overlayFrames, tMs)
      const frame = data.overlayFrames[idx]
      const joints = data.nativeFrames[idx]?.keypoints ?? []
      const nextGateHint = typeof frame?.gateHint === 'string' ? frame?.gateHint : null
      const nextMainHint = typeof frame?.mainHint === 'string' ? frame?.mainHint : null
      const prevGateHint = offlineOverlayUiRef.current.gateHint ?? null
      const prevMainHint = offlineOverlayUiRef.current.mainHint ?? null
      const now = performance.now()

      const MAIN_REFRESH_MS = 1000
      const GATE_STICKY_MS = 5000

      if (nextGateHint) offlineOverlayUiRef.current.lastGateSeenAt = now
      const gateHint =
        nextGateHint ? nextGateHint : prevGateHint && now - (offlineOverlayUiRef.current.lastGateSeenAt || 0) < GATE_STICKY_MS ? prevGateHint : null

      const canUpdateMain = now - (offlineOverlayUiRef.current.lastMainAt || 0) >= MAIN_REFRESH_MS
      const mainHint = canUpdateMain ? nextMainHint : prevMainHint
      if (canUpdateMain && mainHint !== prevMainHint) offlineOverlayUiRef.current.lastMainAt = now
      if (gateHint !== prevGateHint) {
        offlineOverlayUiRef.current.gateHint = gateHint
        offlineOverlayUiRef.current.lastGateAt = now
      }
      if (mainHint !== prevMainHint) offlineOverlayUiRef.current.mainHint = mainHint

      const currentTone: OfflineOverlayTone = frame?.tone ?? 'ok'
      const pendingTone = offlineOverlayUiRef.current.pendingTone
      const pendingRank = pendingTone === 'bad' ? 3 : pendingTone === 'warn' ? 2 : pendingTone === 'ok' ? 1 : 0
      const currentRank = currentTone === 'bad' ? 3 : currentTone === 'warn' ? 2 : 1
      const refreshDue = now - (offlineOverlayUiRef.current.pendingAt || 0) >= MAIN_REFRESH_MS

      if (!offlineOverlayUiRef.current.pendingAt) offlineOverlayUiRef.current.pendingAt = now

      if (currentRank > pendingRank) {
        offlineOverlayUiRef.current.pendingTone = currentTone
        offlineOverlayUiRef.current.pendingGateHint = gateHint
        offlineOverlayUiRef.current.pendingMainHint = mainHint
      }

      if (refreshDue) {
        const decidedTone = offlineOverlayUiRef.current.pendingTone ?? currentTone
        const decidedGate = offlineOverlayUiRef.current.pendingGateHint ?? gateHint
        const decidedMain = offlineOverlayUiRef.current.pendingMainHint ?? mainHint
        offlineOverlayUiRef.current.pendingAt = now
        offlineOverlayUiRef.current.pendingTone = decidedTone
        offlineOverlayUiRef.current.pendingGateHint = decidedGate
        offlineOverlayUiRef.current.pendingMainHint = decidedMain

        const decidedMessage = decidedGate ? `${decidedGate}\n${decidedMain ?? ''}` : decidedMain ?? null

        if (offlineOverlayUiRef.current.tone !== decidedTone) {
          offlineOverlayUiRef.current.tone = decidedTone
          setOfflineOverlayTone(decidedTone)
        }
        if (offlineOverlayUiRef.current.message !== decidedMessage) {
          offlineOverlayUiRef.current.message = decidedMessage
          setOfflineOverlayMessage(decidedMessage)
        }

        offlineOverlayUiRef.current.pendingTone = null
        offlineOverlayUiRef.current.pendingGateHint = null
        offlineOverlayUiRef.current.pendingMainHint = null
      }

      const tone = offlineOverlayUiRef.current.tone ?? currentTone
      const message = offlineOverlayUiRef.current.message ?? null
      const distance = frame?.distance ?? null

      const nextDrawMode = drawModeRef.current
      const prevTone = offlineOverlayUiRef.current.tone
      const prevMessage = offlineOverlayUiRef.current.message
      const needsRedraw =
        (prevTone ?? '') !== tone ||
        (prevMessage ?? '') !== (message ?? '') ||
        (canvas.dataset.lastIdx ? Number(canvas.dataset.lastIdx) !== idx : true) ||
        (canvas.dataset.lastMode ? canvas.dataset.lastMode !== nextDrawMode : true) ||
        (canvas.dataset.lastW ? Number(canvas.dataset.lastW) !== metrics.cssW : true) ||
        (canvas.dataset.lastH ? Number(canvas.dataset.lastH) !== metrics.cssH : true) ||
        (canvas.dataset.lastSW ? Number(canvas.dataset.lastSW) !== sourceW : true) ||
        (canvas.dataset.lastSH ? Number(canvas.dataset.lastSH) !== sourceH : true)

      if (!needsRedraw) return
      canvas.dataset.lastIdx = String(idx)
      canvas.dataset.lastMode = nextDrawMode
      canvas.dataset.lastW = String(metrics.cssW)
      canvas.dataset.lastH = String(metrics.cssH)
      canvas.dataset.lastSW = String(sourceW)
      canvas.dataset.lastSH = String(sourceH)

      ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)
      ctx.clearRect(0, 0, metrics.cssW, metrics.cssH)
      if (distance && distance.status === 'ready' && (distance.label === 'too_close' || distance.label === 'too_far')) {
        drawDistanceGuide(ctx, distance, metrics.cssW, metrics.cssH, { mirror: false, viewport, showTarget: true })
      }
      if (nextDrawMode === 'midline') {
        drawMidpointSkeleton(
          ctx,
          joints as MoveNetNativeFrame['keypoints'],
          metrics.cssW,
          metrics.cssH,
          tone,
          { mirror: false, viewport }
        )
      } else {
        drawPoseJoints17(
          ctx,
          joints as MoveNetNativeFrame['keypoints'],
          metrics.cssW,
          metrics.cssH,
          tone,
          { mirror: false, viewport }
        )
      }
    }

    const startLoop = () => {
      if (offlineReplayRafRef.current !== null) return
      const tick = () => {
        drawNow()
        offlineReplayRafRef.current = requestAnimationFrame(tick)
      }
      offlineReplayRafRef.current = requestAnimationFrame(tick)
    }

    const stopLoop = () => {
      if (offlineReplayRafRef.current === null) return
      cancelAnimationFrame(offlineReplayRafRef.current)
      offlineReplayRafRef.current = null
    }

    const onPlay = () => startLoop()
    const onPause = () => {
      stopLoop()
      drawNow()
    }
    const onSeek = () => drawNow()
    const onMeta = () => drawNow()
    const onResize = () => drawNow()

    offlineDrawNowRef.current = drawNow
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeking', onSeek)
    video.addEventListener('seeked', onSeek)
    video.addEventListener('timeupdate', onSeek)
    video.addEventListener('loadedmetadata', onMeta)
    window.addEventListener('resize', onResize)
    drawNow()

    return () => {
      stopLoop()
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeking', onSeek)
      video.removeEventListener('seeked', onSeek)
      video.removeEventListener('timeupdate', onSeek)
      video.removeEventListener('loadedmetadata', onMeta)
      window.removeEventListener('resize', onResize)
      if (offlineDrawNowRef.current === drawNow) offlineDrawNowRef.current = null
    }
  }, [
    offlinePreviewUrl,
    drawModeRef,
    offlineVideoRef,
    offlineCanvasRef,
    offlineReplayDataRef,
    offlineReplayRafRef,
    offlineOverlayUiRef,
    offlineDrawNowRef,
    setOfflineOverlayTone,
    setOfflineOverlayMessage
  ])
}
