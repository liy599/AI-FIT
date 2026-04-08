import { Link } from 'react-router-dom'

export default function PoseGuidePage() {
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
            <div className="col-xl-8 col-lg-10">
              <div className="cl_blog-widget mb-30">
                <h3 className="cl_blog-widget-title mb-30">Squat Camera Tips</h3>
                
                <div className="pose-tip-card pose-tip-card-light mb-30" style={{ padding: '30px' }}>
                  <ul className="pose-detail-list pose-detail-list-light" style={{ fontSize: '16px', lineHeight: '2' }}>
                    <li><strong style={{ color: '#0f766e' }}>1) Full body in frame:</strong> Make sure your entire body is visible in the camera view.</li>
                    <li><strong style={{ color: '#0f766e' }}>2) Clear side view:</strong> Stand sideways to the camera so joints are easier to track.</li>
                    <li><strong style={{ color: '#0f766e' }}>3) Privacy:</strong> Pose detection runs locally in your browser. We do not upload your video.</li>
                  </ul>
                </div>

                <div className="text-center mt-40" style={{ textAlign: 'center' }}>
                  <Link to="/tools/pose/squat/tool" className="cl_theme-btn">
                    Got it, continue
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
