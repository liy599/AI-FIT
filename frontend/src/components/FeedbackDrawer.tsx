import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type FeedbackItem = {
  id: number
  user: { id: number; username: string } | null
  content: string
  rating: number | null
  created_at: string
}

export default function FeedbackDrawer() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'评价' | '联系我们'>('评价')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')

  const submitEnabled = useMemo(() => content.trim().length >= 2, [content])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<{ items: FeedbackItem[] }>('/api/feedback?page=1&page_size=6')
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
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
  }, [open])

  async function submit() {
    setError(null)
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: tab,
          content,
          rating: tab === '评价' ? rating : undefined,
          contact_email: auth.user ? undefined : email
        })
      })
      setContent('')
      setEmail('')
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失败')
    }
  }

  return (
    <>
      <button
        className="fixed left-0 top-1/2 z-50 -translate-y-1/2 rounded-r-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200 backdrop-blur hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
      >
        反馈
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[360px] border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">反馈中心</div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {(['评价', '联系我们'] as const).map((t) => (
                <button
                  key={t}
                  className={[
                    'flex-1 rounded-xl border px-3 py-2 text-sm transition',
                    tab === t
                      ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  ].join(' ')}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {tab === '评价' ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-300">最新评价</div>
                    <div className="mt-2 space-y-2">
                      {loading ? (
                        <div className="text-xs text-slate-400">加载中…</div>
                      ) : (
                        items.map((it) => (
                          <div key={it.id} className="rounded-xl border border-white/10 bg-black/20 p-2">
                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <div>{it.user ? it.user.username : '匿名用户'}</div>
                              <div>{it.rating ? '★'.repeat(it.rating) : ''}</div>
                            </div>
                            <div className="mt-1 text-sm text-slate-100">{it.content}</div>
                          </div>
                        ))
                      )}
                      {!loading && items.length === 0 ? (
                        <div className="text-xs text-slate-400">暂无评价</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-300">提交评价</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">评分</span>
                      <select
                        className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!auth.user ? (
                      <input
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                        placeholder="未登录：请输入邮箱（必填）"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    ) : null}
                    <textarea
                      className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="写下你的体验…"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
                    <button
                      className="mt-3 w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                      disabled={!submitEnabled || (!auth.user && !email)}
                      onClick={submit}
                    >
                      提交
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300">联系我们</div>
                  {!auth.user ? (
                    <input
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="邮箱（可选，但匿名时建议填写）"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  ) : null}
                  <textarea
                    className="mt-2 h-28 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="告诉我们你想咨询的问题…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
                  <button
                    className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                    disabled={!submitEnabled}
                    onClick={submit}
                  >
                    发送
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

