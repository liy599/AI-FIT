'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type JobListItem = {
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
  video: { id: string; originalName: string } | null
}

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

function statusLabel(s: JobListItem['status']) {
  if (s === 'queued') return '排队中'
  if (s === 'running') return '分析中'
  if (s === 'succeeded') return '已完成'
  return '失败'
}

export default function AnalysisHistoryClient() {
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<JobListItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function refresh() {
    const data = await privateJson<{ items: JobListItem[] }>('/api/v1/private/analysis/jobs?days=90&limit=80', { method: 'GET' })
    setItems(data.items)
  }

  async function deleteOne(id: string) {
    if (!window.confirm('确定删除这条分析任务与报告吗？此操作不可恢复。')) return
    setError(null)
    setDeletingId(id)
    try {
      const res = await privateFetch(`/api/v1/private/analysis/jobs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      await readJsonOrThrow<{ ok: true }>(res)
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!session) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        await refresh()
        if (!mounted) return
      } catch (e) {
        if (!mounted) return
        if (e instanceof NotLoggedInError) {
          setError(null)
          setLoading(false)
          return
        }
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [session])

  if (sessionLoading || loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>分析历史</h1>
        <p>加载中…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">分析历史</div>
            <div className="pageSub">查看已创建的分析任务</div>
          </div>
        </div>
        <LoginCtaCard title="登录后查看分析历史" subtitle="未登录时不请求任何私有接口（避免 401 风暴）" />
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>分析历史</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <section style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={async () => {
            setError(null)
            try {
              await refresh()
            } catch (e) {
              setError(e instanceof Error ? e.message : '刷新失败')
            }
          }}
        >
          刷新
        </button>
        <Link href="/analysis">创建新任务</Link>
        <Link href="/dashboard">返回仪表盘</Link>
      </section>

      {items.length === 0 ? <p style={{ marginTop: 14 }}>暂无分析任务。</p> : null}

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div>
                  <Link href={`/analysis/${encodeURIComponent(it.id)}`}>{statusLabel(it.status)}</Link>
                  <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                    {new Date(it.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div style={{ marginTop: 6, color: '#444' }}>
                  动作：{it.exercise?.name ?? '未指定'} · 视角：{it.viewAngle} · 视频：{it.video?.originalName ?? '（无）'}
                </div>
                {it.instruction ? <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>指令：{it.instruction}</div> : null}
                {it.errorMessage ? <div style={{ marginTop: 6, color: '#b91c1c', fontSize: 12 }}>错误：{it.errorMessage}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => void deleteOne(it.id)} disabled={deletingId === it.id} type="button">
                  {deletingId === it.id ? '删除中…' : '删除'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
