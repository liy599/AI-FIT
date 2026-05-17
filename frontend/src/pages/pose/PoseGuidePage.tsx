import { Link, useParams } from 'react-router-dom'
import { buildPoseVideoPath, getPoseExerciseBySlug } from '../../modules/pose'

export default function PoseGuidePage() {
  const params = useParams<{ exerciseSlug: string }>()
  const exercise = getPoseExerciseBySlug(params.exerciseSlug)
  const videoPath = buildPoseVideoPath(exercise.slug)

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-pose-guide">
              <div className="cl_blog-widget mb-30">
                <h3 className="cl_blog-widget-title mb-30">{exercise.guideTitle}</h3>

                <div className="pose-tip-card pose-tip-card-light mb-30 pose-guide-tip-card">
                  <ul className="pose-detail-list pose-detail-list-light pose-guide-tip-list">
                    <li>
                      <strong className="pose-guide-tip-title">Lighting:</strong> Use bright, even lighting so keypoints are easy to detect.
                    </li>
                    <li>
                      <strong className="pose-guide-tip-title">Clean background:</strong> Keep the background simple and avoid clutter behind your body.
                    </li>
                    <li>
                      <strong className="pose-guide-tip-title">Avoid occlusion:</strong> Keep joints visible and avoid covering arms, knees, hips, or ankles with furniture or equipment.
                    </li>
                    {exercise.guideTips.map((tip) => (
                      <li key={tip.title}>
                        <strong className="pose-guide-tip-title">{tip.title}:</strong> {tip.content}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pose-tool-actions pose-guide-actions mt-40">
                  <Link to={videoPath} className="cl_theme-btn pose-guide-cta">
                    <span className="pose-guide-cta-title">Video Analysis</span>
                    <span className="pose-guide-cta-sub">Upload a clip and get a report</span>
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
