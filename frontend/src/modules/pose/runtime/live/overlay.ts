import { drawDistanceGuide, drawMidpointSkeleton, drawPoseJoints17 } from '../../vision/draw'
import type { DistanceState } from '../../vision/distanceTracker'
import type { TrackingState } from '../../vision/movenetTracker'
import type { RealtimeFeedback } from '../../analyzer/types'

type CameraViewport = { x: number; y: number; w: number; h: number } | null

type DrawLivePoseOverlayArgs = {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  feedback: RealtimeFeedback
  trackingState: TrackingState | null
  distanceState: DistanceState | null
  drawMode: 'midline' | 'full17'
  viewport: CameraViewport
}

// Keep drawing rules outside the live processing loop so rendering can evolve
// without changing camera/model orchestration.
export function drawLivePoseOverlay(args: DrawLivePoseOverlayArgs) {
  const overlayColor = args.feedback.issues.length > 0 ? 'bad' : args.feedback.warnings.length > 0 ? 'warn' : 'ok'
  const transform = args.viewport ? { viewport: args.viewport, mirror: true } : { mirror: true }

  if (args.trackingState && args.drawMode === 'full17' && args.trackingState.joints2d.length > 0) {
    drawPoseJoints17(args.ctx, args.trackingState.joints2d, args.canvasWidth, args.canvasHeight, overlayColor, transform)
  } else if (args.trackingState && args.trackingState.joints2d.length > 0) {
    drawMidpointSkeleton(args.ctx, args.trackingState.joints2d, args.canvasWidth, args.canvasHeight, overlayColor, transform)
  }

  if (args.distanceState) {
    drawDistanceGuide(
      args.ctx,
      args.distanceState,
      args.canvasWidth,
      args.canvasHeight,
      args.viewport ? { viewport: args.viewport, mirror: true, showTarget: true } : { mirror: true, showTarget: true }
    )
  }
}

