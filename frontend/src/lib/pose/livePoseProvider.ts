import type { MoveNetKeypoint } from './movenetTracker'
import { createMoveNetDetector, detectMoveNetKeypoints, type MoveNetDetector } from './movenetPose'

export type RealtimePoseProvider = {
  modelName: 'movenet_lightning'
  detect: (
    video: HTMLVideoElement,
    timestamp: number
  ) => Promise<{
    nativeKeypoints: MoveNetKeypoint[] | null
    source: 'movenet_lightning'
  }>
  close: () => void
}

export async function createBestRealtimePoseProvider(): Promise<RealtimePoseProvider> {
  const detector = await createMoveNetDetector({ variant: 'lightning', enableSmoothing: true })
  return {
    modelName: 'movenet_lightning',
    detect: async (video) => {
      const nativeKeypoints = await detectMoveNetKeypoints(detector as MoveNetDetector, video, { flipHorizontal: false })
      return { nativeKeypoints, source: 'movenet_lightning' as const }
    },
    close: () => detector.dispose?.()
  }
}

