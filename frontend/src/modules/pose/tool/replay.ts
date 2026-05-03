import { mapPoseFeedbackMessage } from '../../../lib/pose/feedbackCopy'
import { configureAnalyzer, createAnalyzer } from '../helpers'
import { type RealtimeFeedback } from '../../../lib/pose/realtimeSquat'
import { type SquatTuning } from '../../../lib/pose/realtimeSquatAnalyzer'
import type { MoveNetNativeFrame } from '../../../lib/pose/movenetPose'
import type { OfflineOverlayFrame } from './types'

export function buildOfflineOverlayFrames(input: {
  exerciseSlug: string
  fps: number
  nativeFrames: MoveNetNativeFrame[]
  squatTuning?: Partial<SquatTuning>
  analyzerTuning?: Record<string, number>
  onProgress?: (processed: number, total: number) => void
}): OfflineOverlayFrame[] {
  const getWarningMessage = (warning: unknown): string | null => {
    if (typeof warning === 'string') return warning
    if (!warning || typeof warning !== 'object') return null
    const value = (warning as { message?: unknown }).message
    return typeof value === 'string' ? value : null
  }

  const analyzer = createAnalyzer(input.exerciseSlug as never)
  analyzer.resetSession()
  configureAnalyzer(analyzer, input.exerciseSlug as never, 'video', {
    analyzerFps: input.fps,
    tuningOverride: input.analyzerTuning ?? input.squatTuning
  })

  const total = input.nativeFrames.length
  const out: OfflineOverlayFrame[] = []
  for (let i = 0; i < input.nativeFrames.length; i++) {
    const native = input.nativeFrames[i]!
    const hasNative = Array.isArray(native.keypoints) && native.keypoints.length > 0
    const feedback: RealtimeFeedback | null = hasNative ? analyzer.analyzeNative(native.keypoints) : null

    const firstIssueMsg = feedback?.issues?.[0]?.message ?? null
    const firstWarnMsg = feedback ? getWarningMessage((feedback.warnings as unknown[] | undefined)?.[0]) : null
    const rawMsg = firstIssueMsg ?? firstWarnMsg
    const human = rawMsg ? mapPoseFeedbackMessage({ exerciseSlug: input.exerciseSlug, message: rawMsg }) : null

    out.push({
      tMs: typeof native.tMs === 'number' ? native.tMs : (i / Math.max(1, input.fps)) * 1000,
      tone: human ? (human.tier === 'rep_fail' || human.tier === 'issue' ? 'bad' : human.tier === 'warning' || human.tier === 'gate' ? 'warn' : 'ok') : 'ok',
      message: human?.shortHint ?? null
    })
    if (input.onProgress && ((i + 1) % 40 === 0 || i === input.nativeFrames.length - 1)) input.onProgress(i + 1, total)
  }
  return out
}

export function findClosestTmsIndex(items: Array<{ tMs: number }>, tMs: number) {
  if (!items.length) return 0
  const target = Number.isFinite(tMs) ? tMs : 0
  let lo = 0
  let hi = items.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = items[mid]!.tMs
    if (v < target) lo = mid + 1
    else hi = mid - 1
  }
  if (lo <= 0) return 0
  if (lo >= items.length) return items.length - 1
  const a = items[lo - 1]!.tMs
  const b = items[lo]!.tMs
  return target - a <= b - target ? lo - 1 : lo
}

export function computeContainViewport(sourceW: number, sourceH: number, canvasW: number, canvasH: number) {
  const sw = Math.max(1, sourceW)
  const sh = Math.max(1, sourceH)
  const cw = Math.max(1, canvasW)
  const ch = Math.max(1, canvasH)
  const fitScale = Math.min(cw / sw, ch / sh)
  const drawW = sw * fitScale
  const drawH = sh * fitScale
  return { x: (cw - drawW) / 2, y: (ch - drawH) / 2, w: drawW, h: drawH }
}

export function drawCameraFrame(
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

