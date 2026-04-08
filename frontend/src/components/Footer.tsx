import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="cl_footer-area">
      <div className="container">
        <div className="cl_footer-top">
          <div className="row align-items-center">
            <div className="col-md-4">
              <div className="cl_footer-logo">
                <Link to="/">
                  <img src="/assets/images/logo/logo-white.png" alt="" />
                </Link>
              </div>
            </div>
            <div className="col-md-8">
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
          <div className="row justify-content-between">
            <div className="col-xl-4 col-lg-4 col-md-6 col-sm-6">
              <div className="cl_footer-widget mb-40">
                <h5 className="cl_footer-widget-title">About Us</h5>
                <p className="cl_footer-widget-text mb-35">
                  AI FitGuard: pose coaching + food & nutrition tracking + community blogs + courses. Video/image processing runs locally in your browser by default.
                </p>
                <div className="cl_footer-widget-social">
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    <i className="fa-brands fa-facebook-f"></i>
                  </a>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    <i className="fa-brands fa-instagram"></i>
                  </a>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    <i className="fa-brands fa-linkedin-in"></i>
                  </a>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    <i className="fa-brands fa-youtube"></i>
                  </a>
                </div>
              </div>
            </div>
            <div className="col-xl-2 col-lg-2 col-md-6 col-sm-6">
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
                    <Link to="/courses">Courses</Link>
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
            <div className="col-xl-3 col-lg-3 col-md-6 col-sm-6">
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
            <div className="col-xl-3 col-lg-3 col-md-6 col-sm-6">
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
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    Feedback Drawer (bottom-right)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="cl_footer-copyright">
          <div className="cl_footer-copyright-text">
            <p>Copyright © {new Date().getFullYear()} AI FitGuard</p>
          </div>
          <div className="cl_footer-copyright-menu">
            <ul>
              <li>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Terms
                </a>
              </li>
              <li>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Privacy
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
