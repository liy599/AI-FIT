import { useEffect, useMemo, useRef, useState } from 'react'

import { DistanceTracker, type DistanceState } from '../vision/distanceTracker'
import { createBestRealtimePoseProvider } from '../vision/livePoseProvider'
import { prewarmMoveNet } from '../vision/movenetPose'
import { MoveNetStabilizer, type TrackingState } from '../vision/movenetTracker'
import type { RealtimeFeedback } from '../analyzer/types'
import { buildTrainingRecordName } from '../domain/trainingName'
import { createPoseTraining } from '../api'
import { configureAnalyzer, createAnalyzer, type RealtimeAnalyzer, type SquatRepFinding, type SquatTimelineRow } from '../helpers'
import { resolveAnalyzerTuning, type PosePolicyRuntime } from '../policy'
import {
  buildLiveReport,
  buildLiveSessionSummary,
  buildLiveTrainingPayload,
  humanizePoseReport,
  pickLiveMainTip,
  resolveResetLiveState,
  resolveStopLiveState,
  validateLiveTrainingSave
} from '../reporting'
import { cleanupLiveMedia } from './live/media'
import { resetLiveStats } from './live/stats'
import { startLiveDetectionSession } from './live/session'
import { usePoseModelWarmup } from './live/modelWarmup'
import { useRealtimePoseProvider } from './live/provider'
import { getRangeStatusText, POSE_TOOL_MESSAGES, poseToolErrorMessage } from './toolUi'
import { useThrottledMainTip } from './live/throttledTip'
import type { LiveSessionEndReason, LiveSessionStatus, LiveSessionSummary } from './types'

type PoseExerciseRuntimeMeta = {
  slug: string
  displayName: string
  exerciseType: string
}

export function useLivePoseRuntime(args: {
  exercise: PoseExerciseRuntimeMeta
  policy: PosePolicyRuntime
  user: unknown
}) {
  const { exercise, policy, user } = args
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const analyzerRef = useRef<RealtimeAnalyzer | null>(null)
  const stabilizerRef = useRef<MoveNetStabilizer | null>(null)
  const distanceTrackerRef = useRef<DistanceTracker | null>(null)
  const fpsRef = useRef<{ windowStart: number; frames: number }>({ windowStart: performance.now(), frames: 0 })
  const lastProcessedTsRef = useRef(0)
  const sessionStartedAtRef = useRef<string | null>(null)
  const sessionStartedPerfRef = useRef<number | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const previewScaleRef = useRef(0.78)
  const drawModeRef = useRef<'midline' | 'full17'>('full17')
  const feedbackRef = useRef<RealtimeFeedback | null>(null)
  const liveIssueFreqRef = useRef<Map<string, number>>(new Map())
  const liveTrackingQualitySamplesRef = useRef<number[]>([])
  const liveTimelineRowsRef = useRef<SquatTimelineRow[]>([])
  const liveRepFindingsRef = useRef<SquatRepFinding[]>([])
  const liveLastRepCountRef = useRef(0)
  const liveAnalyzedFrameCountRef = useRef(0)
  const { getProvider: getLiveProvider } = useRealtimePoseProvider(createBestRealtimePoseProvider)

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null)
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [distance, setDistance] = useState<DistanceState | null>(null)
  const [effectiveFps, setEffectiveFps] = useState<number | null>(null)
  const [drawMode, setDrawMode] = useState<'midline' | 'full17'>('full17')
  const [savingTraining, setSavingTraining] = useState(false)
  const [saveTrainingMsg, setSaveTrainingMsg] = useState<string | null>(null)
  const [, setSavedLiveSessionId] = useState<number | null>(null)
  const [previewScale, setPreviewScale] = useState(0.78)
  const [liveSessionStatus, setLiveSessionStatus] = useState<LiveSessionStatus>('idle')
  const [liveSessionEndReason, setLiveSessionEndReason] = useState<LiveSessionEndReason>(null)
  const [liveSessionElapsedMs, setLiveSessionElapsedMs] = useState(0)
  const [liveSessionSummary, setLiveSessionSummary] = useState<LiveSessionSummary | null>(null)

  useEffect(() => {
    previewScaleRef.current = previewScale
  }, [previewScale])

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  useEffect(() => {
    feedbackRef.current = feedback
  }, [feedback])

  usePoseModelWarmup(prewarmMoveNet)

  useEffect(() => {
    cleanupLiveMedia({ cleanupRef, videoRef })
    setRunning(false)
    setLoading(false)
    setLoadingMsg(null)
    setTracking(null)
    setDistance(null)

    try {
      analyzerRef.current = createAnalyzer(exercise.slug as never)
    } catch (e: unknown) {
      analyzerRef.current = null
      setError(e instanceof Error ? e.message : 'Analyzer initialization failed')
      return
    }
    configureAnalyzer(analyzerRef.current, exercise.slug as never, 'live', {
      tuningOverride: resolveAnalyzerTuning(exercise.slug, policy.poseRuntimeRules),
      analyzerFps: policy.liveTargetFps
    })
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    setLiveSessionSummary(null)
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    resetLiveDedicatedSessionStats()
  }, [exercise.slug])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const startedAt = sessionStartedPerfRef.current
      if (!startedAt) return
      const elapsed = Math.min(policy.liveSessionLimitMs, Math.max(0, performance.now() - startedAt))
      setLiveSessionElapsedMs(elapsed)
      if (elapsed >= policy.liveSessionLimitMs) stopLive('timeout')
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, policy.liveSessionLimitMs])

  useEffect(() => {
    return () => {
      cleanupLiveMedia({ cleanupRef, videoRef })
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const currentMainTip = useMemo(
    () =>
      pickLiveMainTip({
        exerciseSlug: exercise.slug,
        feedback: feedback
          ? {
              warnings: feedback.warnings ?? [],
              issues: feedback.issues?.map((x) => ({ message: x.message })) ?? [],
              lastRepMessage: feedback.lastRepMessage ?? null,
              lastRepReasonLabels: feedback.lastRepReasonLabels ?? []
            }
          : null
      }),
    [exercise.slug, feedback]
  )
  const displayMainTip = useThrottledMainTip(currentMainTip, 1000)
  const rangeStatusText = useMemo(() => getRangeStatusText(distance), [distance])

  function resetLiveDedicatedSessionStats() {
    resetLiveStats({
      issueFreqRef: liveIssueFreqRef,
      trackingQualitySamplesRef: liveTrackingQualitySamplesRef,
      timelineRowsRef: liveTimelineRowsRef,
      repFindingsRef: liveRepFindingsRef,
      lastRepCountRef: liveLastRepCountRef,
      analyzedFrameCountRef: liveAnalyzedFrameCountRef
    })
  }

  const liveReport = useMemo(
    () =>
      buildLiveReport({
        exercise: { slug: exercise.slug as never, displayName: exercise.displayName },
        taskId: sessionStartedAtRef.current ? `live-${sessionStartedAtRef.current}` : 'live-session',
        effectiveFps,
        liveTargetFps: policy.liveTargetFps,
        feedback,
        issueFreq: liveIssueFreqRef.current,
        analyzedFrameCount: liveAnalyzedFrameCountRef.current,
        trackingQualitySamples: liveTrackingQualitySamplesRef.current,
        timelineRows: liveTimelineRowsRef.current,
        repFindings: liveRepFindingsRef.current,
        currentMainTipLabel: currentMainTip.label,
        tempoFastThresholdSec: policy.tempoFastThresholdSec,
        poseRuntimeRules: policy.poseRuntimeRules
      }),
    [currentMainTip.label, effectiveFps, exercise.displayName, exercise.slug, feedback, policy.liveTargetFps, policy.tempoFastThresholdSec, policy.poseRuntimeRules]
  )

  async function startLive() {
    setError(null)
    setLoading(true)
    setLoadingMsg('Initializing model and camera...')
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    setLiveSessionStatus('idle')
    setLiveSessionEndReason(null)
    setLiveSessionElapsedMs(0)
    setLiveSessionSummary(null)
    sessionStartedPerfRef.current = null
    resetLiveDedicatedSessionStats()

    try {
      if (!analyzerRef.current) {
        try {
          analyzerRef.current = createAnalyzer(exercise.slug as never)
        } catch (e: unknown) {
          setLoading(false)
          setLoadingMsg(null)
          setError(e instanceof Error ? e.message : 'Analyzer initialization failed')
          return
        }
      }
      configureAnalyzer(analyzerRef.current, exercise.slug as never, 'live', {
        tuningOverride: resolveAnalyzerTuning(exercise.slug, policy.poseRuntimeRules),
        analyzerFps: policy.liveTargetFps
      })
      const provider = await getLiveProvider()
      cleanupRef.current = await startLiveDetectionSession({
        exerciseSlug: exercise.slug,
        provider,
        analyzer: analyzerRef.current,
        videoRef,
        canvasRef,
        stabilizerRef,
        distanceTrackerRef,
        fpsRef,
        lastProcessedTsRef,
        sessionStartedAtRef,
        sessionStartedPerfRef,
        previewScaleRef,
        drawModeRef,
        liveTargetFrameMs: policy.liveTargetFrameMs,
        issueFreqRef: liveIssueFreqRef,
        trackingQualitySamplesRef: liveTrackingQualitySamplesRef,
        timelineRowsRef: liveTimelineRowsRef,
        repFindingsRef: liveRepFindingsRef,
        lastRepCountRef: liveLastRepCountRef,
        analyzedFrameCountRef: liveAnalyzedFrameCountRef,
        onFeedback: setFeedback,
        onTracking: setTracking,
        onDistance: setDistance,
        onEffectiveFps: setEffectiveFps,
        onDetectionError: (e) => setError(e instanceof Error ? e.message : 'Live detection failed')
      })
      setRunning(true)
      setLoading(false)
      setLoadingMsg(null)
      setLiveSessionStatus('running')
    } catch (e: unknown) {
      setLoading(false)
      setLoadingMsg(null)
      setRunning(false)
      setLiveSessionStatus('idle')
      setError(e instanceof Error ? e.message : 'Unable to access the camera')
    }
  }

  function stopLive(reason: Exclude<LiveSessionEndReason, null> = 'manual') {
    const stopState = resolveStopLiveState({
      startedPerfAt: sessionStartedPerfRef.current,
      nowPerf: performance.now(),
      liveSessionLimitMs: policy.liveSessionLimitMs,
      liveSessionElapsedMs,
      reason
    })
    const snapshot = feedbackRef.current

    cleanupLiveMedia({ cleanupRef, videoRef })
    setRunning(false)
    setLoading(false)
    setLoadingMsg(null)
    setTracking(null)
    setDistance(null)
    setLiveSessionElapsedMs(stopState.elapsedMs)
    setLiveSessionStatus(stopState.status)
    setLiveSessionEndReason(stopState.endReason)
    setLiveSessionSummary(
      buildLiveSessionSummary({
        snapshot,
        elapsedMs: stopState.elapsedMs,
        exerciseSlug: exercise.slug as never,
        repFindings: liveRepFindingsRef.current,
        issueFreq: liveIssueFreqRef.current
      })
    )
    sessionStartedPerfRef.current = null
    if (reason === 'timeout') setSaveTrainingMsg('Session reached the 2-minute limit and stopped automatically.')
  }

  function resetLiveSession() {
    analyzerRef.current?.resetSession()
    resetLiveDedicatedSessionStats()
    setFeedback(null)
    setError(null)
    setSaveTrainingMsg(null)
    setSavedLiveSessionId(null)
    const resetState = resolveResetLiveState({
      running,
      nowIso: new Date().toISOString(),
      nowPerf: performance.now(),
      previousStartedAt: sessionStartedAtRef.current
    })
    sessionStartedAtRef.current = resetState.startedAt
    sessionStartedPerfRef.current = resetState.startedPerfAt
    setLiveSessionElapsedMs(0)
    setLiveSessionStatus(resetState.status)
    setLiveSessionEndReason(resetState.endReason)
    setLiveSessionSummary(null)
  }

  async function saveTrainingRecord() {
    const reps = feedback?.session.totalReps ?? 0
    const validationMsg = validateLiveTrainingSave(user, reps)
    if (validationMsg) {
      setSaveTrainingMsg(validationMsg)
      return
    }

    setSavingTraining(true)
    setSaveTrainingMsg(null)
    try {
      const startedAt = sessionStartedAtRef.current ?? new Date().toISOString()
      const payload = buildLiveTrainingPayload({
        startedAt,
        endedAt: new Date().toISOString(),
        exerciseType: exercise.exerciseType,
        exerciseDisplayName: exercise.displayName,
        reps,
        mainTipLabel: currentMainTip.label,
        report: humanizePoseReport(liveReport as never) as unknown as Record<string, unknown>,
        posePolicyVersion: policy.posePolicyVersion,
        buildTrainingRecordName
      })
      const session = await createPoseTraining(payload)
      setSaveTrainingMsg(`Saved training record #${session.id}`)
      setSavedLiveSessionId(session.id)
    } catch (e: unknown) {
      setSaveTrainingMsg(poseToolErrorMessage(e, POSE_TOOL_MESSAGES.liveTrainingSaveFailed))
    } finally {
      setSavingTraining(false)
    }
  }

  return {
    liveReport,
    panelProps: {
      running,
      loading,
      loadingMsg,
      error,
      liveSessionStatus,
      liveSessionEndReason,
      liveSessionElapsedMs,
      liveSessionLimitMs: policy.liveSessionLimitMs,
      liveSessionSummary,
      effectiveFps,
      tracking,
      feedback,
      rangeStatusText,
      displayMainTip,
      drawMode,
      previewScale,
      savingTraining,
      saveTrainingMsg,
      videoRef,
      canvasRef,
      onToggleLive: () => void (running ? stopLive() : startLive()),
      onResetLive: resetLiveSession,
      onSaveTraining: () => void saveTrainingRecord(),
      onDrawModeChange: setDrawMode,
      onPreviewScaleChange: setPreviewScale
    }
  }
}
