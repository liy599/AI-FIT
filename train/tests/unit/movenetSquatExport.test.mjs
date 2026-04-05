import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildMoveNetSquatExport } from '../../src/lib/movenet/squatExport'

test('buildMoveNetSquatExport matches expected top-level shape', () => {
  const out = buildMoveNetSquatExport({
    slices: [
      {
        squatIndex: 1,
        startTime: 1000,
        endTime: 1200,
        frameCount: 2,
        frames: [
          { timestamp: 1000, kneeAngle: 160, keypoints: [{ x: 1, y: 2, s: 0.9 }] },
          { timestamp: 1100, kneeAngle: 95, keypoints: [{ x: 3, y: 4, s: 0.8 }] }
        ]
      }
    ],
    recordedFrames: 42,
    effectiveFps: 58
  })

  assert.ok(out.metadata)
  assert.equal(out.metadata.totalSquats, 1)
  assert.equal(out.metadata.globalFrames, 42)
  assert.equal(out.metadata.fpsTarget, 60)
  assert.equal(out.metadata.effectiveFps, 58)
  assert.ok(Array.isArray(out.squatActions))
  assert.equal(out.squatActions.length, 1)
})
