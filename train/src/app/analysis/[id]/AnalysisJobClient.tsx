'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { extractPose33FromVideoUrl } from '@/lib/pose/mediapipePose'
import { analyzeGenericMotion } from '@/lib/pose/genericMotion'
import { buildGenericMotionReport } from '@/lib/pose/report'
import { chooseMotionStandard } from '@/lib/pose/analysisSelector'
import { buildMotionStandardCompareReport } from '@/lib/pose/motionStandardCompareReport'
import { openPdfPrint } from '@/lib/print'
import { renderReportPdfBodyHtml } from '@/lib/report/unified'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type JobDto = {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  viewAngle: 'unknown' | 'front' | 'side' | 'back'
  instruction: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  exercise: { id: string; name: string } | null
  video: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string } | null
}

type ResultDto = { id: string; report: unknown; createdAt: string }
type ReportIssue = { code?: string; severity?: string; message?: string; atFrame?: number | null }

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  if (!data) throw new Error(`HTTP ${res.status}`)
  return data as T
}

function statusLabel(s: JobDto['status']) {
  if (s === 'queued') return '排队中'
  if (s === 'running') return '分析中'
  if (s === 'succeeded') return '已完成'
  return '失败'
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export default function AnalysisJobClient({ jobId }: { jobId: string }) {
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [result, setResult] = useState<ResultDto | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [pollKey, setPollKey] = useState(0)
  const [clientRunning, setClientRunning] = useState(false)
  const [clientProgress, setClientProgress] = useState<{ stage: string; processed: number; total: number } | null>(null)
  const [clientCompleted, setClientCompleted] = useState(false)

  const shouldPoll = job?.status === 'queued' || job?.status === 'running' || !job

  const title = useMemo(() => {
    if (!job) return '分析任务'
    const ex = job.exercise?.name ?? '未指定动作'
    return `分析任务 · ${ex}`
  }, [job])

  const loadOnce = useCallback(async () => {
    const data = await privateJson<{ job: JobDto; result: ResultDto | null }>(
      `/api/v1/private/analysis/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET' }
    )
    setJob(data.job)
    setResult(data.result)
    return data.job
  }, [jobId])

  useEffect(() => {
    let cancelled = false

    async function loop() {
      setLoading(true)
      try {
        if (!session) return
        while (!cancelled) {
          try {
            setError(null)
            const next = await loadOnce()
            if (!next) break
            if (next.status === 'succeeded' || next.status === 'failed') break
          } catch (e) {
            if (cancelled) break
            if (e instanceof NotLoggedInError) break
            setError(e instanceof Error ? e.message : '轮询失败')
          }
          await sleep(1500)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loop()
    return () => {
      cancelled = true
    }
  }, [loadOnce, pollKey, session])

  const shouldRunClientAnalysis = useMemo(() => {
    if (!job) return false
    if (clientRunning || clientCompleted) return false
    if (result) return false
    if (job.status !== 'running' && job.status !== 'queued') return false
    if (!job.video?.id) return false
    return true
  }, [job, result, clientRunning, clientCompleted])

  useEffect(() => {
    if (!session) return
    if (!shouldRunClientAnalysis || !job) return
    let cancelled = false
    const jobSnapshot = job

    async function run() {
      setError(null)
      setClientRunning(true)
      try {
        const videoUrl = `/api/v1/private/videos/${encodeURIComponent(jobSnapshot.video!.id)}/file`
        const extracted = await extractPose33FromVideoUrl(videoUrl, {
          onProgress: (p) => {
            if (cancelled) return
            setClientProgress({
              stage: p.stage === 'loading' ? '加载模型' : '逐帧提取关键点',
              processed: p.processed,
              total: p.total
            })
          }
        })

        if (cancelled) return
        const standard = chooseMotionStandard({ viewAngle: jobSnapshot.viewAngle, exerciseName: jobSnapshot.exercise?.name })
        setClientProgress({ stage: standard ? '标准模板对比' : '通用动作质量分析', processed: 1, total: 1 })
        const report = standard
          ? buildMotionStandardCompareReport({
              taskId: jobSnapshot.id,
              viewAngle: jobSnapshot.viewAngle,
              instruction: jobSnapshot.instruction,
              exercise: jobSnapshot.exercise,
              video: jobSnapshot.video,
              fps: extracted.fps,
              frames: extracted.frames,
              standard
            })
          : buildGenericMotionReport({
              taskId: jobSnapshot.id,
              viewAngle: jobSnapshot.viewAngle,
              instruction: jobSnapshot.instruction,
              exercise: jobSnapshot.exercise,
              video: jobSnapshot.video,
              fps: extracted.fps,
              analysis: analyzeGenericMotion(extracted.frames)
            })

        if (cancelled) return
        setClientProgress({ stage: '写入报告并推进任务完成', processed: 1, total: 1 })
        const res = await privateFetch(`/api/v1/private/analysis/jobs/${encodeURIComponent(jobSnapshot.id)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report })
        })
        await readJsonOrThrow<{ ok: true }>(res)

        if (cancelled) return
        setClientCompleted(true)
        setPollKey((x) => x + 1)
      } catch (e) {
        if (cancelled) return
        if (e instanceof NotLoggedInError) {
          setError('登录状态已失效，请重新登录')
          return
        }
        setError(e instanceof Error ? e.message : '前端分析失败')
      } finally {
        if (!cancelled) {
          setClientRunning(false)
          setClientProgress(null)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [job, shouldRunClientAnalysis, session])

  async function retry() {
    if (!job || job.status !== 'failed') return
    setError(null)
    setRetrying(true)
    try {
      const res = await privateFetch(`/api/v1/private/analysis/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      await readJsonOrThrow<{ ok: true }>(res)
      setPollKey((x) => x + 1)
    } catch (e) {
      if (e instanceof NotLoggedInError) {
        setError('登录状态已失效，请重新登录')
        return
      }
      setError(e instanceof Error ? e.message : '重试失败')
    } finally {
      setRetrying(false)
    }
  }

  if (sessionLoading) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">分析任务</div>
            <div className="pageSub">加载中…</div>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">分析任务</div>
            <div className="pageSub">查看任务详情与报告</div>
          </div>
        </div>
        <LoginCtaCard title="登录后查看分析任务" subtitle="未登录时不请求任何私有接口（避免 401 风暴）" />
      </main>
    )
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>分析</h1>
        <p>加载中…</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main style={{ padding: 24 }}>
        <h1>分析</h1>
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        <p>未找到任务。</p>
        <Link href="/analysis">返回创建页</Link>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>{title}</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div>
              状态：<strong>{statusLabel(job.status)}</strong>
              {shouldPoll ? <span style={{ marginLeft: 8, color: '#666' }}>（自动刷新）</span> : null}
            </div>
            <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>
              创建：{new Date(job.createdAt).toLocaleString('zh-CN')}
              {job.startedAt ? ` · 开始：${new Date(job.startedAt).toLocaleString('zh-CN')}` : ''}
              {job.finishedAt ? ` · 结束：${new Date(job.finishedAt).toLocaleString('zh-CN')}` : ''}
            </div>
          </div>

          {job.status === 'failed' ? (
            <button onClick={retry} disabled={retrying}>
              {retrying ? '重试中…' : '重试'}
            </button>
          ) : null}
        </div>

        {job.errorMessage ? <p style={{ marginTop: 10, color: '#b91c1c' }}>错误：{job.errorMessage}</p> : null}
      </section>

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <strong>输入</strong>
        <div style={{ marginTop: 8, color: '#444' }}>
          <div>动作：{job.exercise?.name ?? '未指定'}</div>
          <div>视角：{job.viewAngle}</div>
          <div>指令：{job.instruction ?? '（无）'}</div>
          <div>视频：{job.video ? `${job.video.originalName}（${Math.round(job.video.sizeBytes / 1024 / 1024)} MB）` : '（无）'}</div>
        </div>
      </section>

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <strong>结果</strong>
        {job.status === 'succeeded' && result ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: 12 }}>可使用系统打印对话框“另存为 PDF”。</div>
              <button
                className="btn btnOutline"
                type="button"
                onClick={() => {
                  const now = new Date().toLocaleString('zh-CN')
                  const titleText = `动作分析报告 - ${job.exercise?.name ?? '未指定动作'}`
                  const body = renderReportPdfBodyHtml(result.report, { title: titleText, nowText: now })
                  openPdfPrint(titleText, body)
                }}
              >
                导出 PDF
              </button>
            </div>
            <ReportVisualization report={result.report} />
          </div>
        ) : job.status === 'failed' ? (
          <p style={{ marginTop: 10, color: '#666' }}>分析失败。可以点击“重试”。</p>
        ) : (
          <div style={{ marginTop: 10, color: '#666' }}>
            <div>分析进行中，稍后会自动显示报告。</div>
            {clientRunning && clientProgress ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#444' }}>
                前端分析：{clientProgress.stage}
                {clientProgress.total > 1 ? `（${clientProgress.processed}/${clientProgress.total}）` : ''}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <Link href="/analysis">创建新任务</Link> · <Link href="/analysis/history">查看分析历史</Link> · <Link href="/dashboard">返回仪表盘</Link>
      </section>
    </main>
  )
}

function ReportVisualization({ report }: { report: unknown }) {
  const obj = asRecord(report)
  if (!obj) {
    return (
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 10, background: '#fafafa', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(report, null, 2)}
      </pre>
    )
  }

  const summary = typeof obj.summary === 'string' ? obj.summary : '无摘要'
  const keyMetrics = asRecord(obj.keyMetrics) ?? {}
  const issues = Array.isArray(obj.issues) ? (obj.issues as ReportIssue[]) : []
  const suggestions = Array.isArray(obj.suggestions) ? (obj.suggestions as string[]) : []
  const details = asRecord(obj.details)
  const timeline = details && Array.isArray(details.timelineSampled) ? details.timelineSampled : []

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>分析摘要</div>
        <div>{summary}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        {Object.entries(keyMetrics).map(([k, v]) => (
          <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{prettyMetricName(k)}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMetricValue(v)}</div>
          </div>
        ))}
      </div>

      <MetricBars keyMetrics={keyMetrics} />
      <TimelineCharts timeline={timeline} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>问题列表</div>
          {issues.length === 0 ? <div style={{ marginTop: 8, color: '#16a34a' }}>未检测到明显问题</div> : null}
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {issues.map((x, i) => (
              <div key={i} style={{ border: '1px solid #fee2e2', background: '#fef2f2', borderRadius: 6, padding: 8 }}>
                <div style={{ fontWeight: 600 }}>{x.message ?? x.code ?? '问题'}</div>
                <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                  级别：{x.severity ?? '-'} {typeof x.atFrame === 'number' ? `· 帧 ${x.atFrame}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>改进建议</div>
          {suggestions.length === 0 ? <div style={{ marginTop: 8, color: '#6b7280' }}>暂无建议</div> : null}
          <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      <details>
        <summary style={{ cursor: 'pointer' }}>查看原始 JSON</summary>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 10, background: '#fafafa', padding: 12, borderRadius: 8 }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function MetricBars({ keyMetrics }: { keyMetrics: Record<string, unknown> }) {
  const scoreKeys = ['coverage', 'stabilityScore', 'mobilityScore', 'rhythmScore', 'symmetryScore']
  const bars = scoreKeys
    .map((k) => [k, Number(keyMetrics[k])] as const)
    .filter(([, v]) => Number.isFinite(v))
    .map(([k, v]) => ({ key: k, value: Math.max(0, Math.min(1, v)) }))
  if (bars.length === 0) return null
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>动作质量评分</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {bars.map((b) => (
          <div key={b.key} style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{prettyMetricName(b.key)}</div>
            <div style={{ height: 10, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(b.value * 100)}%`, height: '100%', background: '#2563eb' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineCharts({ timeline }: { timeline: unknown[] }) {
  const numericRows = timeline.filter((x) => typeof x === 'object' && x !== null) as Array<Record<string, unknown>>
  if (numericRows.length === 0) return null

  const candidates = ['kneeAngleDeg', 'hipAngleDeg', 'torsoFromVerticalDeg', 'kneeFlexDeg', 'centerY']
  const series: Array<{ key: string; values: number[] }> = []
  for (const key of candidates) {
    const values = numericRows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (values.length >= 3) series.push({ key, values })
  }
  if (series.length === 0) return null

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>关键时间线</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {series.slice(0, 3).map((s) => (
          <div key={s.key}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{prettyMetricName(s.key)}</div>
            <MiniLine values={s.values} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniLine({ values }: { values: number[] }) {
  const w = 600
  const h = 110
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1e-6, max - min)
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 110, background: '#f8fafc', borderRadius: 6 }}>
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" />
    </svg>
  )
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function prettyMetricName(key: string) {
  const map: Record<string, string> = {
    reps: '次数',
    repEstimate: '估计次数',
    fps: 'FPS',
    standardId: '模板 ID',
    standardName: '标准模板',
    extractedFrames: '提取帧数',
    comparableFrames: '可对比帧',
    avgScore: '平均评分',
    minScore: '最低评分',
    maxScore: '最高评分',
    badFramePct: '异常帧占比',
    coverage: '可见率',
    stabilityScore: '稳定性',
    mobilityScore: '活动范围',
    rhythmScore: '节奏一致性',
    symmetryScore: '对称性',
    depthInsufficient: '深度不足',
    heelLift: '提踵次数',
    torsoLean: '躯干前倾问题',
    kneeForward: '膝盖前移问题',
    kneeAngleDeg: '膝关节角度',
    hipAngleDeg: '髋关节角度',
    torsoFromVerticalDeg: '躯干角度',
    kneeFlexDeg: '膝屈角',
    centerY: '重心高度'
  }
  return map[key] ?? key
}

function formatMetricValue(v: unknown) {
  if (typeof v !== 'number') return String(v ?? '-')
  if (v >= 0 && v <= 1) return `${Math.round(v * 100)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
