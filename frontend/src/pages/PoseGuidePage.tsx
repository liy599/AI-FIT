import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { buildPoseToolPath, getPoseExerciseBySlug } from '../lib/pose/exercises'

export default function PoseGuidePage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const toolPath = buildPoseToolPath(exercise.slug)
  const videoPath = `${toolPath}?mode=offline`

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Pose Guidance</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span><Link to="/tools/pose">Pose</Link></span>
                    <span>{exercise.displayName}</span>
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
            <div className="col-xl-8 col-lg-10">
              <div className="cl_blog-widget mb-30">
                <h3 className="cl_blog-widget-title mb-30">{exercise.guideTitle}</h3>
                
                <div className="pose-tip-card pose-tip-card-light mb-30" style={{ padding: '30px' }}>
                  <ul className="pose-detail-list pose-detail-list-light" style={{ fontSize: '16px', lineHeight: '2' }}>
                    {exercise.guideTips.map((tip) => (
                      <li key={tip.title}>
                        <strong style={{ color: '#0f766e' }}>{tip.title}:</strong> {tip.content}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pose-tool-actions pose-guide-actions mt-40">
                  <Link to={toolPath} className="cl_theme-btn pose-guide-cta">
                    <span className="pose-guide-cta-title">📷 Live Coaching</span>
                    <span className="pose-guide-cta-sub">Real-time feedback using your camera</span>
                  </Link>
                  <Link to={videoPath} className="pose-tool-ghost-btn pose-tool-light-btn pose-guide-cta">
                    <span className="pose-guide-cta-title">🎞️ Video Analysis</span>
                    <span className="pose-guide-cta-sub pose-guide-cta-sub-light">Upload a clip and get a report</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
