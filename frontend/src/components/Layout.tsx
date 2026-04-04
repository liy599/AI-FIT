import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BackToTop from './BackToTop'
import FeedbackDrawer from './FeedbackDrawer'
import Footer from './Footer'
import Navbar from './Navbar'

export default function Layout(props: { children: React.ReactNode }) {
  const loc = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    document.body.classList.toggle('search-active', searchOpen)
    return () => document.body.classList.remove('search-active')
  }, [searchOpen])

  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

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

  useEffect(() => {
    const cursor1 = document.querySelector<HTMLElement>('.cursor1')
    const cursor2 = document.querySelector<HTMLElement>('.cursor2')
    if (!cursor1 || !cursor2) return

    const onMove = (e: MouseEvent) => {
      lastPos.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        const { x, y } = lastPos.current
        cursor1.style.transform = `translate(${x}px, ${y}px)`
        cursor2.style.transform = `translate(${x}px, ${y}px)`
      })
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onMove)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  return (
    <>
      <div className="cursor1"></div>
      <div className="cursor2"></div>

      <BackToTop />

      <div className={mobileOpen ? 'zq_mobile_menu open' : 'zq_mobile_menu'} style={{ left: mobileOpen ? 0 : '-100%' }}>
        <div className="logo icon-img-100">
          <img src="/assets/images/logo/logo-white.png" alt="" />
        </div>
        <div
          className="close-menu cursor-pointer ti-close"
          onClick={() => setMobileOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setMobileOpen(false)
          }}
        >
          <i className="fa-sharp fa-light fa-xmark"></i>
        </div>
        <div className="container">
          <div className="row">
            <div className="col-lg-2">
              <div className="menu-text">
                <div className="text">
                  <h2>Menu</h2>
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

      <div className="ba-search-popup" style={{ display: searchOpen ? 'block' : 'none' }}>
        <div className="ba-color-layer" onClick={() => setSearchOpen(false)}></div>
        <div className="ba-search-popup-inner">
          <form
            action="#"
            onSubmit={(e) => {
              e.preventDefault()
              setSearchOpen(false)
            }}
          >
            <input type="text" placeholder="Search here..." name="search" id="search-input" />
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
              onOpenMobile={() => setMobileOpen(true)}
              onOpenSearch={() => setSearchOpen(true)}
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

