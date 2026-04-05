import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeSquatSide } from '../../src/lib/pose/squatSide.ts'

const DEG = Math.PI / 180

function blankLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
}

function setLm(lm, idx, p) {
  lm[idx] = { x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 }
}

function makeLeftSideFrame(tMs, opts) {
  const {
    kneeAngleDeg = 170,
    hipAngleDeg = 160,
    heelLiftRatio = 0,
    kneeOverToeRatio = 0,
    leftVisibility = 1
  } = opts ?? {}

  const lm = blankLandmarks()

  const hip = { x: 0.4, y: 0.6 }
  const scale = 0.12
  const knee = { x: hip.x + scale, y: hip.y }

  const kneeAlphaDeg = 180 - kneeAngleDeg
  const ankle = {
    x: knee.x + scale * Math.cos(kneeAlphaDeg * DEG),
    y: knee.y + scale * Math.sin(kneeAlphaDeg * DEG)
  }

  const shoulder = {
    x: hip.x + scale * Math.cos(hipAngleDeg * DEG),
    y: hip.y + scale * Math.sin(hipAngleDeg * DEG)
  }

  const heel = { x: ankle.x - 0.02, y: ankle.y - heelLiftRatio }
  const footIndex = { x: knee.x - kneeOverToeRatio, y: ankle.y + 0.03 }

  setLm(lm, 11, { ...shoulder, visibility: leftVisibility })
  setLm(lm, 23, { ...hip, visibility: leftVisibility })
  setLm(lm, 25, { ...knee, visibility: leftVisibility })
  setLm(lm, 27, { ...ankle, visibility: leftVisibility })
  setLm(lm, 29, { ...heel, visibility: leftVisibility })
  setLm(lm, 31, { ...footIndex, visibility: leftVisibility })

  setLm(lm, 12, { x: 0.6, y: 0.4, visibility: 0 })
  setLm(lm, 24, { x: 0.6, y: 0.6, visibility: 0 })
  setLm(lm, 26, { x: 0.6, y: 0.6, visibility: 0 })
  setLm(lm, 28, { x: 0.6, y: 0.7, visibility: 0 })

  setLm(lm, 0, { x: 0.5, y: 0.2, visibility: leftVisibility })

  return { tMs, landmarks: lm }
}

test('analyzeSquatSide：识别重复 + 深度不足阈值触发', () => {
  const frames = [
    makeLeftSideFrame(0, { kneeAngleDeg: 170 }),
    makeLeftSideFrame(33, { kneeAngleDeg: 170 }),
    makeLeftSideFrame(66, { kneeAngleDeg: 160 }),
    makeLeftSideFrame(99, { kneeAngleDeg: 145 }),
    makeLeftSideFrame(132, { kneeAngleDeg: 130 }),
    makeLeftSideFrame(165, { kneeAngleDeg: 138 }),
    makeLeftSideFrame(198, { kneeAngleDeg: 160 }),
    makeLeftSideFrame(231, { kneeAngleDeg: 170 })
  ]

  const analysis = analyzeSquatSide(frames)
  assert.equal(analysis.reps.length, 1)
  const rep = analysis.reps[0]
  assert.ok(rep.metrics.minKneeAngleDeg !== null)
  assert.ok(rep.metrics.minKneeAngleDeg > 115)
  assert.ok(rep.issues.some((x) => x.code === 'DEPTH_INSUFFICIENT'))
})

test('analyzeSquatSide：膝过脚尖 + 提踵阈值触发', () => {
  const frames = [
    makeLeftSideFrame(0, { kneeAngleDeg: 170 }),
    makeLeftSideFrame(33, { kneeAngleDeg: 165 }),
    makeLeftSideFrame(66, { kneeAngleDeg: 140, kneeOverToeRatio: 0.2, heelLiftRatio: 0.12 }),
    makeLeftSideFrame(99, { kneeAngleDeg: 112, kneeOverToeRatio: 0.2, heelLiftRatio: 0.12 }),
    makeLeftSideFrame(132, { kneeAngleDeg: 110, kneeOverToeRatio: 0.2, heelLiftRatio: 0.12 }),
    makeLeftSideFrame(165, { kneeAngleDeg: 140 }),
    makeLeftSideFrame(198, { kneeAngleDeg: 165 }),
    makeLeftSideFrame(231, { kneeAngleDeg: 170 })
  ]

  const analysis = analyzeSquatSide(frames)
  assert.equal(analysis.reps.length, 1)
  const rep = analysis.reps[0]
  assert.ok(rep.issues.some((x) => x.code === 'KNEE_TOO_FORWARD'))
  assert.ok(rep.issues.some((x) => x.code === 'HEEL_LIFT'))
})

