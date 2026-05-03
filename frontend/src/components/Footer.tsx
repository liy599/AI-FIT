import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="cl_footer-area">
      <div className="page-container">
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
                <a href="mailto:hello@aifitguard.com">
                  <span>
                    <i className="fa-light fa-envelope"></i>
                  </span>{' '}
                  hello@aifitguard.com
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="cl_footer-bottom">
          <div className="footer-bottom-grid">
            <div>
              <div className="cl_footer-widget mb-40">
                <h5 className="cl_footer-widget-title">About Us</h5>
                <p className="cl_footer-widget-text mb-35">
                  AI FitGuard: pose coaching + food & nutrition tracking + community blogs. Video/image processing runs locally in your browser by default.
                </p>
              </div>
            </div>
            <div>
              <div className="cl_footer-widget pb-20">
                <h5 className="cl_footer-widget-title">Useful Link</h5>
                <ul>
                  <li>
                    <Link to="/about">About</Link>
                  </li>
                  <li>
                    <Link to="/blogs">Blog</Link>
                  </li>
                  <li>
                    <Link to="/tools/pose">Pose</Link>
                  </li>
                  <li>
                    <Link to="/food">Food</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <div className="cl_footer-widget pb-20">
                <h5 className="cl_footer-widget-title">Account</h5>
                <ul>
                  <li>
                    <Link to="/login">Login</Link>
                  </li>
                  <li>
                    <Link to="/register">Register</Link>
                  </li>
                  <li>
                    <Link to="/profile">Profile</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <div className="cl_footer-widget pb-20">
              </div>
            </div>
          </div>
        </div>
        <div className="cl_footer-copyright">
          <div className="cl_footer-copyright-text">
            <p>{`Copyright ${String.fromCharCode(169)} ${new Date().getFullYear()} AI FitGuard`}</p>
          </div>
          <div className="cl_footer-copyright-menu">
            <ul>
              <li>
                <button type="button" className="footer-text-btn">
                  Terms
                </button>
              </li>
              <li>
                <button type="button" className="footer-text-btn">
                  Privacy
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
