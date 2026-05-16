import { mapPoseFeedbackMessage, poseTierRank, type PoseHumanFeedback } from './copy'
import { configureAnalyzer, createAnalyzer } from '../helpers'
import { type RealtimeFeedback } from '../analyzer/types'
import { DistanceTracker } from '../vision/distanceTracker'
import type { MoveNetNativeFrame } from '../vision/movenetPose'
import type { OfflineOverlayFrame } from '../runtime/types'

const OVERLAY_TONE_FOR_TIER = {
  gate: 'ok',
  warning: 'warn',
  issue: 'bad',
  rep_fail: 'bad',
  info: 'ok'
} as const

function overlayToneFromHuman(input: { main: PoseHumanFeedback | null; gate: PoseHumanFeedback | null }) {
  if (input.main) return OVERLAY_TONE_FOR_TIER[input.main.tier] ?? 'ok'
  if (input.gate) return OVERLAY_TONE_FOR_TIER[input.gate.tier] ?? 'ok'
  return 'ok'
}

export function buildOfflineOverlayFrames(input: {
  exerciseSlug: string
  fps: number
  nativeFrames: MoveNetNativeFrame[]
  analyzerTuning?: Record<string, number>
  onProgress?: (processed: number, total: number) => void
}): OfflineOverlayFrame[] {
  const getWarningMessage = (warning: unknown): string | null => {
    if (typeof warning === 'string') return warning
    if (!warning || typeof warning !== 'object') return null
    const value = (warning as { message?: unknown }).message
    return typeof value === 'string' ? value : null
  }

  const getRangeStatusText = (distance: { status: 'calibrating' | 'ready' | 'lost'; label: 'too_close' | 'ok' | 'too_far' | 'unknown' } | null) => {
    if (!distance) return 'Waiting for detection'
    if (distance.status === 'calibrating') return 'Calibrating distance'
    if (distance.status === 'lost') return 'Stable body not detected'
    if (distance.label === 'too_close') return 'Too close'
    if (distance.label === 'too_far') return 'Too far'
    return 'Distance OK'
  }

  const pickMainOverlayTip = (args: { exerciseSlug: string; feedback: RealtimeFeedback | null; distanceText: string | null }): { main: PoseHumanFeedback | null; gate: PoseHumanFeedback | null } => {
    const f = args.feedback
    const candidates: Array<{ sourceRank: number; message: string; isGate: boolean }> = []
    if (args.distanceText) candidates.push({ sourceRank: 10, message: args.distanceText, isGate: true })
    for (const reason of f?.lastRepReasonLabels ?? []) candidates.push({ sourceRank: 4, message: reason, isGate: false })
    if (f?.lastRepMessage) candidates.push({ sourceRank: 3, message: f.lastRepMessage, isGate: false })
    for (const issue of f?.issues ?? []) candidates.push({ sourceRank: 2, message: issue.message, isGate: false })
    for (const warn of (f?.warnings as unknown[] | undefined) ?? []) {
      const msg = getWarningMessage(warn)
      if (msg) candidates.push({ sourceRank: 1, message: msg, isGate: false })
    }

    const seen = new Set<string>()
    const mapped = candidates
      .map((c) => ({ ...c, message: (c.message ?? '').trim() }))
      .filter((c) => c.message && !seen.has(c.message) && (seen.add(c.message), true))
      .map((c) => ({ ...c, human: mapPoseFeedbackMessage({ exerciseSlug: args.exerciseSlug, message: c.message }) }))

    if (mapped.length === 0) return { main: null, gate: null }

    const gateCandidates = mapped.filter((c) => c.isGate || c.human.tier === 'gate')
    const repCandidates = mapped.filter((c) => !c.isGate && c.human.tier !== 'gate')

    const bestBy = (list: typeof mapped) => {
      if (list.length === 0) return null
      const sorted = [...list].sort((a, b) => {
        const diff = poseTierRank(b.human.tier) - poseTierRank(a.human.tier)
        if (diff !== 0) return diff
        return b.sourceRank - a.sourceRank
      })
      return sorted[0]!.human
    }

    return { main: bestBy(repCandidates), gate: bestBy(gateCandidates) }
  }

  const analyzer = createAnalyzer(input.exerciseSlug as never)
  analyzer.resetSession()
  configureAnalyzer(analyzer, input.exerciseSlug as never, 'video', {
    analyzerFps: input.fps,
    tuningOverride: input.analyzerTuning
  })

  const distanceTracker = new DistanceTracker(5000)

  const total = input.nativeFrames.length
  const out: OfflineOverlayFrame[] = []
  for (let i = 0; i < input.nativeFrames.length; i++) {
    const native = input.nativeFrames[i]!
    const hasNative = Array.isArray(native.keypoints) && native.keypoints.length > 0
    const feedback: RealtimeFeedback | null = hasNative ? analyzer.analyzeNative(native.keypoints) : null

    const tMs = typeof native.tMs === 'number' ? native.tMs : (i / Math.max(1, input.fps)) * 1000
    const distance = hasNative ? distanceTracker.ingest({ tMs, keypoints: native.keypoints }) : null
    const distanceText =
      distance && distance.status === 'ready' && (distance.label === 'too_close' || distance.label === 'too_far') ? getRangeStatusText(distance) : null

    const { main, gate } = pickMainOverlayTip({ exerciseSlug: input.exerciseSlug, feedback, distanceText })

    const combinedShortHint =
      gate && main ? `${gate.shortHint} · ${main.shortHint}` : gate?.shortHint ?? main?.shortHint ?? null

    out.push({
      tMs,
      tone: overlayToneFromHuman({ main, gate }),
      message: combinedShortHint,
      gateHint: gate?.shortHint ?? null,
      mainHint: main?.shortHint ?? null,
      distance
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

