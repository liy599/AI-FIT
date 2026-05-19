import { Link } from 'react-router-dom'

export default function VerifyEmailPage() {
  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Verify Email</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Verify</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body auth-page-body">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Confirm your email</h3>
                <div className="auth-form-grid">
                  <div>
                    <div className="cl_blog-widget cl_auth-alert cl_auth-alert--notice mb-30">
                      Email confirmation now uses a verification code. Please go back to the registration page and enter the code from your inbox.
                    </div>
                  </div>
                  <div>
                    <div className="cl_blog-widget cl_auth-switch">
                      <Link to="/register">Back to register</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
