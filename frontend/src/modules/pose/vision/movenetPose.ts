import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'
import { MOVENET_NAMES, MoveNetStabilizer } from './movenetTracker'

type MoveNetPoint = { x: number; y: number; score: number; name: string }

export type MoveNetDetector = {
  estimatePoses: (
    video: HTMLVideoElement,
    config?: { flipHorizontal?: boolean }
  ) => Promise<Array<{ keypoints: Array<{ x: number; y: number; z?: number; score?: number; name?: string }> }>>
  dispose?: () => void
}

const prewarmCache = new Map<'lightning' | 'thunder', Promise<void>>()

export async function createMoveNetDetector(opts?: {
  variant?: 'lightning' | 'thunder'
  enableSmoothing?: boolean
  modelUrl?: string
}): Promise<MoveNetDetector> {
  const tf = await import('@tensorflow/tfjs-core')
  await Promise.all([import('@tensorflow/tfjs-converter'), import('@tensorflow/tfjs-backend-webgl')])
  await ensureSupportedBackend(tf)
  await withTimeout(tf.ready(), 15000, new Error('TensorFlow backend initialization timed out.'))

  const poseDetection = await import('@tensorflow-models/pose-detection')
  const variant = opts?.variant ?? 'lightning'
  const enableSmoothing = opts?.enableSmoothing ?? true
  const desiredModelUrl =
    opts?.modelUrl ?? `/assets/models/movenet/singlepose-${variant}/model.json`

  const build = (modelUrl?: string) =>
    poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType:
        variant === 'lightning'
          ? poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
          : poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      enableSmoothing,
      ...(modelUrl ? { modelUrl } : {})
    })
  try {
    if (!opts?.modelUrl) {
      try {
        const res = await fetch(desiredModelUrl, { method: 'GET' })
        if (res.ok) {
          const detector = await withTimeout(
            build(desiredModelUrl),
            120000,
            new Error(
              'Loading MoveNet model timed out. This is usually caused by blocked/slow access to model hosting (e.g. tfhub.dev / storage.googleapis.com).'
            )
          )
          return detector as MoveNetDetector
        }
      } catch {
      }
    }

    const detector = await withTimeout(
      build(opts?.modelUrl),
      120000,
      new Error(
        'Loading MoveNet model timed out. This is usually caused by blocked/slow access to model hosting (e.g. tfhub.dev / storage.googleapis.com).'
      )
    )
    return detector as MoveNetDetector
  } catch (e: unknown) {
    try {
      await import('@tensorflow/tfjs-backend-cpu')
      await tf.setBackend('cpu')
      await withTimeout(tf.ready(), 15000, new Error('TensorFlow CPU backend initialization timed out.'))
      const detector = await withTimeout(
        build(opts?.modelUrl),
        120000,
        new Error(
          'Loading MoveNet model timed out. This is usually caused by blocked/slow access to model hosting (e.g. tfhub.dev / storage.googleapis.com).'
        )
      )
      return detector as MoveNetDetector
    } catch {
      throw e
    }
  }
}

async function ensureSupportedBackend(tf: typeof import('@tensorflow/tfjs-core')) {
  const tryBackend = async (name: 'webgl' | 'cpu') => {
    await tf.setBackend(name)
    await withTimeout(tf.ready(), 5000, new Error(`TensorFlow backend "${name}" init timed out.`))
  }
  try {
    await tryBackend('webgl')
    return
  } catch {
    await import('@tensorflow/tfjs-backend-cpu')
    await tryBackend('cpu')
  }
}

export function prewarmMoveNet(variant: 'lightning' | 'thunder' = 'lightning'): Promise<void> {
  const cached = prewarmCache.get(variant)
  if (cached) return cached
  const task = (async () => {
    const detector = await createMoveNetDetector({ variant, enableSmoothing: true })
    detector.dispose?.()
  })().catch(() => {
    // Warmup failure should not block user flow.
  })
  prewarmCache.set(variant, task)
  return task
}

function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(error), ms)
    promise.then(
      (value) => {
        window.clearTimeout(id)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(id)
        reject(err)
      }
    )
  })
}

export async function detectMoveNetKeypoints(
  detector: MoveNetDetector,
  video: HTMLVideoElement,
  config?: { flipHorizontal?: boolean }
): Promise<MoveNetKeypoint[]> {
  const poses = await detector.estimatePoses(video, { flipHorizontal: config?.flipHorizontal ?? false })
  const pose = poses[0]
  const keypoints: MoveNetPoint[] = (pose?.keypoints ?? []).map((k) => ({
    x: k.x,
    y: k.y,
    score: k.score ?? 0,
    name: k.name ?? ''
  }))
  const knownNames = new Set<string>(MOVENET_NAMES as unknown as string[])
  return keypoints
    .filter((point) => knownNames.has(point.name))
    .map((point) => ({
      name: point.name as MoveNetName,
      x: video.videoWidth > 0 ? point.x / video.videoWidth : 0,
      y: video.videoHeight > 0 ? point.y / video.videoHeight : 0,
      score: point.score
    }))
}

export type MoveNetExtractOptions = {
  maxFrames?: number
  targetFps?: number
  maxDurationSec?: number
  minVisibility?: number
  enableStabilizer?: boolean
  enableAntiSwap?: boolean
  preferPlaybackSampling?: boolean
  detectorVariant?: 'lightning' | 'thunder'
  onProgress?: (p: { processed: number; total: number; stage: 'loading' | 'extracting' }) => void
}

export type MoveNetNativeFrame = {
  tMs: number
  keypoints: MoveNetKeypoint[]
}

export async function extractNativePoseFromVideoUrlWithMoveNet(
  videoUrl: string,
  opts: MoveNetExtractOptions = {}
): Promise<{ fps: number; nativeFrames: MoveNetNativeFrame[] }> {
  const {
    maxFrames = 4000,
    targetFps = 30,
    maxDurationSec,
    minVisibility = 0.2,
    enableStabilizer = true,
    enableAntiSwap = true,
    preferPlaybackSampling = true,
    detectorVariant = 'lightning',
    onProgress
  } = opts
  if (typeof window === 'undefined') throw new Error('Browser only')

  onProgress?.({ processed: 0, total: 1, stage: 'loading' })
  const detector = await createMoveNetDetector({ variant: detectorVariant, enableSmoothing: true })

  const video = document.createElement('video')
  video.src = videoUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => resolve()
    const onError = () => reject(new Error('Video load failed'))
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
  })

  const duration = Number.isFinite(video.duration) ? video.duration : 0
  if (!duration || duration <= 0) {
    detector.dispose?.()
    throw new Error('Invalid video duration')
  }

  const cappedDuration =
    typeof maxDurationSec === 'number' && Number.isFinite(maxDurationSec) && maxDurationSec > 0
      ? Math.min(duration, maxDurationSec)
      : duration
  const fps = chooseFpsForDuration({ durationSec: cappedDuration, targetFps, maxFrames })
  const total = Math.min(maxFrames, Math.max(1, Math.floor(cappedDuration * fps)))
  try {
    if (preferPlaybackSampling && typeof (video as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function') {
      const extracted = await extractByPlaybackSampling({
        detector,
        video,
        fps,
        total,
        minVisibility,
        enableStabilizer,
        enableAntiSwap,
        onProgress
      })
      return { fps, nativeFrames: extracted.nativeFrames }
    }

    const extracted = await extractBySeeking({
      detector,
      video,
      fps,
      total,
      minVisibility,
      enableStabilizer,
      enableAntiSwap,
      onProgress
    })
    return { fps, nativeFrames: extracted.nativeFrames }
  } finally {
    detector.dispose?.()
    try {
      video.pause()
    } catch {}
    video.remove()
  }
}

function chooseFpsForDuration(input: { durationSec: number; targetFps: number; maxFrames: number }) {
  const durationSec = Number.isFinite(input.durationSec) ? Math.max(0.01, input.durationSec) : 1
  const target = Math.max(1, Math.min(60, Math.round(input.targetFps)))
  const budgetFps = Math.max(1, Math.floor(Math.max(1, input.maxFrames) / durationSec))
  const maxFps = Math.max(1, Math.min(target, budgetFps))
  const candidates = [60, 50, 40, 30, 25, 20, 10, 8, 5, 4, 2, 1]
  for (const v of candidates) {
    if (v <= maxFps) return v
  }
  return 1
}

async function extractBySeeking(input: {
  detector: MoveNetDetector
  video: HTMLVideoElement
  fps: number
  total: number
  minVisibility: number
  enableStabilizer: boolean
  enableAntiSwap: boolean
  startIndex?: number
  onProgress?: (p: { processed: number; total: number; stage: 'loading' | 'extracting' }) => void
}) {
  const nativeFrames: MoveNetNativeFrame[] = []
  const stabilizer = input.enableStabilizer ? new MoveNetStabilizer(600) : null
  let prevForAntiSwap: MoveNetKeypoint[] | null = null

  const startIndex = typeof input.startIndex === 'number' && Number.isFinite(input.startIndex) ? Math.max(0, Math.floor(input.startIndex)) : 0
  for (let i = startIndex; i < input.total; i++) {
    const tMs = (i / input.fps) * 1000
    const timeSec = i / input.fps
    await seekVideo(input.video, timeSec)
    const nativeKeypointsRaw = await withTimeout(
      detectMoveNetKeypoints(input.detector, input.video, { flipHorizontal: false }),
      10000,
      new Error('Pose estimation timed out while extracting keypoints.')
    )
    const nativeKeypoints: MoveNetKeypoint[] =
      input.enableAntiSwap && prevForAntiSwap ? maybeFixLeftRightSwap(prevForAntiSwap, nativeKeypointsRaw) : nativeKeypointsRaw
    prevForAntiSwap = nativeKeypoints
    const stabilized =
      stabilizer && nativeKeypoints.length > 0
        ? stabilizer.ingest({ tMs, keypoints: nativeKeypoints }).joints2d.map((j) => ({
            name: j.name,
            x: j.x,
            y: j.y,
            score: j.score
          }))
        : nativeKeypoints
    nativeFrames.push({ tMs, keypoints: stabilized })
    input.onProgress?.({ processed: i + 1, total: input.total, stage: 'extracting' })
  }
  return { nativeFrames }
}

async function extractByPlaybackSampling(input: {
  detector: MoveNetDetector
  video: HTMLVideoElement
  fps: number
  total: number
  minVisibility: number
  enableStabilizer: boolean
  enableAntiSwap: boolean
  onProgress?: (p: { processed: number; total: number; stage: 'loading' | 'extracting' }) => void
}) {
  const nativeFrames: MoveNetNativeFrame[] = []
  const stabilizer = input.enableStabilizer ? new MoveNetStabilizer(600) : null
  let prevForAntiSwap: MoveNetKeypoint[] | null = null

  input.video.currentTime = 0
  try {
    await input.video.play()
  } catch {
    return extractBySeeking(input)
  }
  await waitForPresentedFrame(input.video, 800)
  try {
    await withTimeout(
      detectMoveNetKeypoints(input.detector, input.video, { flipHorizontal: false }),
      30000,
      new Error('Pose estimation warmup timed out while extracting keypoints.')
    )
  } catch {}

  const stepSec = 1 / Math.max(1, input.fps)
  let nextSampleSec = 0
  let processed = 0
  let lastProgressAt = performance.now()
  let lastMediaSec = -1
  let stalledFrames = 0
  let usedSeekingFallback = false

  while (processed < input.total) {
    if (input.video.ended) break
    if (input.video.paused) {
      try {
        await input.video.play()
      } catch {}
    }

    if (performance.now() - lastProgressAt > 8000 && !usedSeekingFallback) {
      usedSeekingFallback = true
      try {
        input.video.pause()
      } catch {}
      const rest = await extractBySeeking({ ...input, startIndex: processed })
      nativeFrames.push(...rest.nativeFrames)
      processed = input.total
      input.onProgress?.({ processed, total: input.total, stage: 'extracting' })
      break
    }

    const meta = await waitForNextVideoFrame(input.video, 2500)
    if (!meta) {
      stalledFrames += 1
      continue
    }
    const mediaSec = meta.mediaTimeSec
    if (!Number.isFinite(mediaSec)) {
      stalledFrames += 1
      continue
    }
    if (Math.abs(mediaSec - lastMediaSec) < 1e-4) {
      stalledFrames += 1
      continue
    }
    lastMediaSec = mediaSec
    if (mediaSec < nextSampleSec - 1e-4) continue
    stalledFrames = 0

    const tMs = Math.max(0, mediaSec * 1000)
    nextSampleSec = (processed + 1) * stepSec

    try {
      const nativeKeypointsRaw = await withTimeout(
        detectMoveNetKeypoints(input.detector, input.video, { flipHorizontal: false }),
        10000,
        new Error('Pose estimation timed out while extracting keypoints.')
      )
      const nativeKeypoints: MoveNetKeypoint[] =
        input.enableAntiSwap && prevForAntiSwap ? maybeFixLeftRightSwap(prevForAntiSwap, nativeKeypointsRaw) : nativeKeypointsRaw
      prevForAntiSwap = nativeKeypoints
      const stabilized =
        stabilizer && nativeKeypoints.length > 0
          ? stabilizer.ingest({ tMs, keypoints: nativeKeypoints }).joints2d.map((j) => ({
              name: j.name,
              x: j.x,
              y: j.y,
              score: j.score
            }))
          : nativeKeypoints
      nativeFrames.push({ tMs, keypoints: stabilized })
    } catch {
      nativeFrames.push({ tMs, keypoints: [] })
    }

    processed += 1
    lastProgressAt = performance.now()
    input.onProgress?.({ processed, total: input.total, stage: 'extracting' })
  }

  try {
    input.video.pause()
  } catch {}

  if (processed < input.total && !usedSeekingFallback) {
    const rest = await extractBySeeking({ ...input, startIndex: processed })
    nativeFrames.push(...rest.nativeFrames)
  }

  return { nativeFrames }
}

const ANTI_SWAP_PAIRS: Array<[MoveNetName, MoveNetName]> = [
  ['left_shoulder', 'right_shoulder'],
  ['left_elbow', 'right_elbow'],
  ['left_wrist', 'right_wrist'],
  ['left_hip', 'right_hip'],
  ['left_knee', 'right_knee'],
  ['left_ankle', 'right_ankle'],
  ['left_eye', 'right_eye'],
  ['left_ear', 'right_ear']
]

function maybeFixLeftRightSwap(prev: MoveNetKeypoint[], cur: MoveNetKeypoint[]): MoveNetKeypoint[] {
  const minScore = 0.22
  const prevMap = new Map<MoveNetName, MoveNetKeypoint>()
  for (const p of prev) prevMap.set(p.name, p)
  const curMap = new Map<MoveNetName, MoveNetKeypoint>()
  for (const p of cur) curMap.set(p.name, p)

  let usedPairs = 0
  let costOriginal = 0
  let costSwapped = 0

  for (const [l, r] of ANTI_SWAP_PAIRS) {
    const pl = prevMap.get(l)
    const pr = prevMap.get(r)
    const cl = curMap.get(l)
    const cr = curMap.get(r)
    if (!pl || !pr || !cl || !cr) continue
    if (pl.score < minScore || pr.score < minScore || cl.score < minScore || cr.score < minScore) continue
    usedPairs += 1
    const d = (a: MoveNetKeypoint, b: MoveNetKeypoint) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return dx * dx + dy * dy
    }
    costOriginal += d(cl, pl) + d(cr, pr)
    costSwapped += d(cl, pr) + d(cr, pl)
  }

  if (usedPairs < 2) return cur
  if (costSwapped >= costOriginal * 0.72) return cur
  if (costOriginal < 1e-6) return cur

  const map = new Map<MoveNetName, MoveNetName>()
  for (const [l, r] of ANTI_SWAP_PAIRS) {
    if (curMap.has(l) && curMap.has(r)) {
      map.set(l, r)
      map.set(r, l)
    }
  }
  if (map.size === 0) return cur
  return cur.map((p) => {
    const next = map.get(p.name)
    return next ? { ...p, name: next } : p
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

async function waitForNextVideoFrame(video: HTMLVideoElement, timeoutMs: number): Promise<{ mediaTimeSec: number } | null> {
  const v = video as unknown as {
    requestVideoFrameCallback?: (cb: (now: number, meta?: { mediaTime?: number }) => void) => number
  }
  const rvfc = v.requestVideoFrameCallback
  if (typeof rvfc !== 'function') return { mediaTimeSec: Number.isFinite(video.currentTime) ? video.currentTime : 0 }
  return new Promise((resolve) => {
    const id = window.setTimeout(() => resolve(null), Math.max(0, timeoutMs))
    try {
      rvfc((_now, meta) => {
        window.clearTimeout(id)
        const mediaTimeSec = typeof meta?.mediaTime === 'number' && Number.isFinite(meta.mediaTime) ? meta.mediaTime : video.currentTime
        resolve({ mediaTimeSec: Number.isFinite(mediaTimeSec) ? mediaTimeSec : 0 })
      })
    } catch {
      window.clearTimeout(id)
      resolve(null)
    }
  })
}

async function seekVideo(video: HTMLVideoElement, timeSec: number) {
  if (Math.abs(video.currentTime - timeSec) < 1e-4) return

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error('Video seek failed'))
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = Math.min(Math.max(0, timeSec), Math.max(0, (video.duration || 0) - 1e-3))
  })
  await waitForPresentedFrame(video, 250)
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

