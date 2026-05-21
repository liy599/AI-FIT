import { Link } from 'react-router-dom'
import { useAuth } from '../../state/auth-context'

export default function Footer() {
  const auth = useAuth()

  return (
    // Global site footer
    <footer className="cl_footer-area" aria-label="Site footer">
      <div className="page-container">
        {/* Top row: brand and primary contact */}
        <div className="cl_footer-top">
          <div className="footer-top-grid">
            <div>
              <div className="cl_footer-logo">
                <Link to="/" className="cl_brand cl_brand--light">
                  AI FitGuard
                </Link>
              </div>
            </div>
            <div>
              <div className="cl_footer-action">
                <a href="mailto:aifitguard@163.com">
                  <span>
                    <i className="fa-light fa-envelope"></i>
                  </span>{' '}
                  aifitguard@163.com
                </a>
              </div>
            </div>
          </div>
        </div>
        {/* Main footer content: product intro and quick links */}
        <div className="cl_footer-bottom">
          <div className="footer-bottom-grid">
            <div>
              <div className="cl_footer-widget mb-40">
                <h5 className="cl_footer-widget-title">About Us</h5>
                <p className="cl_footer-widget-text mb-35">
                  AI FitGuard helps you train with clearer movement feedback and share progress through community posts. It is designed and developed by Group 4 5090.
                </p>
              </div>
            </div>
            <div>
              <div className="cl_footer-widget pb-20">
                <h5 className="cl_footer-widget-title">Useful Link</h5>
                <ul aria-label="Useful links">
                  <li>
                    <Link to="/tools/pose">Pose</Link>
                  </li>
                  <li>
                    <Link to="/blogs">Blog</Link>
                  </li>
                  <li>
                    <Link to="/about">About</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <div className="cl_footer-widget pb-20">
                <h5 className="cl_footer-widget-title">Account</h5>
                <ul aria-label="Account links">
                  {!auth.user ? (
                    <>
                      <li>
                        <Link to="/login">Login</Link>
                      </li>
                      <li>
                        <Link to="/register">Register</Link>
                      </li>
                    </>
                  ) : null}
                  <li>
                    <Link to="/profile">Profile</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        {/* Legal and copyright row */}
        <div className="cl_footer-copyright">
          <div className="cl_footer-copyright-text">
            <p>{`Copyright ${String.fromCharCode(169)} ${new Date().getFullYear()} AI FitGuard`}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

