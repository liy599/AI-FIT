import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import { drawMidpointSkeleton, drawPoseJoints17, type MoveNetNativeFrame } from '../../pose'
import { computeContainViewport, findClosestTmsIndex } from './replay'
import type { OfflineOverlayFrame, OfflineOverlayTone, OfflineReplayData, PoseToolMode } from './types'

type OverlayUiRef = { tone: OfflineOverlayTone | null; message: string | null }

type UseOfflineReplayOverlayParams = {
  mode: PoseToolMode
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
}: UseOfflineReplayOverlayParams): void {
  useEffect(() => {
    offlineDrawNowRef.current?.()
  }, [drawMode, offlineOverlayReady, offlinePreviewUrl, mode, offlineDrawNowRef])

  useEffect(() => {
    if (mode !== 'offline') return
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
      const tone = frame?.tone ?? 'ok'
      const message = frame?.message ?? null

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

      if (offlineOverlayUiRef.current.tone !== tone) {
        offlineOverlayUiRef.current.tone = tone
        setOfflineOverlayTone(tone)
      }
      if (offlineOverlayUiRef.current.message !== message) {
        offlineOverlayUiRef.current.message = message
        setOfflineOverlayMessage(message)
      }

      if (!needsRedraw) return
      canvas.dataset.lastIdx = String(idx)
      canvas.dataset.lastMode = nextDrawMode
      canvas.dataset.lastW = String(metrics.cssW)
      canvas.dataset.lastH = String(metrics.cssH)
      canvas.dataset.lastSW = String(sourceW)
      canvas.dataset.lastSH = String(sourceH)

      ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)
      ctx.clearRect(0, 0, metrics.cssW, metrics.cssH)
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
    mode,
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

