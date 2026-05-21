import type { PoseAnalysisReport } from '../../reporting/types'
import type { OfflineReplayData, OfflineOverlayTone } from '../types'
import { findClosestTmsIndex } from '../../reporting/overlayReplay'
import { drawPoseJoints17 } from '../../vision/draw'
import type { MoveNetNativeFrame } from '../../vision/movenetPose'
import { isPoseDebugEnabled } from '../../debugFlags'

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
    await warmupVideo(video)
    const sourceW = video.videoWidth
    const sourceH = video.videoHeight
    if (!sourceW || !sourceH) return args.report

    const { canvas, ctx, width, height } = createSnapshotCanvas({ sourceW, sourceH, maxSide: options.maxSide })
    const nextRepFindings: RepFindingRecord[] = []
    let snapshotCount = 0
    let lastSnapshotMediaSec: number | null = null
    const usedSignatures = new Set<string>()
    const usedTimeKeys = new Set<number>()
    const MIN_SNAPSHOT_DELTA_SEC = 0.8
    for (let i = 0; i < repFindings.length; i++) {
      const finding = repFindings[i]!
      const snapshotDataUrlExisting = typeof finding.snapshotDataUrl === 'string' ? finding.snapshotDataUrl : null
      const findingTms = asNumber(finding.tMs)
      const result = String(finding.result ?? 'invalid')
      const tier = typeof finding.tier === 'string' ? finding.tier : null
      const eligibleTier = tier === 'warning' || tier === 'issue' || tier === 'rep_fail'
      const eligible = snapshotCount < options.maxSnapshots && eligibleTier
      if (findingTms === null || !eligible) {
        nextRepFindings.push(finding)
        continue
      }
      if (snapshotDataUrlExisting) {
        nextRepFindings.push(finding)
        snapshotCount += 1
        if (args.onProgress) args.onProgress(snapshotCount, options.maxSnapshots)
        continue
      }
      const baseOverlayIdx = findClosestTmsIndex(args.replayData.overlayFrames, findingTms)
      const baseOverlayTms = args.replayData.overlayFrames[baseOverlayIdx]?.tMs ?? findingTms
      const baseSec = Math.max(0, baseOverlayTms / 1000)
      const tags = Array.isArray(finding.tags) ? finding.tags.filter((x): x is string => typeof x === 'string') : []
      const minDeltaSec = tags.includes('Incomplete') ? 0.25 : MIN_SNAPSHOT_DELTA_SEC

      try {
        const capture = await captureUniqueFrame({
          video,
          ctx,
          width,
          height,
          baseSec,
          lastSnapshotMediaSec,
          usedSignatures,
          usedTimeKeys,
          minDeltaSec
        })

        if (!capture) {
          nextRepFindings.push(finding)
          if (args.onProgress) args.onProgress(snapshotCount, options.maxSnapshots)
          continue
        }

        lastSnapshotMediaSec = capture.mediaSec
        usedSignatures.add(capture.signature)
        usedTimeKeys.add(timeKey(capture.mediaSec))

        const snapshotTms = Math.max(0, capture.mediaSec * 1000)
        const idx = findClosestTmsIndex(args.replayData.overlayFrames, snapshotTms)
        const joints = (args.replayData.nativeFrames[idx]?.keypoints ?? []) as MoveNetNativeFrame['keypoints']
        const tone = args.replayData.overlayFrames[idx]?.tone ?? 'ok'
        if (joints.length > 0) drawPoseJoints17(ctx, joints, width, height, toneToColor(tone), { mirror: false })

        const dataUrl = canvas.toDataURL('image/jpeg', options.jpegQuality)
        const isDebug = isPoseDebugEnabled()
        nextRepFindings.push(
          isDebug
            ? {
                ...finding,
                snapshotDataUrl: dataUrl,
                snapshotTms,
                snapshotBaseTms: baseOverlayTms,
                snapshotSignature: capture.signature,
                snapshotTimeKey: timeKey(capture.mediaSec)
              }
            : {
                ...finding,
                snapshotDataUrl: dataUrl
              }
        )
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
  video.style.position = 'fixed'
  video.style.left = '-9999px'
  video.style.top = '0'
  video.style.width = '1px'
  video.style.height = '1px'
  video.style.opacity = '0'
  document.body.appendChild(video)
  const cleanup = () => {
    try {
      video.pause()
    } catch {}
    try {
      video.remove()
    } catch {}
    URL.revokeObjectURL(objectUrl)
  }
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
    return await new Promise<number>((resolve) => {
      const id = window.setTimeout(() => resolve(Number.isFinite(video.currentTime) ? video.currentTime : 0), Math.max(0, ms))
      try {
        rvfc((_now, meta) => {
          window.clearTimeout(id)
          const mediaTimeSec = typeof meta?.mediaTime === 'number' && Number.isFinite(meta.mediaTime) ? meta.mediaTime : video.currentTime
          resolve(Number.isFinite(mediaTimeSec) ? mediaTimeSec : 0)
        })
      } catch {
        window.clearTimeout(id)
        resolve(Number.isFinite(video.currentTime) ? video.currentTime : 0)
      }
    })
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  return Number.isFinite(video.currentTime) ? video.currentTime : 0
}

async function warmupVideo(video: HTMLVideoElement) {
  try {
    await video.play()
    await waitForPresentedFrame(video, 400)
  } catch {}
  try {
    video.pause()
  } catch {}
}

async function seekAndCaptureFrame(args: {
  video: HTMLVideoElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  targetTimeSec: number
}): Promise<(FrameCapture & { isBlack: boolean }) | null> {
  const { video, ctx, width, height, targetTimeSec } = args
  const safe = Math.min(Math.max(0, targetTimeSec), Math.max(0, (video.duration || 0) - 1e-3))

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error('seek failed'))
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = safe
  })

  try { await video.play() } catch {}

  const v = video as unknown as {
    requestVideoFrameCallback?: (cb: (now: number, meta?: { mediaTime?: number }) => void) => number
  }
  const rvfc = v.requestVideoFrameCallback
  if (typeof rvfc !== 'function') {
    try { video.pause() } catch {}
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(video, 0, 0, width, height)
    const sig = frameSignature(ctx, width, height)
    const mediaSec = Number.isFinite(video.currentTime) ? video.currentTime : safe
    return { mediaSec, signature: sig.signature, isBlack: sig.isBlack }
  }

  return await new Promise<(FrameCapture & { isBlack: boolean }) | null>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      try { video.pause() } catch {}
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(video, 0, 0, width, height)
      const sig = frameSignature(ctx, width, height)
      const mediaSec = Number.isFinite(video.currentTime) ? video.currentTime : safe
      resolve({ mediaSec, signature: sig.signature, isBlack: sig.isBlack })
    }, 600)

    try {
      rvfc((_now, meta) => {
        window.clearTimeout(timeoutId)
        try { video.pause() } catch {}
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(video, 0, 0, width, height)
        const sig = frameSignature(ctx, width, height)
        const mediaTimeSec = typeof meta?.mediaTime === 'number' && Number.isFinite(meta.mediaTime) ? meta.mediaTime : video.currentTime
        const mediaSec = Number.isFinite(mediaTimeSec) ? mediaTimeSec : safe
        resolve({ mediaSec, signature: sig.signature, isBlack: sig.isBlack })
      })
    } catch {
      window.clearTimeout(timeoutId)
      try { video.pause() } catch {}
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(video, 0, 0, width, height)
      const sig = frameSignature(ctx, width, height)
      const mediaSec = Number.isFinite(video.currentTime) ? video.currentTime : safe
      resolve({ mediaSec, signature: sig.signature, isBlack: sig.isBlack })
    }
  })
}

function frameSignature(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  let sum = 0
  let sumSq = 0
  const sampleW = 9
  const sampleH = 8
  const g: number[] = []
  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const px = Math.max(0, Math.min(w - 1, Math.floor(((x + 0.5) / sampleW) * w)))
      const py = Math.max(0, Math.min(h - 1, Math.floor(((y + 0.5) / sampleH) * h)))
      const data = ctx.getImageData(px, py, 1, 1).data
      const r = (data[0] ?? 0) | 0
      const gg = (data[1] ?? 0) | 0
      const b = (data[2] ?? 0) | 0
      const l = (r * 3 + gg * 4 + b) >> 3
      g.push(l)
      sum += l
      sumSq += l * l
    }
  }
  const n = g.length
  const avg = n > 0 ? sum / n : 0
  const variance = n > 0 ? sumSq / n - avg * avg : 0
  const isBlack = avg <= 3 || (avg <= 10 && variance <= 10)
  let bits = ''
  for (let y = 0; y < sampleH; y++) {
    const row = y * sampleW
    for (let x = 0; x < sampleW - 1; x++) {
      bits += g[row + x]! > g[row + x + 1]! ? '1' : '0'
    }
  }
  return { signature: bits, isBlack }
}

type FrameCapture = { mediaSec: number; signature: string }

function buildOffsets() {
  const offsets: number[] = [0]
  const steps = [0.12, 0.24, 0.36, 0.48, 0.6, 0.75, 0.9, 1.1, 1.3, 1.6, 1.9, 2.2, 2.6, 3.0, 3.6, 4.2, 5.0, 6.0]
  for (const step of steps) {
    offsets.push(step, -step)
  }
  return offsets
}

function timeKey(sec: number) {
  if (!Number.isFinite(sec)) return 0
  return Math.max(0, Math.round(sec * 20))
}

async function captureUniqueFrame(args: {
  video: HTMLVideoElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  baseSec: number
  lastSnapshotMediaSec: number | null
  usedSignatures: Set<string>
  usedTimeKeys: Set<number>
  minDeltaSec: number
}): Promise<FrameCapture | null> {
  const { video, ctx, width, height, baseSec, lastSnapshotMediaSec, usedSignatures, usedTimeKeys, minDeltaSec } = args

  const probe = async (offsets: number[]): Promise<FrameCapture | null> => {
    for (const offset of offsets) {
      const target = baseSec + offset
      if (target < 0) continue
      if (lastSnapshotMediaSec !== null && Math.abs(target - lastSnapshotMediaSec) < minDeltaSec) continue

      const capture = await seekAndCaptureFrame({ video, ctx, width, height, targetTimeSec: target })
      if (!capture) continue
      if (capture.isBlack) continue
      if (usedTimeKeys.has(timeKey(capture.mediaSec))) continue
      if (!usedSignatures.has(capture.signature)) {
        return { mediaSec: capture.mediaSec, signature: capture.signature }
      }
      continue
    }
    return null
  }

  return await probe(buildOffsets())
}
