import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BackToTop from './BackToTop'
import Footer from './Footer'
import Navbar from './Navbar'

// Layout component: wraps all pages with common UI (navbar, footer, dialogs)
export default function Layout(props: { children: ReactNode }) {
  const loc = useLocation()

  // UI state: mobile menu & search dialog visibility
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Refs for focus management (accessibility)
  const mobileDialogRef = useRef<HTMLDivElement | null>(null)
  const searchDialogRef = useRef<HTMLDivElement | null>(null)
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mobileTriggerRef = useRef<HTMLElement | null>(null)
  const searchTriggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Derived state: whether any modal-like overlay is open
  const overlayOpen = mobileOpen || searchOpen

  // Toggle body class and lock scroll when overlays are open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = overlayOpen ? 'hidden' : ''
    document.body.classList.toggle('search-active', searchOpen)
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('search-active')
    }
  }, [overlayOpen, searchOpen])

  // Mark main content as inert for assistive technologies while a dialog is open
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    if (overlayOpen) {
      content.setAttribute('aria-hidden', 'true')
      content.setAttribute('inert', '')
      return
    }
    content.removeAttribute('aria-hidden')
    content.removeAttribute('inert')
  }, [overlayOpen])

  // Reset UI state when route changes
  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0 })
  }, [loc.pathname, loc.search])

  // Handle ESC key to close dialogs
  useEffect(() => {
    if (!overlayOpen) return

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
  }, [mobileOpen, overlayOpen, searchOpen])

  // Manage focus when mobile menu opens/closes
  useEffect(() => {
    if (mobileOpen) {
      mobileCloseButtonRef.current?.focus()
      return
    }
    mobileTriggerRef.current?.focus()
  }, [mobileOpen])

  // Manage focus when search dialog opens/closes
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
      return
    }
    searchTriggerRef.current?.focus()
  }, [searchOpen])

  // Trap keyboard focus inside dialog (accessibility)
  function trapFocus(event: ReactKeyboardEvent, container: HTMLElement | null) {
    if (event.key !== 'Tab' || !container) return

    const candidates = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const focusable = Array.from(candidates).filter(
      (el) =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-hidden') !== 'true' &&
        el.offsetParent !== null
    )

    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    // Loop focus inside dialog
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Apply background images from data attributes
  const applyDataBackground = useCallback(() => {
    document.querySelectorAll<HTMLElement>('[data-background]').forEach((el) => {
      const bg = el.getAttribute('data-background')
      if (!bg) return
      el.style.backgroundImage = `url(${bg})`
    })
  }, [])

  // Run background update on route change
  useEffect(() => {
    applyDataBackground()
  }, [applyDataBackground, loc.pathname])

  return (
    <>
      {/* Scroll-to-top button */}
      <BackToTop />

      {/* Mobile menu dialog */}
      <div
        className={mobileOpen ? 'zq_mobile_menu open' : 'zq_mobile_menu'}
        style={{ left: mobileOpen ? 0 : '-100%' }}
        ref={mobileDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        aria-hidden={!mobileOpen}
        tabIndex={-1}
        onKeyDown={(event) => trapFocus(event, mobileDialogRef.current)}
      >
        <div className="logo icon-img-100">
          <Link to="/" className="cl_brand cl_brand--light">
            AI FitGuard
          </Link>
        </div>

        {/* Close button */}
        <button
          type="button"
          className="close-menu cursor-pointer ti-close menu-action-btn"
          ref={mobileCloseButtonRef}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <i className="fa-sharp fa-light fa-xmark"></i>
        </button>

        {/* Mobile navigation */}
        <div className="page-container">
          <div className="mobile-menu-grid">
            <h2 id="mobile-menu-title">Menu</h2>
            <Navbar variant="mobile" onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      </div>

      {/* Search dialog */}
      <div
        className="ba-search-popup"
        style={{ display: searchOpen ? 'block' : 'none' }}
        ref={searchDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        aria-hidden={!searchOpen}
        tabIndex={-1}
        onKeyDown={(event) => trapFocus(event, searchDialogRef.current)}
      >
        {/* Background overlay */}
        <div className="ba-color-layer" onClick={() => setSearchOpen(false)}></div>

        {/* Search form */}
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
            <input
              type="text"
              placeholder="Search here..."
              name="search"
              ref={searchInputRef}
            />
            <button type="submit">
              <i className="fal fa-search"></i>
            </button>
          </form>
        </div>
      </div>

      {/* Main page layout */}
      <div id="smooth-wrapper" ref={contentRef}>
        <div id="smooth-content">
          <div className="body-wrapper">

            {/* Top navigation */}
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

            {/* Page content */}
            <main>{props.children}</main>

            {/* Footer */}
            <Footer />
          </div>
        </div>
      </div>
    </>
  )
}

