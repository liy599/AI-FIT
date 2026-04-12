import type { NormalizedLandmark } from './mediapipePose'
import type { MoveNetKeypoint, MoveNetName } from './movenetTracker'
import { MOVENET_NAMES } from './movenetTracker'
import { createMoveNetDetector, detectMoveNetLandmarks, type MoveNetDetector } from './movenetPose'

export type RealtimePoseProvider = {
  modelName: 'movenet_lightning'
  detect: (
    video: HTMLVideoElement,
    timestamp: number
  ) => Promise<{
    landmarks: NormalizedLandmark[] | null
    nativeKeypoints: MoveNetKeypoint[] | null
    worldLandmarks: NormalizedLandmark[] | null
    source: 'movenet_lightning'
  }>
  close: () => void
}

export async function createBestRealtimePoseProvider(): Promise<RealtimePoseProvider> {
  const detector = await createMoveNetDetector({ variant: 'lightning', enableSmoothing: true })
  return {
    modelName: 'movenet_lightning',
    detect: async (video) => {
      const out = await detectMoveNetLandmarks(detector as MoveNetDetector, video, { flipHorizontal: false })
      const knownNames = new Set<string>(MOVENET_NAMES as unknown as string[])
      const nativeKeypoints: MoveNetKeypoint[] = out.keypoints
        .filter((point) => knownNames.has(point.name))
        .map((point) => ({
          name: point.name as MoveNetName,
          x: video.videoWidth > 0 ? point.x / video.videoWidth : 0,
          y: video.videoHeight > 0 ? point.y / video.videoHeight : 0,
          score: point.score
        }))
      return { landmarks: out.landmarks33, nativeKeypoints, worldLandmarks: null, source: 'movenet_lightning' as const }
    },
    close: () => detector.dispose?.()
  }
}

