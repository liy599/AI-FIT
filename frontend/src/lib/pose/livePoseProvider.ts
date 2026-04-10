import type { NormalizedLandmark } from './mediapipePose'
import { createMoveNetDetector, detectMoveNetLandmarks, type MoveNetDetector } from './movenetPose'

export type RealtimePoseProvider = {
  modelName: 'movenet_lightning'
  detect: (
    video: HTMLVideoElement,
    timestamp: number
  ) => Promise<{
    landmarks: NormalizedLandmark[] | null
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
      return { landmarks: out.landmarks33, worldLandmarks: null, source: 'movenet_lightning' as const }
    },
    close: () => detector.dispose?.()
  }
}

