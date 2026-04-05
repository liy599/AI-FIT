import type { NormalizedLandmark } from './mediapipePose'

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
  video: HTMLVideoElement
): Promise<{ keypoints: MoveNetPoint[]; landmarks33: NormalizedLandmark[] }> {
  const poses = await detector.estimatePoses(video, { flipHorizontal: true })
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
  return out
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
