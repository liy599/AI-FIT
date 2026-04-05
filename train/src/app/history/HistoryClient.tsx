'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type HistoryItem = {
  id: string
  startedAt: string
  endedAt: string | null
  note: string | null
  hasReport: boolean
  totalSets: number
  distinctExercises: number
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

function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

export default function HistoryClient() {
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'history' | 'stats'>('history')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => dateKey(new Date()))

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!session) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        const data = await privateJson<{ items: HistoryItem[] }>('/api/v1/private/trainings?days=90', { method: 'GET' })
        if (!mounted) return
        setItems(data.items)
      } catch (e) {
        if (!mounted) return
        if (e instanceof NotLoggedInError) {
          setError(null)
          setLoading(false)
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load')
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

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>()
    for (const item of items) {
      const key = dateKey(new Date(item.startedAt))
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }, [items])

  const monthLabel = useMemo(() => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`, [month])

  const calendarCells = useMemo(() => {
    const first = startOfMonth(month)
    const firstWeekday = (first.getDay() + 6) % 7
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

    const cells: Array<{ date: Date; inMonth: boolean; key: string }> = []
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(first)
      d.setDate(d.getDate() - (firstWeekday - i))
      cells.push({ date: d, inMonth: false, key: dateKey(d) })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(month.getFullYear(), month.getMonth(), day)
      cells.push({ date: d, inMonth: true, key: dateKey(d) })
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]?.date ?? new Date(first)
      const d = new Date(last)
      d.setDate(d.getDate() + 1)
      cells.push({ date: d, inMonth: false, key: dateKey(d) })
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date
      const d = new Date(last)
      d.setDate(d.getDate() + 1)
      cells.push({ date: d, inMonth: false, key: dateKey(d) })
    }
    return cells
  }, [month])

  const selectedItems = useMemo(() => grouped.get(selected) ?? [], [grouped, selected])

  async function deleteOne(id: string) {
    if (!window.confirm('Delete this training record? This action cannot be undone.')) return
    setError(null)
    setDeletingId(id)
    try {
      const res = await privateFetch(`/api/v1/private/trainings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      await readJsonOrThrow<{ ok: true }>(res)
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  if (sessionLoading || loading) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">History</div>
            <div className="pageSub">Loading…</div>
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
            <div className="pageTitle">History</div>
            <div className="pageSub">Calendar view</div>
          </div>
        </div>
        <LoginCtaCard title="Sign in to view training history" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
      </main>
    )
  }

  return (
    <main className="container page">
      <div className="pageTop">
        <div>
          <div className="pageTitle">History</div>
          <div className="pageSub">Calendar view</div>
        </div>
        <div className="pageTopRight">
          <Link className="btn btnGhost" href="/placeholder/history-report">
            Monthly/Yearly
          </Link>
          <Link className="btn btnOutline" href="/placeholder/calendar-settings">
            Calendar settings
          </Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div className="seg segLg">
        <button className={`segBtn${tab === 'history' ? ' segBtnActive' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
        <button className={`segBtn${tab === 'stats' ? ' segBtnActive' : ''}`} onClick={() => setTab('stats')}>
          Stats
        </button>
      </div>

      {tab === 'stats' ? (
        <div className="emptyCard card">
          <div className="cardInner emptyInner">
            <div className="emptyIcon">📊</div>
            <div className="emptyTitle">Stats placeholder</div>
            <div className="emptySub">Stats will be added here later</div>
          </div>
        </div>
      ) : (
        <>
          <section className="card calendarCard">
            <div className="cardInner">
              <div className="calendarTop">
                <button className="btn btnOutline calendarNav" onClick={() => setMonth((m) => addMonths(m, -1))}>
                  Prev
                </button>
                <div className="calendarTitle">{monthLabel}</div>
                <button className="btn btnOutline calendarNav" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  Next
                </button>
              </div>

              <div className="calendarWeekdays">
                <div>M</div>
                <div>T</div>
                <div>W</div>
                <div>T</div>
                <div>F</div>
                <div>S</div>
                <div>S</div>
              </div>

              <div className="calendarGrid" role="grid" aria-label="Calendar">
                {calendarCells.map((c) => {
                  const has = (grouped.get(c.key) ?? []).length > 0
                  const isToday = c.key === dateKey(new Date())
                  const isSelected = c.key === selected
                  return (
                    <button
                      key={c.key}
                      className={`calCell${c.inMonth ? '' : ' calCellOut'}${isSelected ? ' calCellSelected' : ''}${
                        isToday ? ' calCellToday' : ''
                      }`}
                      onClick={() => setSelected(c.key)}
                      role="gridcell"
                      aria-label={c.key}
                    >
                      <div className="calDay">{c.date.getDate()}</div>
                      <div className={`calDot${has ? ' calDotOn' : ''}`} />
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {items.length === 0 ? (
            <div className="emptyCard card">
              <div className="cardInner emptyInner">
                <div className="emptyIcon">🎯</div>
                <div className="emptyTitle">No training records</div>
                <div className="emptySub">Your training history and stats will appear here</div>
                <div className="emptyCtas">
                  <Link href="/train/session" className="btn btnPrimary">
                    Start training
                  </Link>
                  <Link href="/train" className="btn btnGhost">
                    Back to training
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <section className="card dayListCard">
              <div className="cardInner">
                <div className="dayListTop">
                  <div className="dayListTitle">{selected}</div>
                  <div className="muted">{selectedItems.length} total</div>
                </div>

                {selectedItems.length === 0 ? (
                  <div className="muted">No records for this day</div>
                ) : (
                  <div className="dayList">
                    {selectedItems.map((it) => {
                      const start = new Date(it.startedAt)
                      const end = it.endedAt ? new Date(it.endedAt) : null
                      const timeText = `${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}${
                        end ? ` - ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''
                      }`

                      return (
                        <div key={it.id} className="dayItem">
                          <Link className="dayItemLink" href={`/train/session?trainingId=${encodeURIComponent(it.id)}`}>
                            <div className="dayItemTop">
                              <div className="dayItemTime">{timeText}</div>
                              {!it.endedAt ? <span className="tag tagWarn">Active</span> : null}
                              {it.endedAt && it.hasReport ? <span className="tag tagPrimary">Report</span> : null}
                              {it.endedAt && !it.hasReport ? <span className="tag">No report</span> : null}
                            </div>
                            <div className="dayItemMeta">
                              {it.distinctExercises} exercises · {it.totalSets} sets
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                              {it.hasReport ? 'Click to view report details' : 'Click to view session details'}
                            </div>
                            {it.note ? <div className="dayItemNote">{it.note}</div> : null}
                          </Link>
                          <button className="iconDangerBtn" onClick={() => void deleteOne(it.id)} disabled={deletingId === it.id} aria-label="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
