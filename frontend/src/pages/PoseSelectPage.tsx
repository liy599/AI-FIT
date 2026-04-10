import { Link } from 'react-router-dom'

type PoseExerciseStatus = 'ready' | 'coming_soon'

type PoseExercise = {
  id: string
  name: string
  secondary?: string
  status: PoseExerciseStatus
  href: string
}

type PoseCategory = {
  id: string
  title: string
  subtitle: string
  exercises: PoseExercise[]
}

const POSE_CATEGORIES: PoseCategory[] = [
  {
    id: 'chest',
    title: 'Chest',
    subtitle: 'Push movements',
    exercises: [
      { id: 'pushup', name: 'Push-Up', secondary: 'Bodyweight', status: 'coming_soon', href: '/tools/pose/pushup' },
      { id: 'bench_press', name: 'Bench Press', secondary: 'Barbell', status: 'coming_soon', href: '/tools/pose/bench-press' }
    ]
  },
  {
    id: 'back',
    title: 'Back',
    subtitle: 'Pull movements',
    exercises: [
      { id: 'pullup', name: 'Pull-Up', secondary: 'Bodyweight', status: 'coming_soon', href: '/tools/pose/pullup' },
      { id: 'row', name: 'Bent-Over Row', secondary: 'Barbell', status: 'coming_soon', href: '/tools/pose/row' }
    ]
  },
  {
    id: 'shoulder',
    title: 'Shoulders',
    subtitle: 'Pressing & stability',
    exercises: [
      { id: 'ohp', name: 'Overhead Press', secondary: 'Barbell', status: 'coming_soon', href: '/tools/pose/ohp' },
      { id: 'lateral_raise', name: 'Lateral Raise', secondary: 'Dumbbell', status: 'coming_soon', href: '/tools/pose/lateral-raise' }
    ]
  },
  {
    id: 'legs',
    title: 'Legs',
    subtitle: 'Lower body & hip-dominant',
    exercises: [
      { id: 'squat', name: 'Deep Squat', secondary: 'Bodyweight', status: 'ready', href: '/tools/pose/squat' },
      { id: 'lunge', name: 'Forward Lunge', secondary: 'Bodyweight', status: 'coming_soon', href: '/tools/pose/lunge' }
    ]
  }
]

export default function PoseSelectPage() {
  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Select an Exercise</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Pose</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 pose-select-page">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-10 col-lg-11">
              <div className="cl_blog-widget mb-30 pose-select-hero">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <h4 className="cl_blog-widget-title mb-0">Choose what you want to train</h4>
                  <Link to="/tools/pose/squat/tool/history" className="pose-tool-ghost-btn pose-tool-light-btn">
                    Training History
                  </Link>
                </div>
                <p className="pose-tool-subtitle" style={{ marginTop: 14 }}>
                  Pick an exercise first, review the camera guidance, then start real-time form correction.
                </p>
              </div>

              <div className="row">
                {POSE_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="col-xl-6 col-lg-6 col-md-6">
                    <div className="cl_blog-widget mb-30">
                      <h5 className="cl_blog-widget-title mb-15">
                        {cat.title}
                        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{cat.subtitle}</span>
                      </h5>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {cat.exercises.map((ex) => {
                          const disabled = ex.status !== 'ready'
                          return (
                            <div
                              key={ex.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                border: '1px solid rgba(148,163,184,0.35)',
                                borderRadius: 12,
                                padding: '12px 14px',
                                background: disabled ? 'rgba(15,23,42,0.03)' : '#fff'
                              }}
                            >
                              <div style={{ display: 'grid' }}>
                                <strong style={{ lineHeight: 1.2, color: '#0f172a' }}>{ex.name}</strong>
                                {ex.secondary ? <span style={{ fontSize: 12, color: '#64748b' }}>{ex.secondary}</span> : null}
                              </div>
                              {disabled ? (
                                <span
                                  style={{
                                    minWidth: 98,
                                    height: 34,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    color: '#64748b',
                                    border: '1px solid rgba(148,163,184,0.45)',
                                    padding: '4px 8px',
                                    borderRadius: 9999,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Coming soon
                                </span>
                              ) : (
                                <Link
                                  to={ex.href}
                                  className="cl_theme-btn"
                                  style={{
                                    minWidth: 98,
                                    height: 34,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 12px',
                                    fontSize: 12
                                  }}
                                >
                                  Select
                                </Link>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cl_blog-widget mb-30">
                <div className="pose-inline-note" style={{ marginTop: 0 }}>
                  Only Squat real-time correction is available right now. More exercises are coming soon.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
