import { useEffect, useRef } from 'react'

export default function BackToTop() {
  // Root element for progress ring state/class updates
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const path = el.querySelector<SVGPathElement>('path')
    if (!path) return

    // Initialize circular progress stroke metrics
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length} ${length}`
    path.style.strokeDashoffset = `${length}`

    const update = () => {
      const scroll = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      // Compute normalized page scroll progress [0, 1]
      const progress = height > 0 ? Math.min(1, Math.max(0, scroll / height)) : 0
      path.style.strokeDashoffset = `${length - length * progress}`
      // Show control only after scrolling beyond one viewport height
      if (scroll > window.innerHeight) el.classList.add('active-progress')
      else el.classList.remove('active-progress')
    }

    // Keep progress in sync with scroll/resize changes
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      className="progress-wrap"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      role="button"
      tabIndex={0}
      aria-label="Back to top"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }}
      ref={wrapRef}
    >
      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
      </svg>
    </div>
  )
}


