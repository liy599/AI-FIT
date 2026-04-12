import type { NormalizedLandmark, PoseFrame } from './mediapipePose'
import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'
import { MOVENET_NAMES } from './movenetTracker'

type MoveNetPoint = {
  x: number
  y: number
  score: number
  name: string
}

export type MoveNetDetector = {
  estimatePoses: (
    video: HTMLVideoElement,
    config?: { flipHorizontal?: boolean }
  ) => Promise<Array<{ keypoints: Array<{ x: number; y: number; z?: number; score?: number; name?: string }> }>>
  dispose?: () => void
}

const MOVENET_TO_MP_INDEX: Record<string, number> = {
  nose: 0,
  left_eye: 2,
  right_eye: 5,
  left_ear: 7,
  right_ear: 8,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28
}

export async function createMoveNetDetector(opts?: {
  variant?: 'lightning' | 'thunder'
  enableSmoothing?: boolean
}): Promise<MoveNetDetector> {
  const tf = await import('@tensorflow/tfjs-core')
  await Promise.all([
    import('@tensorflow/tfjs-converter'),
    import('@tensorflow/tfjs-backend-webgl'),
    import('@tensorflow/tfjs-backend-cpu')
  ])
  await ensureSupportedBackend(tf)
  await tf.ready()

  const poseDetection = await import('@tensorflow-models/pose-detection')
  const variant = opts?.variant ?? 'lightning'
  const enableSmoothing = opts?.enableSmoothing ?? true
  const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType:
      variant === 'lightning'
        ? poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        : poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    enableSmoothing
  })
  return detector as MoveNetDetector
}

async function ensureSupportedBackend(tf: typeof import('@tensorflow/tfjs-core')) {
  try {
    await tf.setBackend('webgl')
    return
  } catch {
    await tf.setBackend('cpu')
  }
}

export async function detectMoveNetLandmarks(
  detector: MoveNetDetector,
  video: HTMLVideoElement,
  config?: { flipHorizontal?: boolean }
): Promise<{ keypoints: MoveNetPoint[]; landmarks33: NormalizedLandmark[] }> {
  const poses = await detector.estimatePoses(video, { flipHorizontal: config?.flipHorizontal ?? false })
  const pose = poses[0]
  const keypoints: MoveNetPoint[] = (pose?.keypoints ?? []).map((k) => ({
    x: k.x,
    y: k.y,
    score: k.score ?? 0,
    name: k.name ?? ''
  }))

  const landmarks33 = movenetToMediapipeLikeLandmarks(
    keypoints.map((k) => ({
      ...k,
      x: video.videoWidth > 0 ? k.x / video.videoWidth : 0,
      y: video.videoHeight > 0 ? k.y / video.videoHeight : 0
    }))
  )
  return { keypoints, landmarks33 }
}

export type MoveNetExtractOptions = {
  maxFrames?: number
  targetFps?: number
  minVisibility?: number
  onProgress?: (p: { processed: number; total: number; stage: 'loading' | 'extracting' }) => void
}

export type MoveNetNativeFrame = {
  tMs: number
  keypoints: MoveNetKeypoint[]
}

export async function extractPose33FromVideoUrlWithMoveNet(
  videoUrl: string,
  opts: MoveNetExtractOptions = {}
): Promise<{ fps: number; frames: PoseFrame[]; nativeFrames: MoveNetNativeFrame[] }> {
  const { maxFrames = 4000, targetFps = 40, minVisibility = 0.2, onProgress } = opts
  if (typeof window === 'undefined') throw new Error('Browser only')

  onProgress?.({ processed: 0, total: 1, stage: 'loading' })
  const detector = await createMoveNetDetector({ variant: 'lightning', enableSmoothing: true })

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

  const fps = Math.max(1, Math.min(60, Math.round(targetFps)))
  const total = Math.min(maxFrames, Math.max(1, Math.floor(duration * fps)))
  const frames: PoseFrame[] = []
  const nativeFrames: MoveNetNativeFrame[] = []
  const knownNames = new Set<string>(MOVENET_NAMES as unknown as string[])

  try {
    for (let i = 0; i < total; i++) {
      const tMs = (i / fps) * 1000
      const timeSec = i / fps
      await seekVideo(video, timeSec)
      const out = await detectMoveNetLandmarks(detector, video, { flipHorizontal: false })
      const nativeKeypoints: MoveNetKeypoint[] = out.keypoints
        .filter((point) => knownNames.has(point.name))
        .map((point) => ({
          name: point.name as MoveNetName,
          x: video.videoWidth > 0 ? point.x / video.videoWidth : 0,
          y: video.videoHeight > 0 ? point.y / video.videoHeight : 0,
          score: point.score
        }))
      frames.push({
        tMs,
        landmarks: filterByVisibility(out.landmarks33, minVisibility)
      })
      nativeFrames.push({ tMs, keypoints: nativeKeypoints })
      onProgress?.({ processed: i + 1, total, stage: 'extracting' })
    }
  } finally {
    detector.dispose?.()
  }

  return { fps, frames, nativeFrames }
}

function movenetToMediapipeLikeLandmarks(points: MoveNetPoint[]): NormalizedLandmark[] {
  const out: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }))
  for (const p of points) {
    const idx = MOVENET_TO_MP_INDEX[p.name]
    if (typeof idx !== 'number') continue
    out[idx] = {
      x: clamp01(p.x),
      y: clamp01(p.y),
      z: 0,
      visibility: clamp01(p.score)
    }
  }
  synthesizeFootLandmarks(out, 25, 27, 29, 31)
  synthesizeFootLandmarks(out, 26, 28, 30, 32)
  return out
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
}

function filterByVisibility(lms: NormalizedLandmark[], minVisibility: number): NormalizedLandmark[] {
  return lms.map((point) => {
    const visibility = typeof point.visibility === 'number' ? point.visibility : 1
    if (visibility < minVisibility) {
      return { x: point.x, y: point.y, z: point.z, visibility, presence: point.presence }
    }
    return point
  })
}

function synthesizeFootLandmarks(
  lms: NormalizedLandmark[],
  kneeIdx: number,
  ankleIdx: number,
  heelIdx: number,
  footIndexIdx: number
) {
  const knee = lms[kneeIdx]
  const ankle = lms[ankleIdx]
  if (!knee || !ankle) return
  const vis = Math.max(0, Math.min(1, Math.min(knee.visibility ?? 0, ankle.visibility ?? 0)))
  if (vis <= 0) return

  const dx = ankle.x - knee.x
  const dy = ankle.y - knee.y
  const mag = Math.hypot(dx, dy) || 1
  const ux = dx / mag
  const uy = dy / mag

  lms[footIndexIdx] = {
    x: clamp01(ankle.x + ux * 0.06),
    y: clamp01(ankle.y + uy * 0.02),
    z: 0,
    visibility: vis
  }
  lms[heelIdx] = {
    x: clamp01(ankle.x - ux * 0.03),
    y: clamp01(ankle.y - uy * 0.01),
    z: 0,
    visibility: vis
  }
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
