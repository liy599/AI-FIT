import type { NormalizedLandmark } from './mediapipePose'
import { angleDeg, angleFromVerticalDeg, avg, avgNullable, centerOfMass33, clamp01, midpointLandmark, std } from './poseMetrics'

export type PoseFrame = {
  tsMs: number
  quality: number
  joints: {
    left: { shoulder: number; hip: number; knee: number; ankle: number }
    right: { shoulder: number; hip: number; knee: number; ankle: number }
  }
  metrics: {
    kneeLeftDeg: number | null
    kneeRightDeg: number | null
    kneeAvgDeg: number | null
    hipLeftDeg: number | null
    hipRightDeg: number | null
    hipAvgDeg: number | null
    torsoInclineLeftDeg: number | null
    torsoInclineRightDeg: number | null
    torsoInclineAbsDeg: number | null
    centerX: number | null
    centerY: number | null
    centerZ: number | null
    speed: number | null
    speedX: number | null
    speedY: number | null
    stabilityScore: number | null
  }
}

export function buildPoseFrame(
  landmarks: NormalizedLandmark[],
  tsMs: number,
  ctx?: {
    prev?: PoseFrame | null
    stabilityWindow?: PoseFrame[] | null
    stabilityWindowMs?: number
  }
): PoseFrame {
  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  const lHip = landmarks[23]
  const rHip = landmarks[24]
  const lKnee = landmarks[25]
  const rKnee = landmarks[26]
  const lAnkle = landmarks[27]
  const rAnkle = landmarks[28]

  const visible = (p: NormalizedLandmark | undefined) => (p && (p.visibility ?? 0) >= 0.15 ? p : undefined)
  const lShoulderV = visible(lShoulder)
  const rShoulderV = visible(rShoulder)
  const lHipV = visible(lHip)
  const rHipV = visible(rHip)
  const lKneeV = visible(lKnee)
  const rKneeV = visible(rKnee)
  const lAnkleV = visible(lAnkle)
  const rAnkleV = visible(rAnkle)

  const midShoulder = midpointLandmark(lShoulderV, rShoulderV)
  const midHip = midpointLandmark(lHipV, rHipV)
  const midKnee = midpointLandmark(lKneeV, rKneeV)
  const midAnkle = midpointLandmark(lAnkleV, rAnkleV)

  const quality = avg([
    lShoulder?.visibility ?? 0,
    rShoulder?.visibility ?? 0,
    lHip?.visibility ?? 0,
    rHip?.visibility ?? 0,
    lKnee?.visibility ?? 0,
    rKnee?.visibility ?? 0,
    lAnkle?.visibility ?? 0,
    rAnkle?.visibility ?? 0
  ])

  const kneeLeftDeg = angleDeg(lHipV, lKneeV, lAnkleV)
  const kneeRightDeg = angleDeg(rHipV, rKneeV, rAnkleV)
  const hipLeftDeg = angleDeg(lShoulderV, lHipV, lKneeV)
  const hipRightDeg = angleDeg(rShoulderV, rHipV, rKneeV)
  const torsoInclineLeftDeg = angleFromVerticalDeg(lShoulderV, lHipV)
  const torsoInclineRightDeg = angleFromVerticalDeg(rShoulderV, rHipV)
  const kneeMidDeg = angleDeg(midHip, midKnee, midAnkle)
  const hipMidDeg = angleDeg(midShoulder, midHip, midKnee)
  const torsoMidDeg = angleFromVerticalDeg(midShoulder, midHip)
  const center = centerOfMass33(landmarks)
  const centerX = center?.x ?? null
  const centerY = center?.y ?? null
  const centerZ = center?.z ?? null

  const prev = ctx?.prev ?? null
  const dtMs = prev ? tsMs - prev.tsMs : 0
  const hasCenters =
    typeof centerX === 'number' &&
    typeof centerY === 'number' &&
    typeof prev?.metrics.centerX === 'number' &&
    typeof prev?.metrics.centerY === 'number'
  const dtSec = dtMs > 0 ? dtMs / 1000 : 0
  const speedX = hasCenters && dtSec > 0 ? (centerX - (prev?.metrics.centerX as number)) / dtSec : null
  const speedY = hasCenters && dtSec > 0 ? (centerY - (prev?.metrics.centerY as number)) / dtSec : null
  const speed = typeof speedX === 'number' && typeof speedY === 'number' ? Math.hypot(speedX, speedY) : null

  const stabilityWindowMs = ctx?.stabilityWindowMs ?? 900
  const window = (ctx?.stabilityWindow ?? []).filter((f) => tsMs - f.tsMs <= stabilityWindowMs)
  const stabilityScore = computeStabilityScore([...window], { centerX, centerY })

  return {
    tsMs,
    quality,
    joints: {
      left: {
        shoulder: lShoulder?.visibility ?? 0,
        hip: lHip?.visibility ?? 0,
        knee: lKnee?.visibility ?? 0,
        ankle: lAnkle?.visibility ?? 0
      },
      right: {
        shoulder: rShoulder?.visibility ?? 0,
        hip: rHip?.visibility ?? 0,
        knee: rKnee?.visibility ?? 0,
        ankle: rAnkle?.visibility ?? 0
      }
    },
    metrics: {
      kneeLeftDeg,
      kneeRightDeg,
      kneeAvgDeg: kneeMidDeg ?? avgNullable([kneeLeftDeg, kneeRightDeg]),
      hipLeftDeg,
      hipRightDeg,
      hipAvgDeg: hipMidDeg ?? avgNullable([hipLeftDeg, hipRightDeg]),
      torsoInclineLeftDeg,
      torsoInclineRightDeg,
      torsoInclineAbsDeg: torsoMidDeg ?? avgNullable([torsoInclineLeftDeg, torsoInclineRightDeg]),
      centerX,
      centerY,
      centerZ,
      speed,
      speedX,
      speedY,
      stabilityScore
    }
  }
}

function computeStabilityScore(window: PoseFrame[], current: { centerX: number | null; centerY: number | null }) {
  const xs: number[] = []
  const ys: number[] = []
  for (const frame of window) {
    if (typeof frame.metrics.centerX === 'number' && typeof frame.metrics.centerY === 'number') {
      xs.push(frame.metrics.centerX)
      ys.push(frame.metrics.centerY)
    }
  }
  if (typeof current.centerX === 'number' && typeof current.centerY === 'number') {
    xs.push(current.centerX)
    ys.push(current.centerY)
  }
  if (xs.length < 6) return null
  const jitter = Math.hypot(std(xs), std(ys))
  const score01 = clamp01(1 - jitter / 0.028)
  return Math.round(score01 * 100)
}
