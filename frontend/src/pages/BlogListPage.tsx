import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'

type Tag = { id: number; name: string }
type BlogCard = {
  id: number
  title: string
  excerpt: string
  cover_image_url: string | null
  author: { id: number; username: string }
  created_at: string
  tags: Tag[]
}

function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

export default function BlogListPage() {
  const [sp, setSp] = useSearchParams()
  const [tags, setTags] = useState<Tag[]>([])
  const [items, setItems] = useState<BlogCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = sp.get('q') ?? ''
  const tagIds = sp.getAll('tag').map((x) => Number(x)).filter((x) => Number.isFinite(x))
  const page = Number(sp.get('page') ?? '1') || 1

  useEffect(() => {
    apiFetch<Tag[]>('/api/tags', { auth: false })
      .then(setTags)
      .catch(() => {})
  }, [])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', '12')
    if (q.trim()) p.set('q', q.trim())
    for (const t of tagIds) p.append('tag', String(t))
    return p.toString()
  }, [page, q, tagIds])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<{ items: BlogCard[]; total: number }>(`/api/blogs?${queryString}`, { auth: false })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [queryString])

  function toggleTag(id: number) {
    const next = new URLSearchParams(sp)
    const has = tagIds.includes(id)
    next.delete('tag')
    const kept = has ? tagIds.filter((t) => t !== id) : [...tagIds, id]
    kept.forEach((t) => next.append('tag', String(t)))
    next.set('page', '1')
    setSp(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold">博客</div>
          <div className="text-sm text-slate-400">筛选标签、搜索关键词，发现有价值的训练与营养知识。</div>
        </div>
        <div className="flex gap-2">
          <input
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm md:w-72"
            placeholder="搜索标题或内容…"
            value={q}
            onChange={(e) => {
              const next = new URLSearchParams(sp)
              next.set('q', e.target.value)
              next.set('page', '1')
              setSp(next)
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const active = tagIds.includes(t.id)
          return (
            <button
              key={t.id}
              className={[
                'rounded-full border px-3 py-1 text-xs transition',
                active ? 'border-indigo-400/40 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              ].join(' ')}
              onClick={() => toggleTag(t.id)}
            >
              {t.name}
            </button>
          )
        })}
      </div>

      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-400">加载中…</div> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <Link
            key={b.id}
            to={`/blogs/${b.id}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            <div className="h-32 overflow-hidden bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-emerald-500/20">
              {b.cover_image_url ? (
                <img src={resolveMediaUrl(b.cover_image_url) ?? ''} className="h-full w-full object-cover" alt="" />
              ) : null}
            </div>
            <div className="p-5">
              <div className="text-sm font-semibold group-hover:text-white">{b.title}</div>
              <div className="mt-2 text-xs text-slate-400">{b.excerpt}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {b.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-500">by {b.author.username}</div>
            </div>
          </Link>
        ))}
        {!loading && items.length === 0 ? <div className="text-sm text-slate-400">暂无内容</div> : null}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">共 {total} 篇</div>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(sp)
              next.set('page', String(page - 1))
              setSp(next)
            }}
          >
            上一页
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
            disabled={page * 12 >= total}
            onClick={() => {
              const next = new URLSearchParams(sp)
              next.set('page', String(page + 1))
              setSp(next)
            }}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}

