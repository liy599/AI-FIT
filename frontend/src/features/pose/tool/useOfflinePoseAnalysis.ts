import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { PoseAnalysisReport } from '../../../lib/pose/report'
import type { PoseCapabilities, PosePolicy } from '../../../lib/poseApi'
import type { SquatTuning } from '../../../lib/pose/realtimeSquatAnalyzer'
import type { OfflineOverlayTone, OfflineProgress, OfflineReplayData } from './types'

type ExerciseMeta = {
  id: string
  slug: string
  displayName: string
  exerciseType: string
}

type UseOfflinePoseAnalysisArgs = {
  offlineFile: File | null
  offlineProcessingMode: 'local' | 'server'
  poseCapabilities: PoseCapabilities | null
  posePolicy: PosePolicy | null
  offlineServerConsent: boolean
  offlineViewAngle: 'unknown' | 'front' | 'side' | 'back'
  exercise: ExerciseMeta
  liveSquatTuning: SquatTuning
  user: unknown
  offlineReplayDataRef: MutableRefObject<OfflineReplayData | null>
  setOfflineBusy: Dispatch<SetStateAction<boolean>>
  setOfflineRunStarted: Dispatch<SetStateAction<boolean>>
  setOfflineCompletedStep: Dispatch<SetStateAction<number>>
  setOfflineError: Dispatch<SetStateAction<string | null>>
  setOfflineReport: Dispatch<SetStateAction<PoseAnalysisReport | null>>
  setOfflineReportSessionId: Dispatch<SetStateAction<number | null>>
  setOfflineArchiveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'done' | 'failed'>>
  setOfflineLocalStatus: Dispatch<SetStateAction<'idle' | 'running' | 'succeeded' | 'failed'>>
  setOfflineStatusMsg: Dispatch<SetStateAction<string | null>>
  setOfflineProgress: Dispatch<SetStateAction<OfflineProgress>>
  setOfflineOverlayTone: Dispatch<SetStateAction<OfflineOverlayTone | null>>
  setOfflineOverlayMessage: Dispatch<SetStateAction<string | null>>
  setOfflineOverlayReady: Dispatch<SetStateAction<boolean>>
  setOfflineServerTaskId: Dispatch<SetStateAction<number | null>>
  submitPoseServerAnalysis: (input: {
    file: File
    exercise_type: string
    view_angle: 'unknown' | 'front' | 'side' | 'back'
    consent: boolean
  }) => Promise<{ task: { id: number } }>
  extractNativePoseFromVideoUrlWithMoveNet: (url: string, options: Record<string, unknown>) => Promise<{ nativeFrames: any[]; fps: number }>
  buildSquatVideoLiveStyleReport: (input: any) => any
  buildPullupVideoLiveStyleReport: (input: any) => any
  buildLateralRaiseVideoLiveStyleReport: (input: any) => any
  buildBentOverRowVideoLiveStyleReport: (input: any) => any
  buildPushupVideoLiveStyleReport: (input: any) => any
  humanizePoseReport: (report: any) => any
  buildOfflineOverlayFrames: (input: {
    exerciseSlug: string
    fps: number
    nativeFrames: any[]
    squatTuning?: Partial<SquatTuning>
    onProgress?: (processed: number, total: number) => void
  }) => Array<{ tMs: number; tone: OfflineOverlayTone; message: string | null }>
  createPoseTraining: (payload: any) => Promise<{ id: number }>
  getRepsFromReport: (report: PoseAnalysisReport) => number
  buildTrainingRecordName: (input: { startedAt: string; exerciseName: string }) => string
}

export function useOfflinePoseAnalysis(args: UseOfflinePoseAnalysisArgs) {
  return useCallback(async () => {
    const {
      offlineFile,
      offlineProcessingMode,
      poseCapabilities,
      posePolicy,
      offlineServerConsent,
      offlineViewAngle,
      exercise,
      liveSquatTuning,
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
      setOfflineOverlayReady,
      setOfflineServerTaskId,
      submitPoseServerAnalysis,
      extractNativePoseFromVideoUrlWithMoveNet,
      buildSquatVideoLiveStyleReport,
      buildPullupVideoLiveStyleReport,
      buildLateralRaiseVideoLiveStyleReport,
      buildBentOverRowVideoLiveStyleReport,
      buildPushupVideoLiveStyleReport,
      humanizePoseReport,
      buildOfflineOverlayFrames,
      createPoseTraining,
      getRepsFromReport,
      buildTrainingRecordName
    } = args

    if (!offlineFile) {
      setOfflineError('Please choose a video file first.')
      return
    }
    const allowedActions = posePolicy?.offline?.allowed_actions ?? ['squat', 'pushup', 'pullup', 'lateral-raise', 'bent-over-row']
    if (!allowedActions.includes(exercise.slug)) {
      setOfflineError(`Offline analysis for "${exercise.displayName}" is disabled until a dedicated replay analyzer and report builder are implemented.`)
      return
    }

    if (offlineProcessingMode === 'server') {
      if (!poseCapabilities?.server_inference?.enabled) {
        setOfflineError('Server-side inference is currently disabled by the system administrator.')
        return
      }
      if (!offlineServerConsent) {
        setOfflineError('Please confirm consent before enabling server-side inference upload.')
        return
      }
      try {
        setOfflineBusy(true)
        setOfflineError(null)
        setOfflineStatusMsg('Submitting encrypted upload for server inference...')
        const result = await submitPoseServerAnalysis({
          file: offlineFile,
          exercise_type: exercise.exerciseType,
          view_angle: offlineViewAngle,
          consent: true
        })
        setOfflineServerTaskId(result.task.id)
        setOfflineStatusMsg('Server task queued. You can switch back to Local mode anytime for on-device processing.')
        setOfflineLocalStatus('idle')
      } catch (e: unknown) {
        setOfflineError(e instanceof Error ? e.message : 'Server submission failed')
      } finally {
        setOfflineBusy(false)
      }
      return
    }

    setOfflineBusy(true)
    setOfflineRunStarted(true)
    setOfflineCompletedStep(0)
    setOfflineError(null)
    setOfflineReport(null)
    setOfflineReportSessionId(null)
    setOfflineArchiveStatus('idle')
    setOfflineLocalStatus('running')
    setOfflineStatusMsg(null)
    setOfflineProgress({ stage: 'Preparing local video', processed: 0, total: 1 })
    setOfflineOverlayTone(null)
    setOfflineOverlayMessage(null)
    setOfflineOverlayReady(false)
    offlineReplayDataRef.current = null

    let localObjectUrl: string | null = null
    try {
      localObjectUrl = URL.createObjectURL(offlineFile)
      setOfflineCompletedStep(1)
      setOfflineStatusMsg('Local video ready. Extracting pose keypoints...')
      setOfflineProgress({ stage: 'Preparing local video', processed: 1, total: 1 })

      const effectiveViewAngle: 'unknown' | 'front' | 'side' | 'back' =
        exercise.slug === 'squat' ? 'side' : exercise.slug === 'pullup' || exercise.slug === 'lateral-raise' ? 'front' : exercise.slug === 'bent-over-row' ? 'side' : offlineViewAngle
      const localVideoMeta = {
        id: `local-${Date.now()}`,
        originalName: offlineFile.name,
        mimeType: offlineFile.type || 'video/mp4',
        sizeBytes: offlineFile.size
      }

      const offlineTargetFps = Number(posePolicy?.offline?.analysis_target_fps ?? 40)
      const offlineAnalysisLimitSec = Number(posePolicy?.offline?.analysis_limit_seconds ?? 120)
      const offlineAnalysisMaxFrames = Math.max(1, Math.floor(offlineTargetFps * offlineAnalysisLimitSec))
      const extracted = await extractNativePoseFromVideoUrlWithMoveNet(localObjectUrl, {
        targetFps: offlineTargetFps,
        maxFrames: offlineAnalysisMaxFrames,
        maxDurationSec: offlineAnalysisLimitSec,
        detectorVariant: 'lightning',
        preferPlaybackSampling: false,
        onProgress: (p: { stage: string; processed: number; total: number }) => {
          setOfflineProgress({
            stage: p.stage === 'loading' ? 'Loading MoveNet model' : 'Extracting pose keypoints',
            processed: p.processed,
            total: p.total
          })
        }
      })
      let extractedNativeFrames = extracted.nativeFrames
      const extractedFps = extracted.fps
      const baseT = (typeof extractedNativeFrames[0]?.tMs === 'number' && Number.isFinite(extractedNativeFrames[0]!.tMs) ? extractedNativeFrames[0]!.tMs : 0) ?? 0
      const baseTms = Number.isFinite(baseT) && baseT > 0 ? baseT : 0
      if (baseTms > 0) extractedNativeFrames = extractedNativeFrames.map((f) => ({ ...f, tMs: Math.max(0, f.tMs - baseTms) }))
      if (exercise.slug === 'squat' && !extractedNativeFrames.length) throw new Error('No native MoveNet keypoints were extracted from this video. Please try another file.')
      URL.revokeObjectURL(localObjectUrl)
      localObjectUrl = null
      setOfflineCompletedStep(2)

      const taskId = `local-${Date.now()}`
      const squatTuningForVideo = exercise.slug === 'squat' ? { ...liveSquatTuning } : undefined
      const baseInput = {
        taskId,
        viewAngle: effectiveViewAngle,
        exercise: { id: exercise.id, name: exercise.exerciseType },
        video: localVideoMeta,
        fps: extractedFps,
        nativeFrames: extractedNativeFrames
      }
      const rawReport =
        exercise.slug === 'squat'
          ? buildSquatVideoLiveStyleReport({ ...baseInput, tuning: squatTuningForVideo, onProgress: (processed: number, total: number) => setOfflineProgress({ stage: 'Replaying real-time squat analyzer', processed, total }) })
          : exercise.slug === 'pullup'
            ? buildPullupVideoLiveStyleReport({ ...baseInput, onProgress: (processed: number, total: number) => setOfflineProgress({ stage: 'Replaying real-time pull-up analyzer', processed, total }) })
            : exercise.slug === 'lateral-raise'
              ? buildLateralRaiseVideoLiveStyleReport({ ...baseInput, onProgress: (processed: number, total: number) => setOfflineProgress({ stage: 'Replaying real-time lateral-raise analyzer', processed, total }) })
              : exercise.slug === 'bent-over-row'
                ? buildBentOverRowVideoLiveStyleReport({ ...baseInput, onProgress: (processed: number, total: number) => setOfflineProgress({ stage: 'Replaying real-time bent-over-row analyzer', processed, total }) })
                : buildPushupVideoLiveStyleReport({ ...baseInput, onProgress: (processed: number, total: number) => setOfflineProgress({ stage: 'Replaying real-time push-up analyzer', processed, total }) })

      setOfflineCompletedStep(3)
      const report = humanizePoseReport(rawReport) as PoseAnalysisReport
      setOfflineProgress({ stage: 'Building replay overlay', processed: 0, total: extractedNativeFrames.length })
      const overlayFrames = buildOfflineOverlayFrames({
        exerciseSlug: exercise.slug,
        fps: extractedFps,
        nativeFrames: extractedNativeFrames,
        squatTuning: squatTuningForVideo,
        onProgress: (processed, total) => setOfflineProgress({ stage: 'Building replay overlay', processed, total })
      })
      offlineReplayDataRef.current = { fps: extractedFps, nativeFrames: extractedNativeFrames, overlayFrames }
      setOfflineOverlayReady(true)

      setOfflineProgress({ stage: 'Finalizing local report', processed: 1, total: 1 })
      setOfflineReport(report)
      setOfflineLocalStatus('succeeded')
      setOfflineCompletedStep(4)
      try {
        if (!user) throw new Error('Please log in if you want to save this local report to training history.')
        setOfflineArchiveStatus('saving')
        const reps = getRepsFromReport(report)
        const startedAt = new Date(Date.now() - Math.max(1000, Math.round((extractedNativeFrames.length / Math.max(1, extractedFps)) * 1000))).toISOString()
        const session = await createPoseTraining({
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          exercise_type: exercise.exerciseType,
          note: buildTrainingRecordName({ startedAt, exerciseName: exercise.displayName }),
          sets: [{ reps, note: 'Auto-saved from video analysis report' }],
          report: report as Record<string, unknown>
        })
        setOfflineReportSessionId(session.id)
        setOfflineArchiveStatus('done')
        setOfflineCompletedStep(5)
        setOfflineStatusMsg('Local video analysis completed and archived. You can open the detailed report or training history.')
      } catch (archiveError: unknown) {
        setOfflineArchiveStatus('failed')
        const archiveMessage =
          archiveError instanceof Error && archiveError.message
            ? archiveError.message
            : 'Local video analysis completed. Report is ready; training archive save failed this time.'
        setOfflineStatusMsg(archiveMessage)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Video analysis failed'
      setOfflineError(message)
      setOfflineLocalStatus('failed')
    } finally {
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl)
      setOfflineBusy(false)
      setOfflineProgress(null)
    }
  }, [args])
}
