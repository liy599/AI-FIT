import { apiFetch, apiFetchBlob, apiUpload, resolveBackendUrl } from './api'

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

export type AiEnhancedReportIssueV1 = {
  severity: 'info' | 'warning' | 'error'
  title: string
  evidence: string | null
}

export type AiEnhancedReportSourceV1 = {
  provider: string
  model: string | null
}

export type AiEnhancedReportV1 = {
  version: 1
  language: string
  score: number | null
  title: string
  summary: string
  issues: AiEnhancedReportIssueV1[]
  suggestions: string[]
  disclaimer: string | null
  source: AiEnhancedReportSourceV1
}

export type PoseAiEnhancedReportMeta = {
  degraded: boolean
  ai: {
    used: boolean
    ok: boolean
    provider: string
    model: string
    error: string | null
    rawText?: string
  }
  rawText?: string
}

export type PoseAiEnhancedReportResponse = {
  report: AiEnhancedReportV1
  meta: PoseAiEnhancedReportMeta
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : null
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : null
}

function toIssueArrayFromLegacy(value: unknown): AiEnhancedReportIssueV1[] | null {
  const items = asArray(value)
  if (!items) return null
  const out: AiEnhancedReportIssueV1[] = []
  for (const item of items) {
    if (!isRecord(item)) continue
    const severityRaw = asString(item.severity) ?? 'info'
    const severity: 'info' | 'warning' | 'error' =
      severityRaw === 'error' || severityRaw === 'warning' || severityRaw === 'info' ? severityRaw : 'info'
    const title = asString(item.title) ?? asString(item.detail) ?? asString((item as Record<string, unknown>).message)
    if (!title) continue
    const evidence = item.evidence === null ? null : asString(item.evidence)
    out.push({ severity, title, evidence: evidence ?? null })
  }
  return out
}

function toSuggestionsFromLegacy(report: Record<string, unknown>): string[] {
  const direct = asArray(report.suggestions)
  if (direct && direct.every((x) => typeof x === 'string' && x.trim())) {
    return direct as string[]
  }
  const actionPlan = asArray(report.actionPlan)
  if (!actionPlan) return []
  const out: string[] = []
  for (const item of actionPlan) {
    if (!isRecord(item)) continue
    const steps = asArray(item.steps)
    if (!steps) continue
    for (const step of steps) {
      if (typeof step === 'string' && step.trim()) out.push(step)
    }
  }
  return out
}

function extractScore(report: Record<string, unknown>): number | null {
  const score = report.score === null ? null : asNumber(report.score)
  if (score !== undefined) return score
  const highlights = asArray(report.highlights)
  if (!highlights) return null
  for (const item of highlights) {
    if (typeof item !== 'string') continue
    const match = item.match(/(accuracy|score)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[2])
  }
  return null
}

export function parsePoseAiEnhancedReportResponse(value: unknown): PoseAiEnhancedReportResponse | null {
  if (!isRecord(value)) return null
  const report = value.report
  const meta = value.meta
  if (!isRecord(report) || !isRecord(meta)) return null

  const version = asNumber(report.version)
  if (version !== 1) return null
  const language = asString(report.language)
  const score = extractScore(report)
  const title = asString(report.title)
  const summary = asString(report.summary)
  const issues = toIssueArrayFromLegacy(report.issues)
  const suggestions = toSuggestionsFromLegacy(report)
  const disclaimer = report.disclaimer === null ? null : asString(report.disclaimer)
  const source = report.source
  if (!language || !title || !summary || !issues || !suggestions) return null
  if (disclaimer === undefined) return null
  if (!isRecord(source)) return null

  const provider = asString(source.provider)
  const model = source.model === null ? null : asString(source.model)
  if (!provider) return null
  if (model === undefined) return null

  const degraded = asBoolean(meta.degraded)
  const ai = meta.ai
  if (degraded === null || !isRecord(ai)) return null
  const used = asBoolean(ai.used)
  const ok = asBoolean(ai.ok)
  const aiProvider = asString(ai.provider)
  const aiModel = asString(ai.model)
  const aiError = ai.error === null ? null : asString(ai.error)
  const aiRawText = ai.rawText === undefined ? undefined : asString(ai.rawText)
  const rawText = meta.rawText === undefined ? undefined : asString(meta.rawText)
  if (used === null || ok === null || !aiProvider || !aiModel) return null
  if (aiError === undefined) return null
  if (aiRawText === null || rawText === null) return null

  return {
    report: {
      version: 1,
      language,
      score: typeof score === 'number' && Number.isFinite(score) ? score : null,
      title,
      summary,
      issues,
      suggestions,
      disclaimer,
      source: { provider, model }
    },
    meta: {
      degraded,
      ai: {
        used,
        ok,
        provider: aiProvider,
        model: aiModel,
        error: aiError,
        ...(aiRawText ? { rawText: aiRawText } : {})
      },
      ...(rawText ? { rawText } : {})
    }
  }
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

export async function listPoseTrainings(params?: { page?: number; page_size?: number; date_from?: string; date_to?: string }) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  if (params?.date_from) query.set('date_from', params.date_from)
  if (params?.date_to) query.set('date_to', params.date_to)
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

export async function updatePoseTrainingReport(sessionId: number, report: Record<string, unknown>) {
  const data = await apiFetch<{ session: PoseTrainingSession }>(`/api/pose/trainings/${sessionId}/report`, {
    method: 'PUT',
    body: JSON.stringify({ report })
  })
  return data.session
}

export async function createPoseAiEnhancedReport(input: { report: Record<string, unknown>; language?: string; locale?: string; debug?: boolean }) {
  const data = await apiFetch<PoseAiEnhancedReportResponse>('/api/pose/reports/ai', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return data
}

export async function createPoseAiEnhancedReportRaw(input: { report: Record<string, unknown>; language?: string; locale?: string; debug?: boolean }) {
  const data = await apiFetch<unknown>('/api/pose/reports/ai', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return data
}

export async function createPoseVideoObjectUrl(video: Pick<PoseVideo, 'id'>) {
  const blob = await apiFetchBlob(`/api/pose/videos/${video.id}/file`)
  return URL.createObjectURL(blob)
}

export function resolvePoseVideoApiUrl(path: string) {
  return resolveBackendUrl(path)
}
