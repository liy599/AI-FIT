import type { DistanceState } from '../distanceTracker'
import type { TrackingState } from '../movenetTracker'
import type { PoseExerciseSlug } from '../exercises'
import type { RealtimeFeedback } from '../realtimeSquat'

export type QualityGateCode =
  | 'OK'
  | 'DEVICE_ERROR'
  | 'OUT_OF_FRAME'
  | 'TRACKING_CALIBRATING'
  | 'TRACKING_LOST'
  | 'DISTANCE_CALIBRATING'
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'WRONG_ANGLE'
  | 'LOW_CONFIDENCE'

export type QualityGateStatus = {
  code: QualityGateCode
  paused: boolean
  title: string
  reason: string
  fix: string
}

export function evaluateQualityGate(input: {
  exerciseSlug: PoseExerciseSlug
  deviceError: string | null
  hasLandmarks: boolean
  tracking: TrackingState | null
  distance: DistanceState | null
  feedback: RealtimeFeedback | null
}): QualityGateStatus {
  const code: QualityGateCode = (() => {
    if (input.deviceError) return 'DEVICE_ERROR'
    if (!input.hasLandmarks) return 'OUT_OF_FRAME'
    if (input.tracking?.status === 'lost') return 'TRACKING_LOST'
    if (input.tracking?.status === 'calibrating') return 'TRACKING_CALIBRATING'
    if (input.distance?.status === 'lost') return 'TRACKING_LOST'
    if (input.distance?.status === 'calibrating') return 'DISTANCE_CALIBRATING'
    if (input.distance?.label === 'too_close') return 'TOO_CLOSE'
    if (input.distance?.label === 'too_far') return 'TOO_FAR'
    if (input.exerciseSlug === 'squat' && typeof input.feedback?.offsetAngle === 'number' && input.feedback.offsetAngle > 55) return 'WRONG_ANGLE'
    if (input.feedback?.isCountingPaused) return 'LOW_CONFIDENCE'
    return 'OK'
  })()

  const copy = gateCopy(code)
  return { code, paused: code !== 'OK', ...copy }
}

function gateCopy(code: QualityGateCode) {
  const map: Record<QualityGateCode, Pick<QualityGateStatus, 'title' | 'reason' | 'fix'>> = {
    OK: {
      title: 'Tracking stable',
      reason: 'All quality checks passed. Rep counting and stage tracking are active.',
      fix: 'Keep your full body in frame with steady lighting.'
    },
    DEVICE_ERROR: {
      title: 'Camera/model error',
      reason: 'Pose detection is not available right now.',
      fix: 'Reload the page, grant camera permission, and close other apps using the camera.'
    },
    OUT_OF_FRAME: {
      title: 'Body not detected',
      reason: 'No stable body keypoints were detected in the current frame.',
      fix: 'Step back and keep your head-to-ankles visible. Improve lighting and avoid backlight.'
    },
    TRACKING_CALIBRATING: {
      title: 'Stabilizing tracking',
      reason: 'Tracking is calibrating. Form analysis is paused to avoid false feedback. Rep counting may continue when possible.',
      fix: 'Hold still briefly, then start squatting with a steady tempo.'
    },
    TRACKING_LOST: {
      title: 'Tracking lost',
      reason: 'Keypoints are unstable or missing. Form analysis is paused and rep counting may be unreliable.',
      fix: 'Re-center in frame, improve lighting, and keep your full body visible.'
    },
    DISTANCE_CALIBRATING: {
      title: 'Calibrating distance',
      reason: 'Distance baseline is calibrating. Form analysis is paused for stable feedback. Rep counting may continue when possible.',
      fix: 'Stand still for a moment at your target distance.'
    },
    TOO_CLOSE: {
      title: 'Camera too close',
      reason: 'Your body appears too large in frame for stable full-body tracking.',
      fix: 'Step back so your full body stays visible (including ankles) during the entire rep.'
    },
    TOO_FAR: {
      title: 'Camera too far',
      reason: 'Your body appears too small in frame. Keypoints may be noisy.',
      fix: 'Move closer until your full body is clearly visible and centered.'
    },
    WRONG_ANGLE: {
      title: 'Side view required',
      reason: 'The camera angle is not a clear side view, which makes squat analysis unreliable.',
      fix: 'Place the camera directly side-on at hip height, 2–3 meters away.'
    },
    LOW_CONFIDENCE: {
      title: 'Low keypoint confidence',
      reason: 'Key joints are not tracked reliably, so form analysis is paused. Rep counting may continue, but quality judgment may be less reliable.',
      fix: 'Improve front lighting, avoid occlusion, and keep your full body in frame.'
    }
  }
  return map[code]
}
