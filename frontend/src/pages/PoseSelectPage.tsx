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
      { id: 'pushup', name: 'Push-Up', secondary: 'Bodyweight', status: 'ready', href: '/tools/pose/pushup' },
      { id: 'bench_press', name: 'Bench Press', secondary: 'Dumbbell', status: 'ready', href: '/tools/pose/bench-press' }
    ]
  },
  {
    id: 'back',
    title: 'Back',
    subtitle: 'Pull movements',
    exercises: [
      { id: 'pullup', name: 'Pull-Up', secondary: 'Bodyweight', status: 'ready', href: '/tools/pose/pullup' },
      { id: 'row', name: 'Standing Row', secondary: 'Dumbbell', status: 'coming_soon', href: '/tools/pose/row' }
    ]
  },
  {
    id: 'shoulder',
    title: 'Shoulders',
    subtitle: 'Pressing & stability',
    exercises: [
      { id: 'ohp', name: 'Front Raise', secondary: 'Dumbbell', status: 'coming_soon', href: '/tools/pose/ohp' },
      { id: 'lateral_raise', name: 'Lateral Raise', secondary: 'Dumbbell', status: 'ready', href: '/tools/pose/lateral-raise' }
    ]
  },
  {
    id: 'legs',
    title: 'Glutes & Legs',
    subtitle: 'Lower body & hip-dominant',
    exercises: [
      { id: 'squat', name: 'Deep Squat', secondary: 'Bodyweight', status: 'ready', href: '/tools/pose/squat' },
      { id: 'lunge', name: 'Deadlift', secondary: 'Dumbbell', status: 'coming_soon', href: '/tools/pose/lunge' }
    ]
  }
]

const POSE_EXERCISE_IMAGES: Record<string, string> = {
  pushup: '/assets/images/pose/Push-Up.jpg',
  bench_press: '/assets/images/pose/Bench%20Press.jpg',
  pullup: '/assets/images/pose/Pull-Up.jpg',
  lateral_raise: '/assets/images/pose/Lateral%20Raise.jpg',
  squat: '/assets/images/pose/Deep%20Squat.jpg'
}

export default function PoseSelectPage() {
  const visibleCategories = POSE_CATEGORIES
    .map((cat) => ({
      ...cat,
      exercises: cat.exercises.filter((ex) => ex.status === 'ready')
    }))
    .filter((cat) => cat.exercises.length > 0)

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
                {visibleCategories.map((cat) => (
                  <div key={cat.id} className="col-12">
                    <div className="cl_blog-widget mb-30">
                      <h5 className="cl_blog-widget-title mb-15">
                        {cat.title}
                        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{cat.subtitle}</span>
                      </h5>
                      <div className="pose-select-exercise-grid">
                        {cat.exercises.map((ex) => {
                          const imageSrc = POSE_EXERCISE_IMAGES[ex.id]
                          return (
                            <div key={ex.id} className="pose-select-exercise-card">
                              {imageSrc ? (
                                <div className="pose-select-exercise-media">
                                  <img src={imageSrc} alt={ex.name} loading="lazy" />
                                </div>
                              ) : null}
                              <div className="pose-select-exercise-body">
                                <div className="pose-select-exercise-meta">
                                  <strong>{ex.name}</strong>
                                  {ex.secondary ? <span>{ex.secondary}</span> : null}
                                </div>
                                <Link to={ex.href} className="cl_theme-btn pose-select-exercise-btn">
                                  Select
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
