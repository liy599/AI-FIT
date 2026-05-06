export type PoseAnalysisReport = {
  version: number
  generatedAt: string
  status: 'ok' | 'error'
  task: {
    id: string
    viewAngle: string
    instruction: string | null
  }
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null
  summary: string
  keyMetrics: Record<string, number | string | null>
  issues: Array<{
    code: string
    severity: 'info' | 'warning' | 'error'
    message: string
    atFrame: number | null
    count?: number | null
    firstSeenMs?: number | null
    lastSeenMs?: number | null
    seenMomentsMs?: number[]
  }>
  suggestions: string[]
  details: unknown
  sections: {
    overview: Record<string, unknown>
    metrics: Record<string, unknown>
    errorStats: {
      total: number
      bySeverity: { info: number; warning: number; error: number }
      byCode: Array<{ code: string; count: number; maxSeverity: 'info' | 'warning' | 'error' }>
    }
    suggestions: string[]
    timelineSampled: unknown[]
  }
}

