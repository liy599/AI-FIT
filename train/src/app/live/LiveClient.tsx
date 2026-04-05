'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { RealtimeSquatAnalyzer, type RealtimeFeedback } from '@/lib/pose/realtimeSquat'
import { drawDistanceGuide, drawMidpointSkeleton } from '@/lib/pose/draw'
import { mediapipeToMoveNetFrame, MoveNetStabilizer, type MoveNetName, type TrackingState } from '@/lib/pose/movenetTracker'
import { createBestRealtimePoseProvider, type RealtimePoseProvider } from '@/lib/pose/livePoseProvider'
import { openPdfPrint } from '@/lib/print'
import { DistanceTracker, type DistanceState } from '@/lib/pose/distanceTracker'
import { normalizeReportForArchive, renderReportPdfBodyHtml } from '@/lib/report/unified'
import { useSession } from '@/lib/client/useSession'
import { buildMoveNetSquatExport, type SquatFrame, type SquatSlice } from '@/lib/movenet/squatExport'
import Link from 'next/link'

const CAMERA_MIRROR_KEY = 'train_cameraMirror'
const CAMERA_ZOOM_KEY = 'train_cameraZoom'
const CAMERA_VIEWPORT_WIDTH_KEY = 'train_cameraViewportWidth'
const LIVE_TARGET_FPS = 30
const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS

const VIEWPORT_PRESETS: Array<{ label: string; width: number }> = [
  { label: 'S', width: 320 },
  { label: 'M', width: 420 },
  { label: 'L', width: 520 },
  { label: 'XL', width: 560 }
]

type HistorySaveResponse = { session?: { id?: string } }
type PwMockScenario = 'complete' | 'half' | 'rhythm'

async function readJsonOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const err =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : fallbackError
    throw new Error(err)
  }
  if (data === null || data === undefined) throw new Error(fallbackError)
  return data as T
}

function buildPwMockFeedback(s: PwMockScenario): RealtimeFeedback {
  const base: RealtimeFeedback = {
    phase: 'up',
    state: 's1',
    mode: 'beginner',
    kneeAngle: 165,
    hipAngle: 155,
    torsoAngle: 32,
    kneeVerticalAngle: 22,
    offsetAngle: 8,
    trackingQuality: 0.98,
    isCountingPaused: false,
    warnings: [],
    issues: [],
    stateSequence: [],
    lastRepResult: null,
    lastRepMessage: null,
    lastRepReasonCodes: [],
    lastRepReasonLabels: [],
    lastRepCorrections: [],
    correctCount: 0,
    incorrectCount: 0,
    repCount: 0,
    lastRepFrameCount: null,
    inactiveSeconds: 0,
    session: {
      totalReps: 0,
      correctReps: 0,
      incorrectReps: 0,
      accuracyPct: 0,
      depthInsufficientCount: 0,
      kneeOverToeCount: 0,
      forwardLeanCount: 0,
      backwardLeanCount: 0,
      sideViewWarningCount: 0
    }
  }
  if (s === 'complete') {
    return {
      ...base,
      lastRepResult: 'correct',
      lastRepMessage: 'Good rep.',
      repCount: 1,
      lastRepFrameCount: 32,
      correctCount: 1,
      session: { ...base.session, totalReps: 1, correctReps: 1, accuracyPct: 100 }
    }
  }
  if (s === 'half') {
    return {
      ...base,
      kneeAngle: 142,
      lastRepResult: 'incorrect',
      lastRepMessage: 'Not standard: depth is insufficient.',
      lastRepReasonCodes: ['DEPTH_INSUFFICIENT'],
      lastRepReasonLabels: ['Depth insufficient'],
      lastRepCorrections: ['Go lower to the bottom position while keeping your hips stable.'],
      repCount: 2,
      lastRepFrameCount: 27,
      correctCount: 1,
      incorrectCount: 1,
      issues: [{ message: 'Depth is insufficient', joints: [23, 24, 25, 26] }],
      session: { ...base.session, totalReps: 2, correctReps: 1, incorrectReps: 1, accuracyPct: 50, depthInsufficientCount: 1 }
    }
  }
  return {
    ...base,
    lastRepResult: 'incorrect',
    lastRepMessage: 'Not standard: rhythm break.',
    lastRepReasonCodes: ['RHYTHM_BREAK'],
    lastRepReasonLabels: ['Rhythm break'],
    lastRepCorrections: ['Slow down and keep the descent/ascent continuous and steady.'],
    repCount: 3,
    lastRepFrameCount: 24,
    correctCount: 1,
    incorrectCount: 2,
    issues: [{ message: 'Rhythm break', joints: [23, 24, 25, 26, 27, 28] }],
    session: { ...base.session, totalReps: 3, correctReps: 1, incorrectReps: 2, accuracyPct: 33, depthInsufficientCount: 1 }
  }
}

export default function LiveClient({ exerciseId }: { exerciseId?: string }) {
  const { loading, session } = useSession()
  if (loading) {
    return (
      <div className="emptyCard card">
        <div className="cardInner emptyInner">
          <div className="emptyTitle">Loading…</div>
        </div>
      </div>
    )
  }
  if (!session) {
    return <LoginCtaCard title="Sign in to start live coaching" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
  }
  return <LiveClientInner exerciseId={exerciseId ?? null} />
}

function LiveClientInner({ exerciseId }: { exerciseId: string | null }) {
  const [pwMockScenario] = useState<PwMockScenario | null>(() => {
    if (typeof window === 'undefined') return null
    const q = new URLSearchParams(window.location.search).get('pwMock')
    return q === 'complete' || q === 'half' || q === 'rhythm' ? q : null
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null)
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [distance, setDistance] = useState<DistanceState | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('Initializing model…')
  const [modelName, setModelName] = useState<string>('Model not ready')
  const [cameraMirror, setCameraMirror] = useState(true)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [cameraViewportWidth, setCameraViewportWidth] = useState(420)
  const [mirrorLoading, setMirrorLoading] = useState(true)
  const [effectiveFps, setEffectiveFps] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [techRepCount, setTechRepCount] = useState(0)
  const [savingHistory, setSavingHistory] = useState(false)
  const [savedTrainingId, setSavedTrainingId] = useState<string | null>(null)
  const [historySaveMsg, setHistorySaveMsg] = useState<string | null>(null)
  const [historySaveTone, setHistorySaveTone] = useState<'success' | 'error' | null>(null)
  const viewportSize = cameraViewportWidth <= 320 ? 'sm' : cameraViewportWidth <= 420 ? 'md' : cameraViewportWidth <= 520 ? 'lg' : 'xl'

  const analyzerRef = useRef<RealtimeSquatAnalyzer | null>(null)
  const stabilizerRef = useRef<MoveNetStabilizer | null>(null)
  const distanceTrackerRef = useRef<DistanceTracker | null>(null)
  const lastDistanceRef = useRef<DistanceState | null>(null)
  const fpsRef = useRef<{ windowStart: number; frames: number }>({ windowStart: performance.now(), frames: 0 })
  const lastProcessedTsRef = useRef(0)
  const pathColorRef = useRef<'ok' | 'bad'>('bad')
  const recordingRef = useRef(false)
  const squatSlicesRef = useRef<SquatSlice[]>([])
  const currentSquatFramesRef = useRef<SquatFrame[]>([])
  const isRecordingSliceRef = useRef(false)
  const recordedFramesRef = useRef(0)
  const lastRepCountRef = useRef(0)
  const feedbackHistoryRef = useRef<
    Array<{
      ts: string
      state: RealtimeFeedback['state']
      phase: RealtimeFeedback['phase']
      score: number | null
      kneeVerticalAngle: number | null
      torsoAngle: number | null
      offsetAngle: number | null
    }>
  >([])

  function startRecording() {
    squatSlicesRef.current = []
    currentSquatFramesRef.current = []
    isRecordingSliceRef.current = false
    recordedFramesRef.current = 0
    lastRepCountRef.current = feedback?.repCount ?? 0
    setTechRepCount(0)
    recordingRef.current = true
    setRecording(true)
  }

  function stopAndDownload() {
    recordingRef.current = false
    setRecording(false)
    isRecordingSliceRef.current = false
    currentSquatFramesRef.current = []

    const exportData = buildMoveNetSquatExport({
      slices: squatSlicesRef.current,
      recordedFrames: recordedFramesRef.current,
      effectiveFps: effectiveFps ?? null
    })
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `squat_analysis_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function buildLiveReport() {
    const now = new Date()
    const s = feedback?.session ?? null
    const issues = (feedback?.issues ?? []).map((x) => ({
      code: 'REALTIME_ISSUE',
      severity: 'error' as const,
      message: x.message,
      atFrame: null
    }))
    const warnings = (feedback?.warnings ?? []).map((x) => ({
      code: 'REALTIME_WARNING',
      severity: 'warning' as const,
      message: x,
      atFrame: null
    }))
    const summary = s ? `Live session: total ${s.totalReps} · good ${s.correctReps} · not-good ${s.incorrectReps} · ${s.accuracyPct}%` : 'Live session: no stats'

    const timeline = feedbackHistoryRef.current
    const timelineSampled = timeline.length <= 5 ? timeline : [timeline[0], timeline[Math.floor(timeline.length / 2)], timeline[timeline.length - 1]].filter(Boolean)

    const report = {
      version: 3,
      generatedAt: now.toISOString(),
      status: 'ok' as const,
      task: { id: 'live', viewAngle: 'side', instruction: null },
      exercise: null,
      video: null,
      summary,
      keyMetrics: {
        modelName,
        mode: 'standard',
        totalReps: s?.totalReps ?? 0,
        correctReps: s?.correctReps ?? 0,
        incorrectReps: s?.incorrectReps ?? 0,
        accuracyPct: s?.accuracyPct ?? 0,
        depthInsufficientCount: s?.depthInsufficientCount ?? 0,
        kneeOverToeCount: s?.kneeOverToeCount ?? 0,
        forwardLeanCount: s?.forwardLeanCount ?? 0,
        backwardLeanCount: s?.backwardLeanCount ?? 0,
        sideViewWarningCount: s?.sideViewWarningCount ?? 0
      },
      issues: [...issues, ...warnings],
      suggestions: (feedback?.warnings ?? []).slice(0, 8),
      details: {
        type: 'realtime_squat',
        lastRep: feedback ? { result: feedback.lastRepResult, message: feedback.lastRepMessage } : null,
        timelineSampled
      }
    }
    return report
  }

  async function saveLiveReportToHistory() {
    if (!exerciseId) {
      setSavedTrainingId(null)
      setHistorySaveTone('error')
      setHistorySaveMsg('No exercise selected. Please enter Live Coaching from Training first.')
      return
    }
    setSavingHistory(true)
    setSavedTrainingId(null)
    setHistorySaveMsg(null)
    setHistorySaveTone(null)
    let createdTrainingId: string | null = null
    let completed = false
    try {
      const createRes = await fetch('/api/v1/private/trainings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Live coaching session' })
      })
      const created = await readJsonOrThrow<HistorySaveResponse>(createRes, 'Failed to create training session')
      const trainingId = created.session?.id
      if (!trainingId) throw new Error('Training session id is missing')
      createdTrainingId = trainingId

      const rawReps = Math.max(0, techRepCount)
      const reps = rawReps > 0 ? rawReps : 1
      const upsertRes = await fetch(`/api/v1/private/trainings/${encodeURIComponent(trainingId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: `Saved from Live Coaching (${new Date().toLocaleString('en-US')})`,
          sets: [
            {
              exerciseId,
              reps,
              weight: null,
              note: rawReps > 0 ? `Live coaching: ${rawReps} reps` : 'Live coaching: 0 reps (saved as 1 rep placeholder to persist report)'
            }
          ]
        })
      })
      await readJsonOrThrow<{ session?: { id?: string } }>(upsertRes, 'Failed to write training sets')

      const report = normalizeReportForArchive(buildLiveReport())
      const completeRes = await fetch(`/api/v1/private/trainings/${encodeURIComponent(trainingId)}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report })
      })
      await readJsonOrThrow<{ session?: { id?: string } }>(completeRes, 'Failed to save report')
      completed = true

      setSavedTrainingId(trainingId)
      setHistorySaveTone('success')
      setHistorySaveMsg('Saved to history. Click “View saved report” to open details.')
    } catch (e) {
      if (createdTrainingId && !completed) {
        await fetch(`/api/v1/private/trainings/${encodeURIComponent(createdTrainingId)}`, {
          method: 'DELETE',
          credentials: 'include'
        }).catch(() => null)
      }
      setHistorySaveTone('error')
      setHistorySaveMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingHistory(false)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch('/api/v1/private/camera/settings', { method: 'GET', cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as null | {
            settings?: { cameraMirror?: unknown; cameraZoom?: unknown; cameraViewportWidth?: unknown }
          }
          const v = data?.settings?.cameraMirror
          const z = data?.settings?.cameraZoom
          const w = data?.settings?.cameraViewportWidth
          if (mounted) {
            setCameraMirror(typeof v === 'boolean' ? v : true)
            setCameraZoom(typeof z === 'number' && Number.isFinite(z) ? Math.min(2, Math.max(0.5, z)) : 1)
            setCameraViewportWidth(typeof w === 'number' && Number.isFinite(w) ? w : 420)
          }
          return
        }
        const local = window.localStorage.getItem(CAMERA_MIRROR_KEY)
        const localZoom = window.localStorage.getItem(CAMERA_ZOOM_KEY)
        const localWidth = window.localStorage.getItem(CAMERA_VIEWPORT_WIDTH_KEY)
        const parsedZoom = localZoom === null ? 1 : Number(localZoom)
        const parsedWidth = localWidth === null ? 420 : Number(localWidth)
        if (mounted) {
          setCameraMirror(local === null ? true : local === '1')
          setCameraZoom(Number.isFinite(parsedZoom) ? Math.min(2, Math.max(0.5, parsedZoom)) : 1)
          setCameraViewportWidth(Number.isFinite(parsedWidth) ? Math.round(parsedWidth) : 420)
        }
      } finally {
        if (mounted) setMirrorLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  async function saveCameraSettings(patch: { cameraMirror?: boolean; cameraZoom?: number; cameraViewportWidth?: number }) {
    if (typeof patch.cameraMirror === 'boolean') {
      setCameraMirror(patch.cameraMirror)
      window.localStorage.setItem(CAMERA_MIRROR_KEY, patch.cameraMirror ? '1' : '0')
    }
    if (typeof patch.cameraZoom === 'number' && Number.isFinite(patch.cameraZoom)) {
      const z = Math.min(2, Math.max(0.5, patch.cameraZoom))
      setCameraZoom(z)
      window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
    }
    if (typeof patch.cameraViewportWidth === 'number' && Number.isFinite(patch.cameraViewportWidth)) {
      const w = Math.round(patch.cameraViewportWidth)
      setCameraViewportWidth(w)
      window.localStorage.setItem(CAMERA_VIEWPORT_WIDTH_KEY, String(w))
    }
    try {
      const res = await fetch('/api/v1/private/camera/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      if (!res.ok) return
      const data = (await res.json().catch(() => null)) as null | {
        settings?: { cameraMirror?: unknown; cameraZoom?: unknown; cameraViewportWidth?: unknown }
      }
      const v = data?.settings?.cameraMirror
      const z = data?.settings?.cameraZoom
      const w = data?.settings?.cameraViewportWidth
      if (typeof v === 'boolean') {
        window.localStorage.setItem(CAMERA_MIRROR_KEY, v ? '1' : '0')
        setCameraMirror(v)
      }
      if (typeof z === 'number' && Number.isFinite(z)) {
        window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
        setCameraZoom(Math.min(2, Math.max(0.5, z)))
      }
      if (typeof w === 'number' && Number.isFinite(w)) {
        window.localStorage.setItem(CAMERA_VIEWPORT_WIDTH_KEY, String(w))
        setCameraViewportWidth(w)
      }
    } catch {}
  }

  useEffect(() => {
    let active = true
    let provider: RealtimePoseProvider | null = null
    let rafId = 0
    const videoEl = videoRef.current

    async function init() {
      if (pwMockScenario) {
        setFeedback(buildPwMockFeedback(pwMockScenario))
        setTechRepCount(pwMockScenario === 'complete' ? 1 : pwMockScenario === 'half' ? 2 : 3)
        setIsCameraReady(true)
        setLoadingMsg('')
        return
      }
      try {
        if (!analyzerRef.current) {
          analyzerRef.current = new RealtimeSquatAnalyzer('beginner')
        }
        if (!stabilizerRef.current) {
          stabilizerRef.current = new MoveNetStabilizer(4000)
        }
        if (!distanceTrackerRef.current) {
          distanceTrackerRef.current = new DistanceTracker(4000)
        }

        provider = await createBestRealtimePoseProvider()
        setModelName(provider.modelName === 'movenet_lightning' ? 'MoveNet Lightning' : provider.modelName)

        if (!active) return

        setLoadingMsg('Requesting camera permission…')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 60, max: 60 }, aspectRatio: { ideal: 9 / 16 }, facingMode: 'user' }
        })

        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        if (!videoEl) return
        videoEl.srcObject = stream
        void videoEl.play()

        videoEl.onloadeddata = () => {
          setIsCameraReady(true)
          setLoadingMsg('')
          if (canvasRef.current) {
            const vw = videoEl.videoWidth
            const vh = videoEl.videoHeight
            if (vw && vh) {
              canvasRef.current.width = vw
              canvasRef.current.height = vh
            }
          }
          let busy = false

          async function tick() {
            if (!videoEl || !canvasRef.current || !active || !provider) return
            const frameTs = performance.now()
            if (frameTs - lastProcessedTsRef.current < LIVE_TARGET_FRAME_MS) {
              rafId = requestAnimationFrame(() => {
                void tick()
              })
              return
            }
            if (busy) {
              rafId = requestAnimationFrame(() => {
                void tick()
              })
              return
            }
            busy = true
            lastProcessedTsRef.current = frameTs

            try {
              const ctx = canvasRef.current.getContext('2d')
              if (ctx) {
                ctx.save()
                const cw = canvasRef.current.width
                const ch = canvasRef.current.height
                ctx.clearRect(0, 0, cw, ch)

                const detected = await provider.detect(videoEl, performance.now())
                const landmarks = detected.landmarks
                const worldLandmarks = detected.worldLandmarks
                const lastDistance = lastDistanceRef.current

                if (landmarks && analyzerRef.current) {
                    const ts = performance.now()
                    const fb = analyzerRef.current.analyze(landmarks)
                    setFeedback(fb)
                    feedbackHistoryRef.current.push({
                      ts: new Date().toISOString(),
                      state: fb.state,
                      phase: fb.phase,
                      score: null,
                      kneeVerticalAngle: fb.kneeVerticalAngle,
                      torsoAngle: fb.torsoAngle,
                      offsetAngle: fb.offsetAngle
                    })
                    if (feedbackHistoryRef.current.length > 1200) feedbackHistoryRef.current.shift()
                    const moveNetFrame = mediapipeToMoveNetFrame(landmarks, ts)
                    const trackingState = stabilizerRef.current?.ingest(moveNetFrame) ?? null
                    setTracking(trackingState)

                    const distanceState = distanceTrackerRef.current?.ingest({ tMs: ts, landmarks, worldLandmarks }) ?? null
                    setDistance(distanceState)
                    lastDistanceRef.current = distanceState

                    if (trackingState) {
                      drawMidpointSkeleton(ctx, trackingState.joints2d, cw, ch, pathColorRef.current)
                    }
                    if (distanceState) {
                      drawDistanceGuide(ctx, distanceState, cw, ch)
                    }

                    if (recordingRef.current && trackingState) {
                      const byName = new Map<MoveNetName, { x: number; y: number; score: number }>()
                      for (const j of trackingState.joints2d) byName.set(j.name, { x: j.x, y: j.y, score: j.score })
                      const threshold = 0.2
                      const mid = (l: MoveNetName, r: MoveNetName) => {
                        const a = byName.get(l)
                        const b = byName.get(r)
                        const av = !!a && a.score >= threshold
                        const bv = !!b && b.score >= threshold
                        if (av && bv) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, s: (a.score + b.score) / 2 }
                        if (av) return { x: a.x, y: a.y, s: a.score }
                        if (bv) return { x: b.x, y: b.y, s: b.score }
                        return null
                      }

                      const midShoulder = mid('left_shoulder', 'right_shoulder')
                      const midHip = mid('left_hip', 'right_hip')
                      const midKnee = mid('left_knee', 'right_knee')
                      const midAnkle = mid('left_ankle', 'right_ankle')

                      const keypoints = [midShoulder, midHip, midKnee, midAnkle]
                        .filter((p): p is { x: number; y: number; s: number } => !!p)
                        .map((p) => ({ x: Math.round(p.x * cw), y: Math.round(p.y * ch), s: Number(p.s.toFixed(2)) }))

                      recordedFramesRef.current += 1
                      const nowTs = Date.now()
                      const angle = typeof fb.kneeAngle === 'number' ? fb.kneeAngle : 0
                      const frameData: SquatFrame = { timestamp: nowTs, kneeAngle: angle, keypoints }
                      const repIncreased = fb.repCount > lastRepCountRef.current
                      if (!isRecordingSliceRef.current && fb.phase !== 'up') {
                        isRecordingSliceRef.current = true
                        currentSquatFramesRef.current = []
                      }
                      if (isRecordingSliceRef.current) {
                        currentSquatFramesRef.current.push(frameData)
                      }
                      if (isRecordingSliceRef.current && repIncreased && fb.phase === 'up') {
                        const frames = currentSquatFramesRef.current
                        isRecordingSliceRef.current = false
                        if (frames.length > 0) {
                          const last = frames[frames.length - 1]!
                          squatSlicesRef.current.push({
                            squatIndex: squatSlicesRef.current.length + 1,
                            startTime: frames[0]!.timestamp,
                            endTime: last.timestamp,
                            frameCount: frames.length,
                            frames: [...frames]
                          })
                          setTechRepCount(squatSlicesRef.current.length)
                        }
                        currentSquatFramesRef.current = []
                      }
                      if (repIncreased) lastRepCountRef.current = fb.repCount
                    }

                    setTechRepCount((prev) => (prev === fb.repCount ? prev : fb.repCount))
                } else {
                    setFeedback(null)
                    setTracking(null)
                    setDistance(lastDistance ? { ...lastDistance, status: 'lost', label: 'unknown', ratio: null, currentBox: null } : null)
                }

                const now = performance.now()
                const bucket = fpsRef.current
                if (now - bucket.windowStart >= 1000) {
                  setEffectiveFps(bucket.frames)
                  fpsRef.current = { windowStart: now, frames: 0 }
                } else {
                  bucket.frames += 1
                }

                ctx.restore()
              }
            } finally {
              busy = false
            }
            rafId = requestAnimationFrame(() => {
              void tick()
            })
          }
          void tick()
        }

      } catch (err: unknown) {
        console.error(err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        setLoadingMsg('Initialization failed: ' + message)
      }
    }

    init()

    return () => {
      active = false
      if (rafId) cancelAnimationFrame(rafId)
      provider?.close()
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [pwMockScenario])

  const historySaveStateText = savingHistory ? 'Saving…' : historySaveTone === 'success' ? 'Saved' : historySaveTone === 'error' ? 'Failed' : 'Not saved'
  const historySaveStateColor = savingHistory ? '#1d4ed8' : historySaveTone === 'success' ? '#166534' : historySaveTone === 'error' ? '#b91c1c' : '#64748b'
  const firstReminder = feedback?.warnings?.[0] ?? feedback?.issues?.[0]?.message ?? feedback?.lastRepMessage ?? 'Keep a steady tempo. Align knees with toes.'
  const distanceReminder =
    distance?.label === 'too_close'
      ? 'Camera: too close — step back a little'
      : distance?.label === 'too_far'
        ? 'Camera: too far — step closer'
        : distance?.label === 'ok'
          ? 'Camera: distance OK'
          : 'Camera: keep your full body in frame'
  const sessionSummary = feedback?.session
    ? `Total ${feedback.session.totalReps} · Good ${feedback.session.correctReps} · Not-good ${feedback.session.incorrectReps} · ${feedback.session.accuracyPct}%`
    : 'No session stats'

  const rangeEval = evaluateKneeDrivenRange(feedback)
  const currentInRange = rangeEval.ok
  const pathColor = currentInRange ? 'ok' : 'bad'
  pathColorRef.current = pathColor
  const rangeStatusText = currentInRange ? 'In range' : 'Out of range'
  const rangePrimaryReason =
    rangeEval.reasons[0] ??
    (feedback?.lastRepReasonLabels && feedback.lastRepReasonLabels.length > 0 ? feedback.lastRepReasonLabels[0]! : null)
  const primarySuggestion = rangeEval.suggestion ?? feedback?.lastRepCorrections?.[0] ?? firstReminder

  return (
    <div className="liveWrap" data-vp={viewportSize} style={{ '--live-viewport-width': `${cameraViewportWidth}px` } as CSSProperties}>
      <div className="liveLeft">
        <div className="liveTopBar">
          <div className="liveTopTitle">Live Preview</div>
          <div className="liveTopRight">
            <div className="liveCtrl">
              <span className="liveTopLabel">Mirror</span>
              <label className="switch" aria-label="Mirror">
                <input
                  className="switchInput"
                  type="checkbox"
                  checked={cameraMirror}
                  disabled={mirrorLoading}
                  onChange={(e) => void saveCameraSettings({ cameraMirror: e.target.checked })}
                />
                <span className="switchTrack" aria-hidden="true" />
                <span className="switchThumb" aria-hidden="true" />
              </label>
            </div>

            <div className="liveCtrl">
              <span className="liveTopLabel">Size</span>
              <div className="liveBtnGroup" role="group" aria-label="Preview size">
                {VIEWPORT_PRESETS.map((p) => (
                  <button
                    key={p.width}
                    className={cameraViewportWidth === p.width ? 'liveBtn liveBtnActive' : 'liveBtn'}
                    disabled={mirrorLoading}
                    onClick={() => void saveCameraSettings({ cameraViewportWidth: p.width })}
                    type="button"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="liveCtrl">
              <span className="liveTopLabel">Zoom</span>
              <input
                className="liveRange"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={cameraZoom}
                disabled={mirrorLoading}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (!Number.isFinite(next)) return
                  const z = Math.min(2, Math.max(0.5, next))
                  setCameraZoom(z)
                  window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
                }}
                onMouseUp={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                onTouchEnd={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                onBlur={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                aria-label="Zoom"
              />
              <span className="liveValue">{cameraZoom.toFixed(2)}x</span>
            </div>

            <div className="liveCtrl">
              <span className="liveTopLabel">Record</span>
              <div className="liveBtnGroup" role="group" aria-label="Motion recording">
                {!recording ? (
                  <button className="liveBtn" type="button" disabled={!tracking || tracking.status !== 'tracking'} onClick={startRecording}>
                    Start
                  </button>
                ) : (
                  <button className="liveBtn liveBtnActive" type="button" onClick={stopAndDownload}>
                    Stop & Download
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="liveViewport">
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 12, pointerEvents: 'none' }}>
            <div className="liveHud">
              <div className="liveHudTop">
                <span className={currentInRange ? 'liveStatusDot liveStatusDotOk' : 'liveStatusDot liveStatusDotBad'} />
                <span className="liveHudLabel">Rep Count</span>
              </div>
              <div className="liveHudValue">{techRepCount}</div>
              <div className="liveHudMeta">
                {recording ? 'Recording' : 'Not recording'} · FPS target {LIVE_TARGET_FPS} / effective {effectiveFps ?? '-'}
              </div>
            </div>
          </div>
          {loadingMsg && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 10 }}>
              {loadingMsg}
            </div>
          )}
          <div
            className={cameraMirror ? 'liveStage liveStageMirror' : 'liveStage'}
            style={{ '--live-zoom': String(cameraZoom) } as CSSProperties}
          >
            <video
              ref={videoRef}
              className="liveMedia"
              style={{ display: isCameraReady ? 'block' : 'none' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="liveMedia"
              width={720}
              height={1280}
              style={{ zIndex: 5 }}
            />
          </div>
        </div>
      </div>

      <div className="livePanel">
        <h2 className="livePanelTitle">Live Feedback</h2>

        <div className="liveCard" style={{ marginTop: 12 }}>
          <div className="liveCardTitle">Key Angles</div>
          <div className="liveKpiGrid">
            <Metric label="Knee Angle" value={feedback?.kneeAngle} unit="°" />
            <Metric label="Hip Angle" value={feedback?.hipAngle} unit="°" />
            <Metric label="Side Offset" value={feedback?.offsetAngle} unit="°" />
          </div>
        </div>

        <div className="liveCard">
          <div className="liveCardTitle">Range Check</div>
          <div className="liveStatusRow">
            <span className={currentInRange ? 'liveStatusPill liveStatusPillOk' : 'liveStatusPill liveStatusPillBad'}>{rangeStatusText}</span>
            <span className="liveStatusText">{rangePrimaryReason ?? '—'}</span>
          </div>
          <div className="liveMetaRow">Frames in last rep: {feedback?.lastRepFrameCount ?? '-'}</div>
        </div>

        <div className="liveCard">
          <div className="liveCardTitle">Coaching Tip</div>
          <div className="liveSuggestion">{primarySuggestion}</div>
          <div className="liveMetaRow">{distanceReminder}</div>
        </div>

        <div className="liveCard" style={{ marginTop: 0 }}>
          <div className="liveCardTitle">Session Actions</div>
          <div className="liveMetaRow">Summary: {sessionSummary} · Model {modelName} · FPS {effectiveFps ?? '-'}</div>
          <div className="liveMetaRow" style={{ color: historySaveStateColor }}>
            History: {historySaveStateText}
          </div>
          <div className="liveActions">
            <button
              onClick={() => {
                analyzerRef.current?.resetSession()
                feedbackHistoryRef.current = []
                lastRepCountRef.current = 0
                isRecordingSliceRef.current = false
                currentSquatFramesRef.current = []
                squatSlicesRef.current = []
                setFeedback(null)
                setTechRepCount(0)
                setSavedTrainingId(null)
                setHistorySaveTone(null)
                setHistorySaveMsg(null)
              }}
            >
              Reset Session
            </button>
            <button
              className="btn btnOutline"
              type="button"
              onClick={() => {
                const now = new Date().toLocaleString('en-US')
                const title = `Live Report - ${modelName}`
                const body = renderReportPdfBodyHtml(buildLiveReport(), { title, nowText: now })
                openPdfPrint(title, body)
              }}
            >
              Export PDF
            </button>
            <button
              onClick={() => {
                const archived = normalizeReportForArchive(buildLiveReport())
                const blob = new Blob([JSON.stringify(archived, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `squat-session-${Date.now()}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export Report JSON
            </button>
            <button onClick={() => void saveLiveReportToHistory()} disabled={savingHistory || !exerciseId}>
              {savingHistory ? 'Saving…' : 'Save to History'}
            </button>
            {savedTrainingId ? (
              <Link className="btn btnOutline" href={`/train/session?trainingId=${encodeURIComponent(savedTrainingId)}`}>
                View saved report
              </Link>
            ) : null}
            <Link className="btn btnOutline" href="/history">
              Go to History
            </Link>
          </div>
          {!exerciseId ? <div className="liveWarnText">This session is not linked to an exercise, so it cannot be saved.</div> : null}
          {historySaveMsg ? (
            <div className={historySaveTone === 'error' ? 'liveMsg liveMsgError' : 'liveMsg liveMsgSuccess'}>{historySaveMsg}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value?: number | null; unit: string }) {
  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>
        {value !== undefined && value !== null ? `${value}${unit}` : '-'}
      </div>
    </div>
  )
}

function evaluateKneeDrivenRange(feedback: RealtimeFeedback | null) {
  if (!feedback) return { ok: false, reasons: ['No person detected'], suggestion: 'Keep your full body in frame and use a side view.' }
  const knee = feedback.kneeAngle
  const hip = feedback.hipAngle
  if (knee === null || hip === null) {
    return { ok: false, reasons: ['Incomplete angle data'], suggestion: 'Hold still and keep keypoints visible.' }
  }

  const binStart = Math.max(0, Math.min(170, Math.floor(knee / 10) * 10))
  const binEnd = binStart + 10
  const hipRange = { min: Math.max(0, binStart - 10), max: Math.min(180, binEnd + 10) }

  const reasons: string[] = []
  if (hip < hipRange.min || hip > hipRange.max) reasons.push(`Hip angle out of range (expected ${hipRange.min}-${hipRange.max}°)`)
  const ok = reasons.length === 0

  return {
    ok,
    reasons,
    suggestion: ok
      ? `Knee ${knee}° is in range. Keep it up.`
      : `Knee ${knee}° maps to ${binStart}-${binEnd}°. Adjust hip angle back into range first.`
  }
}
