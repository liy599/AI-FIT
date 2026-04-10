import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BackToTop from './BackToTop'
import FeedbackDrawer from './FeedbackDrawer'
import Footer from './Footer'
import Navbar from './Navbar'

export default function Layout(props: { children: React.ReactNode }) {
  const loc = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const mobileDialogRef = useRef<HTMLDivElement | null>(null)
  const searchDialogRef = useRef<HTMLDivElement | null>(null)
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mobileTriggerRef = useRef<HTMLElement | null>(null)
  const searchTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    document.body.classList.toggle('search-active', searchOpen)
    return () => document.body.classList.remove('search-active')
  }, [searchOpen])

  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  useEffect(() => {
    if (!mobileOpen && !searchOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
          searchTriggerRef.current?.focus()
          return
        }
        if (mobileOpen) {
          setMobileOpen(false)
          mobileTriggerRef.current?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, searchOpen])

  useEffect(() => {
    if (mobileOpen) {
      mobileCloseButtonRef.current?.focus()
      return
    }
    mobileTriggerRef.current?.focus()
  }, [mobileOpen])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
      return
    }
    searchTriggerRef.current?.focus()
  }, [searchOpen])

  function trapFocus(event: ReactKeyboardEvent, container: HTMLElement | null) {
    if (event.key !== 'Tab' || !container) return
    const focusable = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const applyDataBackground = useMemo(() => {
    return () => {
      document.querySelectorAll<HTMLElement>('[data-background]').forEach((el) => {
        const bg = el.getAttribute('data-background')
        if (!bg) return
        el.style.backgroundImage = `url(${bg})`
      })
    }
  }, [])

  useEffect(() => {
    applyDataBackground()
  }, [applyDataBackground, loc.pathname])

  return (
    <>
      <BackToTop />

      <div
        className={mobileOpen ? 'zq_mobile_menu open' : 'zq_mobile_menu'}
        style={{ left: mobileOpen ? 0 : '-100%' }}
        ref={mobileDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        aria-hidden={!mobileOpen}
        onKeyDown={(event) => trapFocus(event, mobileDialogRef.current)}
      >
        <div className="logo icon-img-100">
          <Link to="/" className="cl_brand cl_brand--light">
            AI FitGuard
          </Link>
        </div>
        <button
          type="button"
          className="close-menu cursor-pointer ti-close menu-action-btn"
          ref={mobileCloseButtonRef}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <i className="fa-sharp fa-light fa-xmark"></i>
        </button>
        <div className="container">
          <div className="row">
            <div className="col-lg-2">
              <div className="menu-text">
                <div className="text">
                  <h2 id="mobile-menu-title">Menu</h2>
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <Navbar variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="col-lg-3">
              <div className="cont-info">
                <div className="item mb-40">
                  <h6 className="sub-title mb-15">Contact</h6>
                  <h5>
                    <a href="mailto:hello@aifitguard.com">hello@aifitguard.com</a>
                  </h5>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="ba-search-popup"
        style={{ display: searchOpen ? 'block' : 'none' }}
        ref={searchDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        aria-hidden={!searchOpen}
        onKeyDown={(event) => trapFocus(event, searchDialogRef.current)}
      >
        <div className="ba-color-layer" onClick={() => setSearchOpen(false)}></div>
        <div className="ba-search-popup-inner">
          <h2 id="search-dialog-title" className="sr-only">
            Site Search
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearchOpen(false)
            }}
          >
            <input type="text" placeholder="Search here..." name="search" id="search-input" ref={searchInputRef} />
            <button type="submit">
              <i className="fal fa-search"></i>
            </button>
          </form>
        </div>
      </div>

      <div className="has-smooth" id="has_smooth"></div>
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <div className="body-wrapper">
            <Navbar
              variant="desktop"
              onOpenMobile={(trigger) => {
                mobileTriggerRef.current = trigger ?? null
                setMobileOpen(true)
              }}
              onOpenSearch={(trigger) => {
                searchTriggerRef.current = trigger ?? null
                setSearchOpen(true)
              }}
            />
            <main>{props.children}</main>
            <Footer />
          </div>
        </div>
      </div>

      <FeedbackDrawer />
    </>
  )
}

