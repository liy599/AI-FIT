'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type ExerciseItem = {
  id: string
  name: string
  isBuiltin: boolean
  isCustom: boolean
  movementType?: string
  categoryPath?: string[]
}
type VideoItem = { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }

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

const VIEW_ANGLES: Array<{ value: 'unknown' | 'front' | 'side' | 'back'; label: string }> = [
  { value: 'unknown', label: '未知/不确定' },
  { value: 'front', label: '正面' },
  { value: 'side', label: '侧面' },
  { value: 'back', label: '背面' }
]

export default function AnalysisClient({ exerciseId: initialExerciseId }: { exerciseId: string }) {
  const router = useRouter()
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])

  const [videoMode, setVideoMode] = useState<'upload' | 'select'>('upload')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  const [exerciseId, setExerciseId] = useState<string>(initialExerciseId)
  const [viewAngle, setViewAngle] = useState<'unknown' | 'front' | 'side' | 'back'>('unknown')
  const [instruction, setInstruction] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const exerciseById = useMemo(() => {
    const map = new Map<string, ExerciseItem>()
    for (const e of exercises) map.set(e.id, e)
    return map
  }, [exercises])

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!session) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        const [exData, vidData] = await Promise.all([
          privateJson<{ items: ExerciseItem[] }>('/api/v1/private/exercises', { method: 'GET' }),
          privateJson<{ items: VideoItem[] }>('/api/v1/private/videos?limit=30', { method: 'GET' })
        ])

        if (!mounted) return
        setExercises(exData.items)
        setVideos(vidData.items)
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

  async function refreshVideos() {
    const data = await privateJson<{ items: VideoItem[] }>('/api/v1/private/videos?limit=30', { method: 'GET' })
    setVideos(data.items)
  }

  async function submit() {
    setError(null)

    if (videoMode === 'upload') {
      if (!videoFile) {
        setError('请选择要上传的视频')
        return
      }
    } else {
      if (!selectedVideoId) {
        setError('请选择一个已上传的视频')
        return
      }
    }
    if (!exerciseId) {
      setError('请先选择一个动作')
      return
    }

    setSubmitting(true)
    try {
      const form = new FormData()
      if (videoMode === 'upload') {
        form.set('file', videoFile as File)
      } else {
        form.set('videoAssetId', selectedVideoId as string)
      }

      form.set('exerciseId', exerciseId)
      form.set('viewAngle', viewAngle)
      if (instruction.trim()) form.set('instruction', instruction.trim())

      const res = await privateFetch('/api/v1/private/analysis/jobs', { method: 'POST', body: form })
      const data = await readJsonOrThrow<{ job: { id: string } }>(res)

      router.push(`/analysis/${encodeURIComponent(data.job.id)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建任务失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionLoading || loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>分析</h1>
        <p>加载中…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">分析</div>
            <div className="pageSub">上传视频并生成报告</div>
          </div>
        </div>
        <LoginCtaCard title="登录后进行视频分析" subtitle="未登录时不请求任何私有接口（避免 401 风暴）" />
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>分析</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <p style={{ color: '#666' }}>
        选择视频 + 动作 + 视角 + 自定义指令后创建分析任务。完成后会生成一份报告。
      </p>

      <section style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <strong>1) 视频</strong>

        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              checked={videoMode === 'upload'}
              onChange={() => setVideoMode('upload')}
              disabled={submitting}
            />
            上传新视频
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              checked={videoMode === 'select'}
              onChange={() => setVideoMode('select')}
              disabled={submitting}
            />
            选择已上传视频
          </label>
        </div>

        {videoMode === 'upload' ? (
          <div style={{ marginTop: 10 }}>
            <input
              type="file"
              accept="video/*"
              disabled={submitting}
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            {videoFile ? (
              <div style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
                已选择：{videoFile.name}（{Math.round(videoFile.size / 1024 / 1024)} MB）
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedVideoId ?? ''}
                onChange={(e) => setSelectedVideoId(e.target.value || null)}
                disabled={submitting}
                style={{ minWidth: 320, padding: 6 }}
              >
                <option value="">请选择…</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}{' '}
                    · {v.originalName}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  setError(null)
                  try {
                    await refreshVideos()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '刷新失败')
                  }
                }}
                disabled={submitting}
              >
                刷新
              </button>
            </div>

            {selectedVideoId ? (
              <div style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
                已选择：{videos.find((v) => v.id === selectedVideoId)?.originalName ?? selectedVideoId}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <strong>2) 动作与视角</strong>
        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontSize: 12, color: '#666' }}>动作</div>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              disabled={submitting}
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">请选择一个动作…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.categoryPath && e.categoryPath.length > 0 ? `${e.categoryPath.join(' - ')} - ` : ''}
                  {e.name}
                  {e.isCustom ? '（自定义）' : ''}
                </option>
              ))}
            </select>
            {exerciseId ? (
              <div style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
                当前动作：{exerciseById.get(exerciseId)?.name ?? exerciseId}
              </div>
            ) : null}
          </div>

          <div style={{ width: 220 }}>
            <div style={{ fontSize: 12, color: '#666' }}>视角</div>
            <select
              value={viewAngle}
              onChange={(e) => setViewAngle(e.target.value as 'unknown' | 'front' | 'side' | 'back')}
              disabled={submitting}
              style={{ width: '100%', padding: 8 }}
            >
              {VIEW_ANGLES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <strong>3) 自定义指令（可选）</strong>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={submitting}
          rows={4}
          placeholder="例如：请重点观察膝盖轨迹与躯干角度，并给出改进建议"
          style={{ width: '100%', marginTop: 10 }}
        />
      </section>

      <section style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={submit} disabled={submitting}>
          {submitting ? '创建中…' : '创建分析任务'}
        </button>
        <Link href="/analysis/history">查看分析历史</Link>
        <Link href="/dashboard">返回仪表盘</Link>
      </section>
    </main>
  )
}
