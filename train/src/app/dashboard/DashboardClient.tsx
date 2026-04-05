'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import WheelNav, { type WheelNavSector } from '@/components/WheelNav'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateJson } from '@/lib/client/privateFetch'

type TrainingItem = {
  id: string
  startedAt: string
  endedAt: string | null
  note: string | null
  totalSets: number
  distinctExercises: number
}

type AnalysisItem = {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  exercise: { id: string; name: string } | null
}

export default function DashboardClient() {
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trainings7d, setTrainings7d] = useState<TrainingItem[]>([])
  const [analysis30d, setAnalysis30d] = useState<AnalysisItem[]>([])
  const [activeTrainingId, setActiveTrainingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!session) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        const [t, aRaw, active] = await Promise.all([
          privateJson<{ items: TrainingItem[] }>('/api/v1/private/trainings?days=7', { method: 'GET' }),
          privateJson<{ items: Array<Omit<AnalysisItem, 'exercise'> & { exercise: AnalysisItem['exercise']; video?: unknown }> }>(
            '/api/v1/private/analysis/jobs?days=30&limit=20',
            { method: 'GET' }
          ),
          privateJson<{ session: { id: string } | null }>('/api/v1/private/trainings/active', { method: 'GET' })
        ])
        if (!mounted) return

        setTrainings7d(t.items)
        setAnalysis30d(
          aRaw.items.map((x) => ({
            id: x.id,
            status: x.status,
            createdAt: x.createdAt,
            updatedAt: x.updatedAt,
            finishedAt: x.finishedAt ?? null,
            exercise: x.exercise
          }))
        )
        setActiveTrainingId(active.session?.id ?? null)
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

  const trainingSummary = useMemo(() => {
    const total = trainings7d.length
    const completed = trainings7d.filter((x) => !!x.endedAt).length
    const totalSets = trainings7d.reduce((acc, x) => acc + (Number(x.totalSets) || 0), 0)
    const distinctExercises = trainings7d.reduce((acc, x) => acc + (Number(x.distinctExercises) || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : null
    return { total, completed, totalSets, distinctExercises, completionRate }
  }, [trainings7d])

  const analysisSummary = useMemo(() => {
    const total = analysis30d.length
    const byStatus = { queued: 0, running: 0, succeeded: 0, failed: 0 } as Record<AnalysisItem['status'], number>
    for (const t of analysis30d) byStatus[t.status] += 1
    const successRate = total > 0 ? Math.round((byStatus.succeeded / total) * 100) : null
    return { total, byStatus, successRate }
  }, [analysis30d])

  const todayState = useMemo(() => {
    if (!session) return 'Signed out'
    if (activeTrainingId) return 'Training in progress'
    if (analysisSummary.byStatus.running > 0) return 'Analysis running'
    return 'Ready'
  }, [activeTrainingId, analysisSummary.byStatus.running, session])

  const wheelSectors = useMemo(() => {
    const todayLabel = session ? todayState : 'Signed out'

    return [
      {
        id: 'train',
        metricLabel: 'Today',
        metricValue: todayLabel,
        actionLabel: 'Go to Training',
        href: activeTrainingId ? `/train/session?trainingId=${encodeURIComponent(activeTrainingId)}` : '/train/session'
      },
      {
        id: 'history',
        metricLabel: 'History',
        metricValue: `${trainingSummary.total}`,
        actionLabel: 'Go to History',
        href: '/history'
      },
      {
        id: 'challenge',
        metricLabel: 'Challenges',
        metricValue: '0 active',
        actionLabel: 'Go to Challenge',
        href: '/challenge'
      }
    ] as [WheelNavSector, WheelNavSector, WheelNavSector]
  }, [activeTrainingId, session, todayState, trainingSummary.total])

  if (sessionLoading) {
    return (
      <main className="page">
        <div className="container" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>My Training</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Loading…</p>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="page">
        <div className="container" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>My Training</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Start logging and AI analysis</p>
          </div>
          <LoginCtaCard title="Sign in to view dashboard" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <div className="container" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>My Training</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Start logging and AI analysis</p>
        </div>

        {error ? <div className="alert">{error}</div> : null}

        <div style={{ display: 'grid', gap: 16 }}>
          {/* AI wheel and quick actions */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #f8fbff, #eef5ff)', padding: '24px 16px' }}>
              <WheelNav
                title="AI Assistant"
                subtitle="One-click analysis"
                sectors={wheelSectors}
                defaultActiveId="train"
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: 16, gap: 8, background: '#fff', borderTop: '1px solid var(--border)' }}>
              <Link href="/train" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0f4ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18h12M6 6h12M6 12h12"/></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Plans</span>
              </Link>
              <Link href="/exercises" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Exercises</span>
              </Link>
              <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff5f0', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>History</span>
              </Link>
              <Link href="/challenge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Challenge</span>
              </Link>
            </div>
          </div>

          {/* Status card */}
          <div className="card">
            <div className="cardInner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Today</div>
                <div className="badge">{loading ? 'Loading' : todayState}</div>
              </div>
              
              <Link
                href={activeTrainingId ? `/train/session?trainingId=${encodeURIComponent(activeTrainingId)}` : '/train/session'}
                style={{
                  display: 'flex',
                  width: '100%',
                  padding: '14px',
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: 12,
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 16
                }}
              >
                {activeTrainingId ? 'Resume training' : 'Start new training'}
              </Link>
            </div>
          </div>

          {/* Stats banner */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Workouts this week</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>{trainingSummary.total}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>sessions</span>
              </div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Analyses</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>{analysisSummary.total}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>runs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
