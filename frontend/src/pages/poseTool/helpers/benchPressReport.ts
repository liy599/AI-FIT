import type { PoseAnalysisReport } from '../../../lib/pose/report'
import type { MoveNetKeypoint } from '../../../lib/pose/movenetTracker'

export function buildBenchPressAlignedReport(input: {
  source: 'live' | 'video'
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
}): PoseAnalysisReport {
  throw new Error('Bench press is disabled.')
}

export function buildBenchPressVideoLiveStyleReport(input: {
  taskId: string
  viewAngle: string
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  fps: number
  nativeFrames: Array<{ tMs: number; keypoints: MoveNetKeypoint[] }>
  onProgress?: (processed: number, total: number) => void
}): PoseAnalysisReport {
  throw new Error('Bench press is disabled.')
}

