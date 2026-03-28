import { useEffect, useRef } from 'react'
import BackToTop from './BackToTop'
import FeedbackDrawer from './FeedbackDrawer'
import Footer from './Footer'
import Navbar from './Navbar'

export default function Layout(props: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div ref={ref} className="min-h-screen bg-hero-gradient">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">{props.children}</main>
      <Footer />
      <BackToTop />
      <FeedbackDrawer />
    </div>
  )
}

