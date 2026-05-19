import { Link } from 'react-router-dom'
import { buildPoseHistoryPath } from '../../modules/pose'

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
      { id: 'pushup', name: 'Push-Up', secondary: 'Bodyweight', status: 'ready', href: '/tools/pose/pushup' }
    ]
  },
  {
    id: 'back',
    title: 'Back',
    subtitle: 'Pull movements',
    exercises: [
      { id: 'bent-over-row', name: 'Bent-Over Row', secondary: 'Dumbbell', status: 'ready', href: '/tools/pose/bent-over-row' },
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
  pushup: '/assets/images/pose/push-up.jpg',
  'bent-over-row': '/assets/images/pose/bent-over-row.jpg',
  lateral_raise: '/assets/images/pose/lateral-raise.jpg',
  squat: '/assets/images/pose/deep-squat.jpg'
}

export default function PoseSelectPage() {
  const visibleExercises = POSE_CATEGORIES
    .flatMap((cat) => cat.exercises)
    .filter((ex) => ex.status === 'ready')
    .sort((a, b) => {
      const order = ['squat', 'pushup', 'bent-over-row', 'lateral_raise']
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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

      <section className="pt-100 pb-100 pose-select-page brand-page-body">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-pose-select">
              <div className="cl_blog-widget mb-30 pose-select-hero">
                <div className="pose-select-hero-head">
                  <h4 className="cl_blog-widget-title mb-0">Choose what you want to train</h4>
                  <Link to={buildPoseHistoryPath()} className="pose-tool-ghost-btn pose-tool-light-btn">
                    Training History
                  </Link>
                </div>
                <p className="pose-tool-subtitle pose-select-hero-subtitle">
                  Pick an exercise first, review the camera guidance, then analyze a local training video.
                </p>
              </div>

              <div className="cl_blog-widget mb-30">
                <h5 className="cl_blog-widget-title mb-15">Available Exercises</h5>
                <div className="pose-select-exercise-grid">
                  {visibleExercises.map((ex, imageIndex) => {
                    const imageSrc = POSE_EXERCISE_IMAGES[ex.id]
                    return (
                      <div key={ex.id} className="pose-select-exercise-card">
                        {imageSrc ? (
                          <div className="pose-select-exercise-media">
                            <img
                              src={imageSrc}
                              alt={ex.name}
                              loading="eager"
                              decoding="async"
                              {...({ fetchpriority: imageIndex < 2 ? 'high' : 'auto' } as Record<string, string>)}
                            />
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
          </div>
        </div>
      </section>
    </>
  )
}

