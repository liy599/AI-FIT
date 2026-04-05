import AnalysisClient from './AnalysisClient'
import Link from 'next/link'

export default function AnalysisPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = props.searchParams?.exerciseId
  const exerciseId = Array.isArray(raw) ? raw[0] : raw

  if (!exerciseId) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">Video Analysis</div>
            <div className="pageSub">Select an exercise first</div>
          </div>
        </div>

        <div className="emptyCard card">
          <div className="cardInner emptyInner">
            <div className="emptyIcon">🎞️</div>
            <div className="emptyTitle">Pick an exercise in training first</div>
            <div className="emptySub">Video analysis needs an exerciseId to generate the correct rules and report</div>
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

  return <AnalysisClient exerciseId={exerciseId} />
}
