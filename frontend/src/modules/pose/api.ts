import { apiFetch } from '../../lib/api'

export type PoseTrainingSession = {
  id: number
  started_at: string
  ended_at: string | null
  note: string | null
  report: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
  sets: Array<{
    id: number
    exercise_type: string
    set_order: number
    reps: number
    weight: number | null
    note: string | null
  }>
}

export type PosePolicy = {
  version: string
  offline: {
    max_video_bytes: number
    analysis_limit_seconds: number
    analysis_target_fps: number
    allowed_actions: string[]
  }
  rules: {
    privacy: {
      local_inference_only: boolean
    }
    analyzer_common: {
      tracking_quality_min: number
      tempo_fast_threshold_seconds: number
    }
    squat: {
      knee_forward_warn_ratio: number
      knee_forward_fail_ratio: number
      forward_lean_warn_deg: number
      forward_lean_fail_deg: number
    }
    pushup: {
      body_line_warn_ratio: number
      body_line_fail_ratio: number
      depth_warn_ratio: number
      depth_fail_ratio: number
    }
    lateral_raise: {
      torso_sway_warn_ratio: number
      torso_sway_fail_ratio: number
      symmetry_warn_ratio: number
      symmetry_fail_ratio: number
    }
    bent_over_row: {
      back_angle_warn_deg: number
      back_angle_fail_deg: number
      range_warn_ratio: number
      range_fail_ratio: number
    }
    analyzer: {
      squat: {
        knee_forward_warn_ratio: number
        knee_forward_fail_ratio: number
        knee_forward_fail_min_frames: number
        forward_lean_warn_deg: number
        forward_lean_fail_deg: number
        forward_lean_fail_min_frames: number
        tracking_quality_min: number
      }
      pushup: {
        tracking_quality_min_for_count: number
        tracking_quality_min_for_assess: number
        side_view_warn_deg: number
        depth_required_elbow_angle: number
        body_line_fail_angle: number
        hip_sag_hard_deg: number
        hip_pike_hard_deg: number
      }
      lateral_raise: {
        tracking_quality_min: number
        torso_sway_warn_deg: number
        torso_sway_fail_deg: number
        symmetry_warn_deg: number
        symmetry_fail_deg: number
        top_range_min_deg: number
      }
      bent_over_row: {
        tracking_quality_min: number
        torso_lean_warn_deg: number
        torso_lean_fail_deg: number
        symmetry_warn_deg: number
        symmetry_fail_deg: number
        top_range_min_deg: number
      }
    }
  }
}

export function getPosePolicy() {
  return apiFetch<PosePolicy>('/api/pose/policy', { auth: false })
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

export async function listPoseTrainings(params?: {
  page?: number
  page_size?: number
  date_from?: string
  date_to?: string
  exercise_type?: string
}) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  if (params?.date_from) query.set('date_from', params.date_from)
  if (params?.date_to) query.set('date_to', params.date_to)
  if (params?.exercise_type) query.set('exercise_type', params.exercise_type)
  const suffix = query.toString()
  const data = await apiFetch<{ items: PoseTrainingSession[]; page: number; page_size: number; total: number }>(
    `/api/pose/trainings${suffix ? `?${suffix}` : ''}`
  )
  return data
}

export async function getPoseTraining(sessionId: number) {
  const data = await apiFetch<{ session: PoseTrainingSession }>(`/api/pose/trainings/${sessionId}`)
  return data.session
}

export async function deletePoseTraining(sessionId: number) {
  await apiFetch<{ ok: boolean }>(`/api/pose/trainings/${sessionId}`, {
    method: 'DELETE'
  })
}

export async function updatePoseTrainingReport(sessionId: number, report: Record<string, unknown>) {
  const data = await apiFetch<{ session: PoseTrainingSession }>(`/api/pose/trainings/${sessionId}/report`, {
    method: 'PUT',
    body: JSON.stringify({ report })
  })
  return data.session
}

