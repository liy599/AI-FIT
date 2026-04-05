import Link from 'next/link'

export default function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="container heroWrap">
          <div>
            <div className="badge">Privacy-first · Training logs + AI coaching</div>
            <h1 className="heroTitle">Log your training and perfect your form with AI</h1>
            <p className="heroSubtitle">
              Upload a 15-second video or use live camera coaching. The system uses keypoints and joint angles to produce actionable tips, with privacy controls, export, and delete.
            </p>
            <div className="heroCtas">
              <Link className="btn btnPrimary" href="/register">
                Get started free
              </Link>
              <Link className="btn btnOutline" href="/live">
                Try live coaching
              </Link>
              <Link className="btn btnGhost" href="/analysis">
                Analyze a video
              </Link>
            </div>
          </div>
          <div className="card">
            <div className="cardInner">
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Supported today</div>
                <ul className="list">
                  <li>Squat (side view): phase detection + error detection + coaching tips</li>
                  <li>Live camera: skeleton overlay + error highlighting</li>
                  <li>Training logs: exercises, sets, reps, weight, notes</li>
                  <li>Privacy: no original videos by default; TTL, export, delete</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <h2 className="sectionTitle">Powerful form analysis</h2>
          <div className="grid3">
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Keypoint tracking</div>
                <div className="muted">Compute joint angles and motion phases from 33 keypoints for explainable feedback.</div>
              </div>
            </div>
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Live correction overlay</div>
                <div className="muted">Overlay a skeleton and highlight issues so you instantly know what to fix.</div>
              </div>
            </div>
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Custom instructions</div>
                <div className="muted">Add goals and constraints (e.g. “knee injury, avoid going too deep”) for more relevant coaching.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <h2 className="sectionTitle">How it works</h2>
          <div className="grid3">
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>1. Capture your movement</div>
                <div className="muted">Use live camera coaching or upload a short video (10–20s recommended).</div>
              </div>
            </div>
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>2. Choose exercise & view</div>
                <div className="muted">Pick an exercise and view angle (e.g. “Squat - Side”) for more stable rules.</div>
              </div>
            </div>
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>3. Get coaching tips</div>
                <div className="muted">Review issues, key metrics, and tips, then log your training session.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <h2 className="sectionTitle">Privacy & security</h2>
          <div className="grid2">
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>No original videos by default</div>
                <div className="muted">We only store essential structured data and reports. You can choose whether to store originals and set TTL in Privacy.</div>
              </div>
            </div>
            <div className="card">
              <div className="cardInner">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Export & delete</div>
                <div className="muted">Export training logs and reports as JSON/CSV. Delete individual items or everything.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <div className="card">
            <div className="cardInner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Start improving your form today</div>
                <div className="muted">Begin with training logs or jump straight into live coaching.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn btnPrimary" href="/register">
                  Sign up
                </Link>
                <Link className="btn btnOutline" href="/live">
                  Live coaching
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
