import assert from 'node:assert/strict'
import { test } from 'node:test'
import { angleDeg, angleFromVerticalDeg, midpointLandmark } from '../../src/lib/pose/poseMetrics'

function lm(x, y) {
  return { x, y, z: 0, visibility: 1 }
}

test('midpointLandmark returns midpoint', () => {
  const a = lm(0, 0)
  const b = lm(2, 2)
  const m = midpointLandmark(a, b)
  assert.ok(m)
  assert.equal(m.x, 1)
  assert.equal(m.y, 1)
})

test('angleDeg supports midpoint-based knee/hip angles', () => {
  const midShoulder = lm(0, 0)
  const midHip = lm(0, 1)
  const midKnee = lm(1, 1)
  const midAnkle = lm(2, 1)

  const hipAngle = angleDeg(midShoulder, midHip, midKnee)
  assert.equal(Math.round(hipAngle), 90)

  const kneeAngle = angleDeg(midHip, midKnee, midAnkle)
  assert.equal(Math.round(kneeAngle), 180)
})

test('angleFromVerticalDeg uses y-axis as vertical reference', () => {
  const top = lm(0, 0)
  const bottom = lm(1, 0)
  const a = angleFromVerticalDeg(top, bottom)
  assert.equal(Math.round(a), 90)
})
