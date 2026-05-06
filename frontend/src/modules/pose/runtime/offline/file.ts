import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { PoseAnalysisReport } from '../../reporting/types'
import type { OfflineOverlayTone, OfflineProgress, OfflineReplayData } from '../types'

type UseOfflineFileHandlerArgs = {
  maxVideoBytes: number
  offlineFileInputRef: MutableRefObject<HTMLInputElement | null>
  offlineCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  offlineReplayDataRef: MutableRefObject<OfflineReplayData | null>
  offlineReplayRafRef: MutableRefObject<number | null>
  previewUrlRef: MutableRefObject<string | null>
  setOfflineFile: Dispatch<SetStateAction<File | null>>
  setOfflineReport: Dispatch<SetStateAction<PoseAnalysisReport | null>>
  setOfflineReportSessionId: Dispatch<SetStateAction<number | null>>
  setOfflineArchiveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'done' | 'failed'>>
  setOfflineLocalStatus: Dispatch<SetStateAction<'idle' | 'running' | 'succeeded' | 'failed'>>
  setOfflineRunStarted: Dispatch<SetStateAction<boolean>>
  setOfflineCompletedStep: Dispatch<SetStateAction<number>>
  setOfflineError: Dispatch<SetStateAction<string | null>>
  setOfflineStatusMsg: Dispatch<SetStateAction<string | null>>
  setOfflineProgress: Dispatch<SetStateAction<OfflineProgress>>
  setOfflineOverlayTone: Dispatch<SetStateAction<OfflineOverlayTone | null>>
  setOfflineOverlayMessage: Dispatch<SetStateAction<string | null>>
  setOfflineOverlayReady: Dispatch<SetStateAction<boolean>>
  setOfflinePreviewUrl: Dispatch<SetStateAction<string | null>>
}

/**
 * Handles offline file selection lifecycle including validation,
 * preview URL management, and transient offline-state reset.
 */
export function useOfflineFileHandler(args: UseOfflineFileHandlerArgs) {
  return useCallback(
    async (file: File | null) => {
      args.setOfflineFile(null)
      args.setOfflineReport(null)
      args.setOfflineReportSessionId(null)
      args.setOfflineArchiveStatus('idle')
      args.setOfflineLocalStatus('idle')
      args.setOfflineRunStarted(false)
      args.setOfflineCompletedStep(0)
      args.setOfflineError(null)
      args.setOfflineStatusMsg(null)
      args.setOfflineProgress(null)
      args.setOfflineOverlayTone(null)
      args.setOfflineOverlayMessage(null)
      args.setOfflineOverlayReady(false)
      args.offlineReplayDataRef.current = null
      if (args.offlineReplayRafRef.current !== null) {
        cancelAnimationFrame(args.offlineReplayRafRef.current)
        args.offlineReplayRafRef.current = null
      }
      if (args.offlineCanvasRef.current) {
        const ctx = args.offlineCanvasRef.current.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, args.offlineCanvasRef.current.width, args.offlineCanvasRef.current.height)
        delete args.offlineCanvasRef.current.dataset.lastIdx
        delete args.offlineCanvasRef.current.dataset.lastMode
        delete args.offlineCanvasRef.current.dataset.lastW
        delete args.offlineCanvasRef.current.dataset.lastH
      }
      if (args.previewUrlRef.current) {
        URL.revokeObjectURL(args.previewUrlRef.current)
        args.previewUrlRef.current = null
      }
      if (!file) {
        args.setOfflinePreviewUrl(null)
        return
      }
      if (file.size > args.maxVideoBytes) {
        args.setOfflineError('Video exceeds the 50MB limit. Please compress it and try again.')
        if (args.offlineFileInputRef.current) args.offlineFileInputRef.current.value = ''
        args.setOfflinePreviewUrl(null)
        return
      }
      const nextUrl = URL.createObjectURL(file)
      try {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.muted = true
        video.playsInline = true
        video.src = nextUrl
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => resolve()
          const onError = () => reject(new Error('Video load failed'))
          video.addEventListener('loadedmetadata', onLoaded, { once: true })
          video.addEventListener('error', onError, { once: true })
        })
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        if (!duration || duration <= 0) throw new Error('Invalid video duration')
      } catch (e: unknown) {
        args.setOfflineError(e instanceof Error ? e.message : 'Video load failed')
        if (args.offlineFileInputRef.current) args.offlineFileInputRef.current.value = ''
        URL.revokeObjectURL(nextUrl)
        args.setOfflinePreviewUrl(null)
        return
      }
      args.previewUrlRef.current = nextUrl
      args.setOfflineFile(file)
      args.setOfflinePreviewUrl(nextUrl)
    },
    [args]
  )
}


