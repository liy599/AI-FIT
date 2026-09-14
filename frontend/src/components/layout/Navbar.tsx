import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import {
  deleteNotification,
  getMyNotifications,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  resolveBackendUrl,
  type UserNotification
} from '../../modules/user'
import { useAuth } from '../../state/auth-context'

// Normalize avatar URLs (supports relative backend file paths)
function resolveAvatarUrl(url: string | null | undefined) {
  if (!url) return null
  return resolveBackendUrl(url)
}

type NavbarProps = {
  variant: 'desktop' | 'mobile'
  onOpenMobile?: (trigger?: HTMLElement | null) => void
  onOpenSearch?: (trigger?: HTMLElement | null) => void
  onNavigate?: () => void
}

// Shared CTA arrow icon
function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Navbar(props: NavbarProps) {
  const auth = useAuth()
  const nav = useNavigate()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationTotal, setNotificationTotal] = useState(0)
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${props.variant === 'mobile' ? 'cl_mobile-nav-link' : 'cl_nav-link'}${isActive ? ' is-active' : ''}`

  const loadNotifications = useCallback(() => {
    let cancelled = false
    if (!auth.user) {
      setNotifications([])
      setUnreadCount(0)
      setNotificationTotal(0)
      return () => {
        cancelled = true
      }
    }
    getMyNotifications({ page_size: 5 })
      .then((data) => {
        if (cancelled) return
        setNotifications(data.items)
        setUnreadCount(data.unread_count)
        setNotificationTotal(data.total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [auth.user])

  useEffect(() => loadNotifications(), [loadNotifications])

  useEffect(() => {
    const onChanged = () => {
      loadNotifications()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
  }, [loadNotifications])

  async function openNotification(notification: UserNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id).catch(() => {})
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      setUnreadCount((count) => Math.max(0, count - 1))
    }
    props.onNavigate?.()
    nav(`/blogs/${notification.blog.id}?comment=${notification.comment_id}&commentPage=${notification.comment_page}`)
  }

  async function removeNotification(notification: UserNotification) {
    await deleteNotification(notification.id)
    setNotifications((items) => items.filter((item) => item.id !== notification.id))
    setNotificationTotal((count) => Math.max(0, count - 1))
    if (!notification.is_read) setUnreadCount((count) => Math.max(0, count - 1))
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
  }

  // Shared menu tree used by desktop and mobile variants
  const menuItems = (
    <>
      <li>
        <NavLink to="/" className={navLinkClass} onClick={props.onNavigate}>
          Home
        </NavLink>
      </li>
      <li>
        <NavLink to="/tools/pose" className={navLinkClass} onClick={props.onNavigate}>
          Pose
        </NavLink>
      </li>
      <li>
        <NavLink to="/food" className={navLinkClass} onClick={props.onNavigate}>
          Food
        </NavLink>
      </li>
      <li>
        <NavLink to="/courses" className={navLinkClass} onClick={props.onNavigate}>
          Courses
        </NavLink>
      </li>
      <li>
        <NavLink to="/blogs" className={navLinkClass} onClick={props.onNavigate}>
          Blog
        </NavLink>
      </li>
      <li>
        <NavLink to="/about" className={navLinkClass} onClick={props.onNavigate}>
          About Us
        </NavLink>
      </li>
      {auth.user?.is_admin ? (
        <li>
          <NavLink to="/admin" className={navLinkClass} onClick={props.onNavigate}>
            Admin
          </NavLink>
        </li>
      ) : null}
      {props.variant === 'mobile' && auth.user ? (
        <li>
          <NavLink to="/profile?tab=Blogs&activity=notifications" className="cl_mobile-nav-link" onClick={props.onNavigate}>
            Notifications{unreadCount ? ` (${unreadLabel})` : ''}
          </NavLink>
        </li>
      ) : null}
      {props.variant === 'mobile' && auth.user ? (
        <li>
          <button
            type="button"
            className="menu-action-btn cl_mobile-nav-link"
            onClick={() => {
              auth.logout().finally(() => {
                props.onNavigate?.()
                nav('/')
              })
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
      // Mobile nav: rendered inside layout dialog container
      <div className="menu-navbar">
        <ul className="main-menu">{menuItems}</ul>
      </div>
    )
  }

  return (
    <header className="cl_header-area">
      <div className="common_width_1">
        <div className="cl_header-shell">
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
              {/* Account quick actions when signed in */}
              {auth.user ? (
                <div className="cl_header-account cl_header-account-desktop-xl">
                  <button type="button" className="cl_header-action-btn notification-trigger" aria-label="Open notifications">
                    <i className="fa-regular fa-bell"></i>
                    {unreadCount ? <span className="notification-badge">{unreadLabel}</span> : null}
                  </button>
                  <ul className="cl_header-account-submenu notification-menu" aria-label="Notifications">
                    {notifications.length ? (
                      <>
                        <li className="notification-menu-list">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`notification-menu-item${notification.is_read ? '' : ' is-unread'}`}
                            >
                              <button
                                type="button"
                                className="notification-menu-item-main"
                                onClick={() => {
                                  openNotification(notification).catch(() => {})
                                }}
                              >
                                <span title={`${notification.actor.username} replied to your comment`}>
                                  <strong>{notification.actor.username}</strong> replied to your comment
                                </span>
                                <small title={notification.blog.title}>{notification.blog.title}</small>
                              </button>
                              <button
                                type="button"
                                className="notification-delete-btn"
                                aria-label="Delete notification"
                                title="Delete notification"
                                onClick={() => {
                                  removeNotification(notification).catch(() => {})
                                }}
                              >
                                <i className="fa-regular fa-trash" aria-hidden="true"></i>
                              </button>
                            </div>
                          ))}
                        </li>
                        <li>
                          <div className="notification-menu-summary">
                            <span>Showing latest {notifications.length}{notificationTotal > notifications.length ? ` of ${notificationTotal}` : ''}</span>
                            {notificationTotal > notifications.length ? <Link to="/profile?tab=Blogs&activity=notifications">View all</Link> : null}
                          </div>
                        </li>
                      </>
                    ) : (
                      <li>
                        <div className="notification-menu-empty">No notifications</div>
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}
              {auth.user ? (
                <div className="cl_header-account">
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
                          auth.logout().finally(() => {
                            nav('/')
                          })
                        }}
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              ) : null}
              {/* Main auth/profile CTA section */}
              {auth.user ? (
                <Link to="/profile" className="cl_header-btn cl_header-btn-desktop">
                  My Profile
                  <ArrowIcon />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="cl_header-btn cl_header-btn-desktop">
                    Login
                    <ArrowIcon />
                  </Link>
                  <Link to="/register" className="cl_header-btn cl_header-btn-desktop">
                    Register
                    <ArrowIcon />
                  </Link>
                </>
              )}
              {/* Mobile menu trigger (desktop header breakpoint) */}
              <button
                type="button"
                className="cl_header-menubar cl_menubar cl_header-menubar-mobile"
                onClick={(e) => props.onOpenMobile?.(e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') props.onOpenMobile?.(e.currentTarget)
                }}
                aria-label="Open menu"
              >
                <i className="fa-regular fa-bars"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
