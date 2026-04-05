'use client'

import Link from 'next/link'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'

export default function ExercisesClient() {
  const { loading, session } = useSession()

  if (loading) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">Exercises</div>
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
            <div className="pageTitle">Exercises</div>
            <div className="pageSub">Only Squat is available for now</div>
          </div>
        </div>
        <LoginCtaCard title="Sign in to start training" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
      </main>
    )
  }

  return (
    <main className="container page">
      <div className="pageTop">
        <div>
          <div className="pageTitle">Exercises</div>
          <div className="pageSub">Only Squat is available for now</div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Squat</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Use a side view for more stable coaching and counting</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btnPrimary" href="/train/session">
                Go to Training
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
