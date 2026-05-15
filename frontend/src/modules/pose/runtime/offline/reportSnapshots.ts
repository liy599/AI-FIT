import type { PoseAnalysisReport } from '../../reporting/types'
import type { OfflineReplayData, OfflineOverlayTone } from '../types'
import { findClosestTmsIndex } from '../../reporting/overlayReplay'
import { drawPoseJoints17 } from '../../vision/draw'
import type { MoveNetNativeFrame } from '../../vision/movenetPose'

type SnapshotOptions = {
  maxSide: number
  jpegQuality: number
  maxSnapshots: number
}

type AttachSnapshotsArgs = {
  report: PoseAnalysisReport
  offlineFile: File
  replayData: OfflineReplayData | null
  options?: Partial<SnapshotOptions>
  onProgress?: (processed: number, total: number) => void
}

type RepFindingRecord = Record<string, unknown>

export async function attachRepFindingSnapshots(args: AttachSnapshotsArgs): Promise<PoseAnalysisReport> {
  const details = isRecord(args.report.details) ? (args.report.details as Record<string, unknown>) : null
  const repFindings = details && Array.isArray(details.repFindings) ? details.repFindings.filter(isRecord) : []
  if (!details || repFindings.length === 0 || !args.replayData) return args.report

  const options: SnapshotOptions = {
    maxSide: args.options?.maxSide ?? 360,
    jpegQuality: args.options?.jpegQuality ?? 0.72,
    maxSnapshots: args.options?.maxSnapshots ?? 12
  }

  const { video, cleanup } = await prepareVideo(args.offlineFile)
  try {
    await ensureVideoMetadata(video)
    const sourceW = video.videoWidth
    const sourceH = video.videoHeight
    if (!sourceW || !sourceH) return args.report

    const { canvas, ctx, width, height } = createSnapshotCanvas({ sourceW, sourceH, maxSide: options.maxSide })
    const nextRepFindings: RepFindingRecord[] = []
    let snapshotCount = 0
    for (let i = 0; i < repFindings.length; i++) {
      const finding = repFindings[i]!
      const snapshotDataUrlExisting = typeof finding.snapshotDataUrl === 'string' ? finding.snapshotDataUrl : null
      const tMs = asNumber(finding.tMs)
      const result = String(finding.result ?? 'invalid')
      const eligible = result !== 'correct' && snapshotCount < options.maxSnapshots
      if (tMs === null || !eligible) {
        nextRepFindings.push(finding)
        continue
      }
      if (snapshotDataUrlExisting) {
        nextRepFindings.push(finding)
        snapshotCount += 1
        if (args.onProgress) args.onProgress(snapshotCount, options.maxSnapshots)
        continue
      }
      const idx = findClosestTmsIndex(args.replayData.overlayFrames, tMs)
      const joints = (args.replayData.nativeFrames[idx]?.keypoints ?? []) as MoveNetNativeFrame['keypoints']
      const tone = args.replayData.overlayFrames[idx]?.tone ?? 'ok'

      try {
        await seekVideo(video, tMs / 1000)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(video, 0, 0, width, height)
        if (joints.length > 0) drawPoseJoints17(ctx, joints, width, height, toneToColor(tone), { mirror: false })
        const dataUrl = canvas.toDataURL('image/jpeg', options.jpegQuality)
        nextRepFindings.push({ ...finding, snapshotDataUrl: dataUrl })
        snapshotCount += 1
      } catch {
        nextRepFindings.push(finding)
      }
      if (args.onProgress) args.onProgress(snapshotCount, options.maxSnapshots)
    }

    const nextDetails = { ...details, repFindings: nextRepFindings }
    return { ...args.report, details: nextDetails }
  } finally {
    cleanup()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

function toneToColor(tone: OfflineOverlayTone): 'ok' | 'warn' | 'bad' {
  return tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'ok'
}

function createSnapshotCanvas(args: { sourceW: number; sourceH: number; maxSide: number }) {
  const scale = Math.min(args.maxSide / Math.max(1, args.sourceW), args.maxSide / Math.max(1, args.sourceH), 1)
  const width = Math.max(1, Math.round(args.sourceW * scale))
  const height = Math.max(1, Math.round(args.sourceH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  return { canvas, ctx, width, height }
}

async function prepareVideo(file: File) {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const cleanup = () => URL.revokeObjectURL(objectUrl)
  return { video, cleanup }
}

async function ensureVideoMetadata(video: HTMLVideoElement) {
  if (video.readyState >= 1 && video.videoWidth && video.videoHeight) return
  await new Promise<void>((resolve, reject) => {
    const onMeta = () => resolve()
    const onError = () => reject(new Error('Video load failed'))
    video.addEventListener('loadedmetadata', onMeta, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.load()
  })
}

async function waitForPresentedFrame(video: HTMLVideoElement, ms: number) {
  const v = video as unknown as {
    requestVideoFrameCallback?: (cb: (now: number, meta?: { mediaTime?: number }) => void) => number
  }
  const rvfc = v.requestVideoFrameCallback
  if (typeof rvfc === 'function') {
    await new Promise<void>((resolve) => {
      const id = window.setTimeout(() => resolve(), Math.max(0, ms))
      try {
        rvfc(() => {
          window.clearTimeout(id)
          resolve()
        })
      } catch {
        window.clearTimeout(id)
        resolve()
      }
    })
    return
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function seekVideo(video: HTMLVideoElement, timeSec: number) {
  const safe = Math.min(Math.max(0, timeSec), Math.max(0, (video.duration || 0) - 1e-3))
  if (Math.abs(video.currentTime - safe) < 1e-4) return

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error('Video seek failed'))
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = safe
  })
  await waitForPresentedFrame(video, 200)
}
