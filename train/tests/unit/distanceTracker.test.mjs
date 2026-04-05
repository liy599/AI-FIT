import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DistanceTracker } from '../../src/lib/pose/distanceTracker.ts'

function makeLandmarks({ shoulderSpan = 0.5, visibility = 1 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }))

  lm[0] = { x: 0.5, y: 0.2, z: 0, visibility }
  lm[11] = { x: 0.5 - shoulderSpan / 2, y: 0.26, z: 0, visibility }
  lm[12] = { x: 0.5 + shoulderSpan / 2, y: 0.26, z: 0, visibility }
  lm[23] = { x: 0.46, y: 0.31, z: 0, visibility }
  lm[24] = { x: 0.54, y: 0.31, z: 0, visibility }
  lm[25] = { x: 0.46, y: 0.33, z: 0, visibility }
  lm[26] = { x: 0.54, y: 0.33, z: 0, visibility }
  lm[27] = { x: 0.46, y: 0.34, z: 0, visibility }
  lm[28] = { x: 0.54, y: 0.34, z: 0, visibility }

  return lm
}

test('DistanceTracker：准备期结束后根据相对尺度给出过近/合适/过远', () => {
  const tracker = new DistanceTracker(4000)

  const s0 = tracker.ingest({ tMs: 0, landmarks: makeLandmarks({ shoulderSpan: 0.5 }), worldLandmarks: null })
  assert.equal(s0.status, 'calibrating')
  assert.equal(s0.label, 'unknown')

  const sReady = tracker.ingest({ tMs: 4000, landmarks: makeLandmarks({ shoulderSpan: 0.5 }), worldLandmarks: null })
  assert.equal(sReady.status, 'ready')
  assert.equal(sReady.label, 'ok')

  const sClose = tracker.ingest({ tMs: 5000, landmarks: makeLandmarks({ shoulderSpan: 0.6 }), worldLandmarks: null })
  assert.equal(sClose.status, 'ready')
  assert.equal(sClose.label, 'too_close')

  const sFar = tracker.ingest({ tMs: 6000, landmarks: makeLandmarks({ shoulderSpan: 0.4 }), worldLandmarks: null })
  assert.equal(sFar.status, 'ready')
  assert.equal(sFar.label, 'too_far')
})
