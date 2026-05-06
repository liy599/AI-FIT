import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { PoseAnalysisReport } from '../../reporting/types'
import { buildTrainingRecordName } from '../../domain/trainingName'
import { createPoseTraining, type PosePolicy } from '../../api'
import { getRepsFromReport } from '../../helpers/reportBase'
import { resolveAnalyzerTuning, type PoseRuntimeRules } from '../../policy'
import type { OfflineOverlayTone, OfflineProgress, OfflineReplayData } from '../types'
import { buildOfflineArchivePayload, resolveOfflineArchiveStatusMessage, validateOfflineArchiveUser } from '../../reporting/archive'
import {
  buildOfflinePoseReport,
  extractOfflinePoseFromLocalVideo,
  resolveOfflineViewAngle
} from '../../reporting/offlineReport'
import { buildOfflineOverlayFrames } from '../../reporting/overlayReplay'

type ExerciseMeta = {
  id: string
  slug: string
  displayName: string
  exerciseType: string
}

type UseOfflinePoseAnalysisArgs = {
  offlineFile: File | null
  posePolicy: PosePolicy | null
  offlineViewAngle: 'unknown' | 'front' | 'side' | 'back'
  exercise: ExerciseMeta
  tempoFastThresholdSec: number
  posePolicyVersion: string
  poseRuntimeRules: PoseRuntimeRules
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
}

// Keep the offline video pipeline inside the pose feature, so pages never depend on
// MoveNet extraction, action-specific report builders, or archive API details.
export function useOfflinePoseAnalysis(args: UseOfflinePoseAnalysisArgs) {
  return useCallback(async () => {
    const {
      offlineFile,
      posePolicy,
      offlineViewAngle,
      exercise,
      tempoFastThresholdSec,
      posePolicyVersion,
      poseRuntimeRules,
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
    } = args

    if (!offlineFile) {
      setOfflineError('Please choose a video file first.')
      return
    }
    const allowedActions = posePolicy?.offline?.allowed_actions ?? ['squat', 'pushup', 'lateral-raise', 'bent-over-row']
    if (!allowedActions.includes(exercise.slug)) {
      setOfflineError(`Offline analysis for "${exercise.displayName}" is disabled until a dedicated replay analyzer and report builder are implemented.`)
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

      const effectiveViewAngle = resolveOfflineViewAngle(exercise.slug, offlineViewAngle)
      const extracted = await extractOfflinePoseFromLocalVideo({
        file: offlineFile,
        objectUrl: localObjectUrl,
        posePolicy,
        setOfflineProgress
      })
      if (exercise.slug === 'squat' && !extracted.nativeFrames.length) throw new Error('No native MoveNet keypoints were extracted from this video. Please try another file.')
      URL.revokeObjectURL(localObjectUrl)
      localObjectUrl = null
      setOfflineCompletedStep(2)

      const taskId = `local-${Date.now()}`
      const analyzerTuning = resolveAnalyzerTuning(exercise.slug, poseRuntimeRules)
      const report = buildOfflinePoseReport({
        taskId,
        exercise,
        effectiveViewAngle,
        extracted,
        tempoFastThresholdSec,
        poseRuntimeRules,
        setOfflineProgress
      })

      setOfflineCompletedStep(3)
      setOfflineProgress({ stage: 'Building replay overlay', processed: 0, total: extracted.nativeFrames.length })
      const overlayFrames = buildOfflineOverlayFrames({
        exerciseSlug: exercise.slug,
        fps: extracted.fps,
        nativeFrames: extracted.nativeFrames,
        analyzerTuning,
        onProgress: (processed, total) => setOfflineProgress({ stage: 'Building replay overlay', processed, total })
      })
      offlineReplayDataRef.current = { fps: extracted.fps, nativeFrames: extracted.nativeFrames, overlayFrames }
      setOfflineOverlayReady(true)

      setOfflineProgress({ stage: 'Finalizing local report', processed: 1, total: 1 })
      setOfflineReport(report)
      setOfflineLocalStatus('succeeded')
      setOfflineCompletedStep(4)
      try {
        const archiveGuard = validateOfflineArchiveUser(user)
        if (archiveGuard) throw new Error(archiveGuard)
        setOfflineArchiveStatus('saving')
        const reps = getRepsFromReport(report)
        const startedAt = new Date(Date.now() - Math.max(1000, Math.round((extracted.nativeFrames.length / Math.max(1, extracted.fps)) * 1000))).toISOString()
        const payload = buildOfflineArchivePayload({
          startedAt,
          endedAt: new Date().toISOString(),
          exerciseType: exercise.exerciseType,
          exerciseDisplayName: exercise.displayName,
          reps,
          report,
          posePolicyVersion,
          buildTrainingRecordName
        })
        const session = await createPoseTraining(payload)
        setOfflineReportSessionId(session.id)
        setOfflineArchiveStatus('done')
        setOfflineCompletedStep(5)
        setOfflineStatusMsg(resolveOfflineArchiveStatusMessage(true))
      } catch (archiveError: unknown) {
        setOfflineArchiveStatus('failed')
        setOfflineStatusMsg(resolveOfflineArchiveStatusMessage(false, archiveError))
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


