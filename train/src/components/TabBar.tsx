'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TabBar() {
  const pathname = usePathname()

  const isTrain = pathname === '/train' || pathname.startsWith('/train/')
  const isChallenge = pathname === '/challenge' || pathname.startsWith('/challenge/')
  const isExercises = pathname === '/exercises'
  const isHistory = pathname === '/history'
  const isSettings = pathname === '/settings' || pathname === '/privacy'

  return (
    <nav className="tabBar">
      <Link href="/train" className={`tabItem${isTrain ? ' tabItemActive' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabIcon">
          <rect x="3" y="3" width="7" height="9" rx="1"></rect>
          <rect x="14" y="3" width="7" height="5" rx="1"></rect>
          <rect x="14" y="12" width="7" height="9" rx="1"></rect>
          <rect x="3" y="16" width="7" height="5" rx="1"></rect>
        </svg>
        <span>Training</span>
      </Link>

      <Link href="/challenge" className={`tabItem${isChallenge ? ' tabItemActive' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabIcon">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
        <span>Challenge</span>
      </Link>

      <Link href="/exercises" className={`tabItem${isExercises ? ' tabItemActive' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabIcon">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        <span>Exercises</span>
      </Link>

      <Link href="/history" className={`tabItem${isHistory ? ' tabItemActive' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabIcon">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>History</span>
      </Link>

      <Link href="/settings" className={`tabItem${isSettings ? ' tabItemActive' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabIcon">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Account</span>
      </Link>
    </nav>
  )
}
