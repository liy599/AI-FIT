import { useEffect, useState } from 'react'

export default function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 shadow-glow transition hover:scale-110 hover:bg-indigo-400"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span className="text-xl leading-none">↑</span>
    </button>
  )
}

