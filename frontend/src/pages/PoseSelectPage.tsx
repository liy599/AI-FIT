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
      { id: 'pushup', name: 'Push-up', status: 'coming_soon', href: '/tools/pose/pushup' },
      { id: 'bench_press', name: 'Bench Press', status: 'coming_soon', href: '/tools/pose/bench-press' }
    ]
  },
  {
    id: 'back',
    title: 'Back',
    subtitle: 'Pull movements',
    exercises: [
      { id: 'pullup', name: 'Pull-up', status: 'coming_soon', href: '/tools/pose/pullup' },
      { id: 'row', name: 'Row', status: 'coming_soon', href: '/tools/pose/row' }
    ]
  },
  {
    id: 'shoulder',
    title: 'Shoulders',
    subtitle: 'Pressing & stability',
    exercises: [
      { id: 'ohp', name: 'Overhead Press', status: 'coming_soon', href: '/tools/pose/ohp' },
      { id: 'lateral_raise', name: 'Lateral Raise', status: 'coming_soon', href: '/tools/pose/lateral-raise' }
    ]
  },
  {
    id: 'legs',
    title: 'Legs',
    subtitle: 'Lower body & hip-dominant',
    exercises: [
      { id: 'squat', name: 'Squat', status: 'ready', href: '/tools/pose/squat' },
      { id: 'lunge', name: 'Lunge', status: 'coming_soon', href: '/tools/pose/lunge' },
      { id: 'calf_raise', name: 'Calf Raise', status: 'coming_soon', href: '/tools/pose/calf-raise' }
    ]
  },
  {
    id: 'cardio',
    title: 'Cardio',
    subtitle: 'Cardiovascular & cadence',
    exercises: [
      { id: 'jumping_jack', name: 'Jumping Jack', status: 'coming_soon', href: '/tools/pose/jumping-jack' },
      { id: 'burpee', name: 'Burpee', status: 'coming_soon', href: '/tools/pose/burpee' }
    ]
  },
  {
    id: 'stretch',
    title: 'Stretching',
    subtitle: 'Mobility & recovery',
    exercises: [
      { id: 'hamstring', name: 'Hamstring Stretch', status: 'coming_soon', href: '/tools/pose/stretch-hamstring' },
      { id: 'hip_flexor', name: 'Hip Flexor Stretch', status: 'coming_soon', href: '/tools/pose/stretch-hip-flexor' }
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

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-10 col-lg-11">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-15">Choose what you want to train</h4>
                <p className="pose-tool-subtitle">Pick an exercise first, review the camera guidance, then start real-time form correction.</p>
              </div>

              <div className="row">
                {POSE_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="col-xl-4 col-lg-6">
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
                                <strong style={{ lineHeight: 1.2 }}>{ex.name}</strong>
                                {ex.secondary ? <span style={{ fontSize: 12, color: '#64748b' }}>{ex.secondary}</span> : null}
                              </div>
                              {disabled ? (
                                <span
                                  style={{
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
                                <Link to={ex.href} className="cl_theme-btn" style={{ padding: '8px 12px', fontSize: 12 }}>
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
