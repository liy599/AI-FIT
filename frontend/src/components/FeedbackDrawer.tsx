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
  const [tab, setTab] = useState<'Review' | 'Contact'>('Review')
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
        setError(e instanceof Error ? e.message : 'Failed to load')
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
          rating: tab === 'Review' ? rating : undefined,
          contact_email: auth.user ? undefined : email
        })
      })
      setContent('')
      setEmail('')
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  return (
    <>
      <button
        className="fixed left-0 top-1/2 z-50 -translate-y-1/2 rounded-r-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200 backdrop-blur hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
      >
        Feedback
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[360px] border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Feedback Center</div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {(['Review', 'Contact'] as const).map((t) => (
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
              {tab === 'Review' ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-300">Latest reviews</div>
                    <div className="mt-2 space-y-2">
                      {loading ? (
                        <div className="text-xs text-slate-400">Loading…</div>
                      ) : (
                        items.map((it) => (
                          <div key={it.id} className="rounded-xl border border-white/10 bg-black/20 p-2">
                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <div>{it.user ? it.user.username : 'Anonymous'}</div>
                              <div>{it.rating ? '★'.repeat(it.rating) : ''}</div>
                            </div>
                            <div className="mt-1 text-sm text-slate-100">{it.content}</div>
                          </div>
                        ))
                      )}
                      {!loading && items.length === 0 ? (
                        <div className="text-xs text-slate-400">No reviews yet</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-300">Submit a review</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Rating</span>
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
                        placeholder="Not signed in: enter your email (required)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    ) : null}
                    <textarea
                      className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="Share your experience…"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
                    <button
                      className="mt-3 w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                      disabled={!submitEnabled || (!auth.user && !email)}
                      onClick={submit}
                    >
                      Submit
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300">Contact</div>
                  {!auth.user ? (
                    <input
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="Email (optional, recommended when anonymous)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  ) : null}
                  <textarea
                    className="mt-2 h-28 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Tell us what you need help with…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
                  <button
                    className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                    disabled={!submitEnabled}
                    onClick={submit}
                  >
                    Send
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
