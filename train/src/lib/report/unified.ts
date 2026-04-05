export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

export type UnifiedIssue = {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  atFrame: number | null
}

export type UnifiedErrorStats = {
  total: number
  bySeverity: { info: number; warning: number; error: number }
  byCode: Array<{ code: string; count: number; maxSeverity: 'info' | 'warning' | 'error' }>
}

export type UnifiedSections = {
  overview: JsonObject
  metrics: JsonObject
  errorStats: UnifiedErrorStats
  suggestions: string[]
  timelineSampled: JsonArray
}

export type UnifiedReport = {
  version: number
  generatedAt: string
  status: 'ok' | 'error'
  task: { id: string; viewAngle: string; instruction: string | null }
  exercise: { id: string; name: string } | null
  video: { id: string; originalName?: string; mimeType?: string; sizeBytes?: number } | null
  summary: string
  keyMetrics: JsonObject
  issues: UnifiedIssue[]
  suggestions: string[]
  details: JsonValue
  sections: UnifiedSections
} & JsonObject

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function normalizeSeverity(v: unknown): 'info' | 'warning' | 'error' {
  if (v === 'error') return 'error'
  if (v === 'warning') return 'warning'
  return 'info'
}

function normalizeIssues(v: unknown): UnifiedIssue[] {
  const arr = asArray(v)
  if (!arr) return []
  const out: UnifiedIssue[] = []
  for (const item of arr) {
    const r = asRecord(item)
    if (!r) continue
    const code = asString(r.code) ?? 'UNKNOWN'
    const severity = normalizeSeverity(r.severity)
    const message = asString(r.message) ?? ''
    const atFrameRaw = r.atFrame
    const atFrame = atFrameRaw === null ? null : asNumber(atFrameRaw)
    out.push({ code, severity, message, atFrame })
  }
  return out
}

function normalizeKeyMetrics(v: unknown): JsonObject {
  const r = asRecord(v)
  if (!r) return {}
  const out: JsonObject = {}
  for (const [k, val] of Object.entries(r)) {
    if (val === null) out[k] = null
    else if (typeof val === 'string') out[k] = val
    else if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
    else if (typeof val === 'boolean') out[k] = val
  }
  return out
}

function normalizeSuggestions(v: unknown): string[] {
  const arr = asArray(v)
  if (!arr) return []
  return arr.map((x) => (typeof x === 'string' ? x : '')).filter((x) => x.length > 0)
}

function sampleArray<T>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max <= 0) return []
  if (max === 1) return [items[items.length - 1]]

  const idx = new Set<number>()
  idx.add(0)
  idx.add(items.length - 1)
  while (idx.size < max) {
    const t = Math.floor(((idx.size - 1) / (max - 1)) * (items.length - 1))
    idx.add(t)
    if (idx.size >= max) break
    const mid = Math.floor(items.length / 2)
    idx.add(mid)
  }
  return Array.from(idx)
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((i) => items[i])
}

function normalizeTimelineSampled(report: Record<string, unknown>): JsonArray {
  const details = asRecord(report.details)
  const fromDetails = details && asArray(details.timelineSampled)
  if (fromDetails) return sampleArray(fromDetails, 5) as JsonArray

  const fromRoot = asArray(report.timelineSampled)
  if (fromRoot) return sampleArray(fromRoot, 5) as JsonArray

  return []
}

function computeErrorStats(issues: UnifiedIssue[]): UnifiedErrorStats {
  const bySeverity = { info: 0, warning: 0, error: 0 }
  const map = new Map<string, { count: number; maxSeverity: 'info' | 'warning' | 'error' }>()

  function severityRank(s: 'info' | 'warning' | 'error') {
    if (s === 'error') return 3
    if (s === 'warning') return 2
    return 1
  }

  for (const i of issues) {
    bySeverity[i.severity] += 1
    const prev = map.get(i.code)
    if (!prev) {
      map.set(i.code, { count: 1, maxSeverity: i.severity })
      continue
    }
    prev.count += 1
    if (severityRank(i.severity) > severityRank(prev.maxSeverity)) prev.maxSeverity = i.severity
  }

  const byCode = Array.from(map.entries())
    .map(([code, v]) => ({ code, count: v.count, maxSeverity: v.maxSeverity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return { total: issues.length, bySeverity, byCode }
}

function sanitizeVideoForArchive(v: unknown): UnifiedReport['video'] {
  const r = asRecord(v)
  if (!r) return null
  const id = asString(r.id)
  if (!id) return null
  const mimeType = asString(r.mimeType) ?? undefined
  const sizeBytes = asNumber(r.sizeBytes) ?? undefined
  return { id, mimeType, sizeBytes }
}

function sanitizeTaskForArchive(v: unknown): UnifiedReport['task'] {
  const r = asRecord(v)
  const id = (r && asString(r.id)) ?? ''
  const viewAngle = (r && asString(r.viewAngle)) ?? 'unknown'
  return { id, viewAngle, instruction: null }
}

export function normalizeReportForArchive(input: unknown, now = new Date()): UnifiedReport {
  const r = asRecord(input)
  const generatedAt = (r && asString(r.generatedAt)) ?? now.toISOString()
  const status = r && r.status === 'error' ? 'error' : 'ok'
  const summary = (r && asString(r.summary)) ?? ''
  const issues = normalizeIssues(r?.issues)
  const keyMetrics = normalizeKeyMetrics(r?.keyMetrics)
  const suggestions = normalizeSuggestions(r?.suggestions)
  const details = (r && ('details' in r ? (r.details as JsonValue) : null)) ?? null
  const task = sanitizeTaskForArchive(r?.task)
  const exercise =
    (() => {
      const ex = asRecord(r?.exercise)
      const id = ex && asString(ex.id)
      const name = ex && asString(ex.name)
      if (!id || !name) return null
      return { id, name }
    })() ?? null
  const video = sanitizeVideoForArchive(r?.video)
  const timelineSampled = normalizeTimelineSampled(r ?? {})
  const errorStats = computeErrorStats(issues)

  const overview: JsonObject = {
    generatedAt,
    status,
    taskId: task.id,
    viewAngle: task.viewAngle,
    exerciseName: exercise?.name ?? null,
    summary
  }

  const sections: UnifiedSections = {
    overview,
    metrics: keyMetrics,
    errorStats,
    suggestions,
    timelineSampled
  }

  return {
    version: 3,
    generatedAt,
    status,
    task,
    exercise,
    video,
    summary,
    keyMetrics,
    issues,
    suggestions,
    details,
    timelineSampled,
    errorStats,
    sections
  }
}

export function renderReportPdfBodyHtml(input: unknown, opts?: { title?: string; nowText?: string }) {
  const report = normalizeReportForArchive(input)
  const nowText = opts?.nowText ?? new Date(report.generatedAt).toLocaleString('zh-CN')
  const title = opts?.title ?? 'Report'

  const escapeHtml = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const metricsKv = Object.entries(report.sections.metrics)
    .map(([k, v]) => {
      const vText = v === null ? '—' : String(v)
      return `<div class="kv"><div class="kvK">${escapeHtml(k)}</div><div class="kvV">${escapeHtml(vText)}</div></div>`
    })
    .join('')

  const bySev = report.sections.errorStats.bySeverity
  const byCodeList = report.sections.errorStats.byCode
    .map((x) => `<li>${escapeHtml(x.code)}：${escapeHtml(String(x.count))}（${escapeHtml(x.maxSeverity)}）</li>`)
    .join('')

  const recList = report.sections.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')
  const timelineList = report.sections.timelineSampled
    .map((x) => `<li><pre>${escapeHtml(JSON.stringify(x, null, 2))}</pre></li>`)
    .join('')

  const rawJson = escapeHtml(JSON.stringify(report, null, 2))

  return `
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">Generated: ${escapeHtml(nowText)} · Version: ${escapeHtml(String(report.version))} · Status: ${escapeHtml(report.status)}</div>

    <div class="card">
      <div class="muted">Overview</div>
      <div style="margin-top:6px; font-weight:700;">${escapeHtml(report.summary || '—')}</div>
    </div>

    <div class="card">
      <div class="muted">Metrics</div>
      <div class="row" style="margin-top:10px;">${metricsKv || '<div class="muted">None</div>'}</div>
    </div>

    <div class="card">
      <div class="muted">Error stats</div>
      <div style="margin-top:6px;">Total: ${escapeHtml(String(report.sections.errorStats.total))}</div>
      <div class="row" style="margin-top:10px;">
        <div class="kv"><div class="kvK">info</div><div class="kvV">${escapeHtml(String(bySev.info))}</div></div>
        <div class="kv"><div class="kvK">warning</div><div class="kvV">${escapeHtml(String(bySev.warning))}</div></div>
        <div class="kv"><div class="kvK">error</div><div class="kvV">${escapeHtml(String(bySev.error))}</div></div>
      </div>
      ${byCodeList ? `<ol style="margin-top:10px;">${byCodeList}</ol>` : '<div class="muted" style="margin-top:10px;">None</div>'}
    </div>

    <div class="card">
      <div class="muted">Recommendations</div>
      ${recList ? `<ol>${recList}</ol>` : '<div style="margin-top:6px;" class="muted">None</div>'}
    </div>

    <div class="card">
      <div class="muted">Timeline samples</div>
      ${timelineList ? `<ol style="margin-top:10px;">${timelineList}</ol>` : '<div style="margin-top:6px;" class="muted">None</div>'}
    </div>

    <div class="card">
      <div class="muted">Archived JSON (redacted)</div>
      <pre>${rawJson}</pre>
    </div>
  `
}
