import { Link, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE } from '../lib/api'
import { useAuth } from '../state/auth-context'

function resolveAvatarUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

type NavbarProps = {
  variant: 'desktop' | 'mobile'
  onOpenMobile?: (trigger?: HTMLElement | null) => void
  onOpenSearch?: (trigger?: HTMLElement | null) => void
  onNavigate?: () => void
}

export default function Navbar(props: NavbarProps) {
  const auth = useAuth()
  const nav = useNavigate()

  const menuItems = (
    <>
      <li>
        <NavLink to="/" onClick={props.onNavigate}>
          Home
        </NavLink>
      </li>
      <li>
        <NavLink to="/about" onClick={props.onNavigate}>
          About Us
        </NavLink>
      </li>
      <li className="menu-has-child">
        <NavLink to="/tools/pose" onClick={props.onNavigate}>
          Tools
        </NavLink>
        <ul className="submenu">
          <li>
            <NavLink to="/tools/pose" onClick={props.onNavigate}>
              Pose
            </NavLink>
          </li>
          <li>
            <NavLink to="/food" onClick={props.onNavigate}>
              Food
            </NavLink>
          </li>
        </ul>
      </li>
      <li>
        <NavLink to="/blogs" onClick={props.onNavigate}>
          Blog
        </NavLink>
      </li>
      {props.variant === 'mobile' && auth.user ? (
        <li>
          <button
            type="button"
            className="menu-action-btn"
            onClick={() => {
              auth.logout()
              props.onNavigate?.()
              nav('/')
            }}
          >
            Logout
          </button>
        </li>
      ) : null}
    </>
  )

  if (props.variant === 'mobile') {
    return (
      <div className="menu-navbar">
        <ul className="main-menu">{menuItems}</ul>
      </div>
    )
  }

  return (
    <header className="cl_header-area">
      <div className="common_width_1">
        <div className="container-fluid p-0">
          <div className="cl_header-wrap">
            <div className="cl_header-left">
              <div className="cl_header-logo">
                <Link to="/" className="cl_brand">
                  AI FitGuard
                </Link>
              </div>
              <div className="cl_header-menu">
                <nav id="mobile-menu">
                  <ul>{menuItems}</ul>
                </nav>
              </div>
            </div>
            <div className="cl_header-right">
              <button
                type="button"
                className="cl_header-action-btn cl_search_popup d-none d-lg-flex"
                onClick={(e) => {
                  props.onOpenSearch?.(e.currentTarget)
                }}
                aria-label="Open search"
              >
                <i className="fa-regular fa-magnifying-glass"></i>
              </button>
              {auth.user ? (
                <div className="cl_header-account d-none d-xxl-flex">
                  <Link to="/profile" className="cl_header-action-btn" aria-label="Open profile menu">
                    {auth.user.avatar_url ? (
                      <img
                        src={resolveAvatarUrl(auth.user.avatar_url) ?? ''}
                        alt={`${auth.user.username} avatar`}
                        style={{ width: 28, height: 28, borderRadius: 9999, objectFit: 'cover' }}
                      />
                    ) : (
                      <i className="fa-regular fa-user"></i>
                    )}
                  </Link>
                  <ul className="cl_header-account-submenu" aria-label="Profile menu">
                    <li>
                      <button
                        type="button"
                        className="menu-action-btn"
                        onClick={() => {
                          auth.logout()
                          nav('/')
                        }}
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              ) : null}
              {auth.user ? (
                <Link to="/profile" className="cl_header-btn d-none d-md-flex">
                  My Profile
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
                      fill="currentColor"
                    />
                  </svg>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="cl_header-btn d-none d-md-flex">
                    Login
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Link>
                  <Link to="/register" className="cl_header-btn d-none d-md-flex">
                    Register
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Link>
                </>
              )}
              <span
                className="cl_header-menubar cl_menubar d-xl-none"
                role="button"
                tabIndex={0}
                onClick={(e) => props.onOpenMobile?.(e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') props.onOpenMobile?.(e.currentTarget)
                }}
                aria-label="Open menu"
              >
                <i className="fa-regular fa-bars"></i>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
