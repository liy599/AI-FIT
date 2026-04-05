export type ExportKeypoint = { x: number; y: number; s: number }

export type SquatFrame = {
  timestamp: number
  kneeAngle: number
  keypoints: ExportKeypoint[]
}

export type SquatSlice = {
  squatIndex: number
  startTime: number
  endTime: number
  frameCount: number
  frames: SquatFrame[]
}

export function buildMoveNetSquatExport(args: { slices: SquatSlice[]; recordedFrames: number; effectiveFps: number | null }) {
  return {
    metadata: {
      date: new Date().toISOString(),
      totalSquats: args.slices.length,
      globalFrames: args.recordedFrames,
      fpsTarget: 60,
      effectiveFps: args.effectiveFps
    },
    squatActions: args.slices
  }
}

