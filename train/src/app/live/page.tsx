import LiveClient from './LiveClient'
import Link from 'next/link'

export const metadata = {
  title: 'Live Pose Coaching - Train'
}

export default function LivePage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = props.searchParams?.exerciseId
  const exerciseId = Array.isArray(raw) ? raw[0] : raw

  if (!exerciseId) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">Live Pose Coaching</div>
            <div className="pageSub">Select an exercise first</div>
          </div>
        </div>

        <div className="emptyCard card">
          <div className="cardInner emptyInner">
            <div className="emptyIcon">🎥</div>
            <div className="emptyTitle">Pick an exercise in training first</div>
            <div className="emptySub">Live coaching needs an exerciseId to match rules and generate reports</div>
            <div className="emptyCtas">
              <Link className="btn btnPrimary" href="/train/session">
                Go to Training
              </Link>
              <Link className="btn btnGhost" href="/dashboard">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="container page">
      <h1>Live Pose Coaching (Beta)</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Please allow camera access. Perform squats in a side view and keep your full body (head to feet) in frame.
      </p>
      <LiveClient exerciseId={exerciseId} />
    </main>
  )
}
