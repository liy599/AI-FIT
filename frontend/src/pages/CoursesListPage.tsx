import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'

type CourseCard = {
  id: number
  title: string
  cover_image_url: string | null
  instructor_name: string
  is_free: boolean
  price: number | null
  enroll_count: number
  avg_rating: number | null
}

export default function CoursesListPage() {
  const [sp, setSp] = useSearchParams()
  const [items, setItems] = useState<CourseCard[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const q = sp.get('q') ?? ''
  const isFree = sp.get('is_free') ?? ''
  const sort = sp.get('sort') ?? 'new'
  const page = Number(sp.get('page') ?? '1') || 1

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', '12')
    p.set('sort', sort)
    if (q.trim()) p.set('q', q.trim())
    if (isFree) p.set('is_free', isFree)
    return p.toString()
  }, [page, q, isFree, sort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<{ items: CourseCard[]; total: number }>(`/api/courses?${queryString}`)
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold">精品课程</div>
            <div className="text-sm text-slate-400">筛选与排序，找到适合你的训练课程。</div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm md:w-72"
              placeholder="搜索课程标题…"
              value={q}
              onChange={(e) => {
                const next = new URLSearchParams(sp)
                next.set('q', e.target.value)
                next.set('page', '1')
                setSp(next)
              }}
            />
            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={isFree}
              onChange={(e) => {
                const next = new URLSearchParams(sp)
                const v = e.target.value
                if (!v) next.delete('is_free')
                else next.set('is_free', v)
                next.set('page', '1')
                setSp(next)
              }}
            >
              <option value="">全部</option>
              <option value="true">免费</option>
              <option value="false">付费</option>
            </select>
            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(sp)
                next.set('sort', e.target.value)
                next.set('page', '1')
                setSp(next)
              }}
            >
              <option value="new">最新</option>
              <option value="hot">最热</option>
              <option value="rating">评分最高</option>
            </select>
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-400">加载中…</div> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link
            key={c.id}
            to={`/courses/${c.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="text-xs text-slate-300">{c.is_free ? '免费' : `€${c.price ?? '-'}`}</div>
            </div>
            <div className="mt-2 text-xs text-slate-400">讲师：{c.instructor_name}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <div>{c.enroll_count} 人报名</div>
              <div>{c.avg_rating ? c.avg_rating.toFixed(1) : '-'}★</div>
            </div>
          </Link>
        ))}
        {!loading && items.length === 0 ? <div className="text-sm text-slate-400">暂无课程</div> : null}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">共 {total} 门</div>
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

