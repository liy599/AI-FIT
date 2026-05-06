import { useEffect, useMemo, useRef, useState } from 'react'

import type { PoseAnalysisReport } from '../reporting/types'
import type { PosePolicyRuntime } from '../policy'
import { buildOfflineTaskUi } from './toolUi'
import { useOfflinePoseAnalysis } from './offline/analysis'
import { useOfflineFileHandler } from './offline/file'
import { useOfflineReplayOverlay } from './offline/replayOverlay'
import type { OfflineOverlayTone, OfflineProgress, OfflineReplayData, PoseToolMode } from './types'

type PoseExerciseRuntimeMeta = {
  id: string
  slug: string
  displayName: string
  exerciseType: string
}

export function useOfflinePoseRuntime(args: {
  exercise: PoseExerciseRuntimeMeta
  policy: PosePolicyRuntime
  user: unknown
  mode: PoseToolMode
}) {
  const { exercise, policy, user, mode } = args
  const offlineFileInputRef = useRef<HTMLInputElement | null>(null)
  const offlineVideoRef = useRef<HTMLVideoElement | null>(null)
  const offlineCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const offlineReplayDataRef = useRef<OfflineReplayData | null>(null)
  const offlineReplayRafRef = useRef<number | null>(null)
  const offlineOverlayUiRef = useRef<{ tone: OfflineOverlayTone | null; message: string | null }>({ tone: null, message: null })
  const offlineDrawNowRef = useRef<(() => void) | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const drawModeRef = useRef<'midline' | 'full17'>('full17')

  const [offlineFile, setOfflineFile] = useState<File | null>(null)
  const [offlinePreviewUrl, setOfflinePreviewUrl] = useState<string | null>(null)
  const [offlineViewAngle, setOfflineViewAngle] = useState<'unknown' | 'front' | 'side' | 'back'>(
    exercise.slug === 'lateral-raise' ? 'front' : 'side'
  )
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(null)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineReport, setOfflineReport] = useState<PoseAnalysisReport | null>(null)
  const [offlineStatusMsg, setOfflineStatusMsg] = useState<string | null>(null)
  const [offlineReportSessionId, setOfflineReportSessionId] = useState<number | null>(null)
  const [offlineArchiveStatus, setOfflineArchiveStatus] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')
  const [offlineLocalStatus, setOfflineLocalStatus] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle')
  const [offlineRunStarted, setOfflineRunStarted] = useState(false)
  const [offlineCompletedStep, setOfflineCompletedStep] = useState(0)
  const [offlineOverlayTone, setOfflineOverlayTone] = useState<OfflineOverlayTone | null>(null)
  const [offlineOverlayMessage, setOfflineOverlayMessage] = useState<string | null>(null)
  const [offlineOverlayReady, setOfflineOverlayReady] = useState(false)
  const [drawMode, setDrawMode] = useState<'midline' | 'full17'>('full17')

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  useEffect(() => {
    resetOfflineState()
    setOfflineViewAngle(exercise.slug === 'lateral-raise' ? 'front' : 'side')
  }, [exercise.slug])

  useEffect(() => {
    return () => {
      if (offlineReplayRafRef.current !== null) cancelAnimationFrame(offlineReplayRafRef.current)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  useOfflineReplayOverlay({
    mode,
    drawMode,
    drawModeRef,
    offlineOverlayReady,
    offlinePreviewUrl,
    offlineVideoRef,
    offlineCanvasRef,
    offlineReplayDataRef,
    offlineReplayRafRef,
    offlineOverlayUiRef,
    offlineDrawNowRef,
    setOfflineOverlayTone,
    setOfflineOverlayMessage
  })

  function resetOfflineState() {
    setOfflineFile(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineLocalStatus('idle')
    setOfflineRunStarted(false)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineStatusMsg(null)
    setOfflineProgress(null)
    setOfflineOverlayTone(null)
    setOfflineOverlayMessage(null)
    setOfflineOverlayReady(false)
    offlineReplayDataRef.current = null
    if (offlineReplayRafRef.current !== null) {
      cancelAnimationFrame(offlineReplayRafRef.current)
      offlineReplayRafRef.current = null
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setOfflinePreviewUrl(null)
    if (offlineFileInputRef.current) offlineFileInputRef.current.value = ''
  }

  const handleOfflineFileChange = useOfflineFileHandler({
    maxVideoBytes: policy.maxVideoBytes,
    offlineFileInputRef,
    offlineCanvasRef,
    offlineReplayDataRef,
    offlineReplayRafRef,
    previewUrlRef,
    setOfflineFile,
    setOfflineReport,
    setOfflineReportSessionId,
    setOfflineArchiveStatus,
    setOfflineLocalStatus,
    setOfflineRunStarted,
    setOfflineCompletedStep,
    setOfflineError,
    setOfflineStatusMsg,
    setOfflineProgress,
    setOfflineOverlayTone,
    setOfflineOverlayMessage,
    setOfflineOverlayReady,
    setOfflinePreviewUrl
  })

  const runOfflineAnalysis = useOfflinePoseAnalysis({
    offlineFile,
    posePolicy: policy.posePolicy,
    offlineViewAngle,
    exercise: { id: exercise.id, slug: exercise.slug, displayName: exercise.displayName, exerciseType: exercise.exerciseType },
    tempoFastThresholdSec: policy.tempoFastThresholdSec,
    posePolicyVersion: policy.posePolicyVersion,
    poseRuntimeRules: policy.poseRuntimeRules,
    user,
    offlineReplayDataRef,
    setOfflineBusy,
    setOfflineRunStarted,
    setOfflineCompletedStep,
    setOfflineError,
    setOfflineReport,
    setOfflineReportSessionId,
    setOfflineArchiveStatus,
    setOfflineLocalStatus,
    setOfflineStatusMsg,
    setOfflineProgress,
    setOfflineOverlayTone,
    setOfflineOverlayMessage,
    setOfflineOverlayReady
  })

  const taskUi = useMemo(
    () =>
      buildOfflineTaskUi({
        offlineBusy,
        offlineLocalStatus,
        offlineRunStarted,
        offlineCompletedStep,
        offlineProgressStage: offlineProgress?.stage ?? null,
        hasOfflineReport: !!offlineReport,
        offlineArchiveStatus
      }),
    [offlineArchiveStatus, offlineBusy, offlineCompletedStep, offlineLocalStatus, offlineProgress?.stage, offlineReport, offlineRunStarted]
  )

  return {
    offlineReport,
    offlineReportSessionId,
    analysisPanelProps: {
      posePolicyVersion: policy.posePolicyVersion,
      localInferenceOnly: policy.localInferenceOnly,
      offlineFile,
      offlineBusy,
      offlinePreviewUrl,
      offlineOverlayReady,
      offlineOverlayTone,
      offlineOverlayMessage,
      offlineProgress,
      offlineStatusMsg,
      offlineError,
      drawMode,
      offlineFileInputRef,
      offlineVideoRef,
      offlineCanvasRef,
      onChooseFile: () => offlineFileInputRef.current?.click(),
      onFileChange: (file: File | null) => void handleOfflineFileChange(file),
      onAnalyze: () => void runOfflineAnalysis(),
      onDrawModeChange: setDrawMode
    },
    reportPanelProps: {
      taskStatusToneClass: taskUi.taskStatusToneClass,
      taskStatusText: taskUi.taskStatusText,
      offlineFileSizeMbText: offlineFile ? `${Math.round(offlineFile.size / 1024 / 1024)} MB` : 'Not selected',
      analysisStarted: taskUi.analysisStarted,
      checklist: taskUi.checklist,
      offlineReport
    }
  }
}
