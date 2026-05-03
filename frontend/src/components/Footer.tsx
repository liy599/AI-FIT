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
                <div className="cl_footer-widget-social">
                  <button type="button" className="footer-icon-btn" aria-label="Facebook link coming soon">
                    <i className="fa-brands fa-facebook-f"></i>
                  </button>
                  <button type="button" className="footer-icon-btn" aria-label="Instagram link coming soon">
                    <i className="fa-brands fa-instagram"></i>
                  </button>
                  <button type="button" className="footer-icon-btn" aria-label="LinkedIn link coming soon">
                    <i className="fa-brands fa-linkedin-in"></i>
                  </button>
                  <button type="button" className="footer-icon-btn" aria-label="YouTube link coming soon">
                    <i className="fa-brands fa-youtube"></i>
                  </button>
                </div>
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
                <h5 className="cl_footer-widget-title">Support</h5>
                <div className="cl_footer-widget-address">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M2.37669 6.31253L12.0926 1.68589C13.5096 1.01113 14.9887 2.49023 14.314 3.90722L9.68732 13.6232C9.05506 14.9509 7.13836 14.8688 6.622 13.4918L5.76601 11.2092C5.597 10.7585 5.24138 10.4028 4.79067 10.2338L2.50804 9.37785C1.13108 8.86149 1.04895 6.94478 2.37669 6.31253Z"
                      stroke="currentColor"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <button type="button" className="footer-text-btn">
                    Feedback Drawer (bottom-right)
                  </button>
                </div>
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
