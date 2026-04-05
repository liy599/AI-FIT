import { API_BASE, apiFetch, apiFetchBlob, apiUpload } from './api'

export type PoseVideo = {
  id: number
  original_name: string
  mime_type: string
  size_bytes: number
  duration_seconds: number | null
  url: string
  created_at: string
}

export type PoseAnalysisTask = {
  id: number
  status: 'uploaded' | 'running' | 'succeeded' | 'failed'
  exercise_type: string
  view_angle: 'unknown' | 'front' | 'side' | 'back'
  instruction: string | null
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  video: PoseVideo
  result: {
    id: number
    report: Record<string, unknown>
    created_at: string
  } | null
}

export type PoseTrainingSession = {
  id: number
  started_at: string
  ended_at: string | null
  note: string | null
  report: Record<string, unknown> | null
  sets: Array<{
    id: number
    exercise_type: string
    set_order: number
    reps: number
    weight: number | null
    note: string | null
  }>
}

export async function uploadPoseVideo(file: File) {
  const form = new FormData()
  form.append('file', file)
  const data = await apiUpload<{ video: PoseVideo }>('/api/pose/videos', form)
  return data.video
}

export async function createPoseAnalysisTask(input: {
  video_asset_id: number
  exercise_type: string
  view_angle: 'unknown' | 'front' | 'side' | 'back'
  instruction?: string
}) {
  const data = await apiFetch<{ task: PoseAnalysisTask }>('/api/pose/analysis/tasks', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return data.task
}

export async function completePoseAnalysisTask(taskId: number, report: Record<string, unknown>) {
  const data = await apiFetch<{ task: PoseAnalysisTask }>(`/api/pose/analysis/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ report })
  })
  return data.task
}

export async function failPoseAnalysisTask(taskId: number, error: string) {
  const data = await apiFetch<{ task: PoseAnalysisTask }>(`/api/pose/analysis/tasks/${taskId}/fail`, {
    method: 'POST',
    body: JSON.stringify({ error })
  })
  return data.task
}

export async function createPoseTraining(input: {
  started_at: string
  ended_at: string
  exercise_type: string
  note?: string
  sets: Array<{
    exercise_type?: string
    set_order?: number
    reps: number
    weight?: number | null
    note?: string
  }>
  report?: Record<string, unknown>
}) {
  const data = await apiFetch<{ session: PoseTrainingSession }>('/api/pose/trainings', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return data.session
}

export async function createPoseVideoObjectUrl(video: Pick<PoseVideo, 'id'>) {
  const blob = await apiFetchBlob(`/api/pose/videos/${video.id}/file`)
  return URL.createObjectURL(blob)
}

export function resolvePoseVideoApiUrl(path: string) {
  return `${API_BASE}${path}`
}
