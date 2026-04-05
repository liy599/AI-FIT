'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { useSession } from '@/lib/client/useSession'

export default function SiteHeader() {
  const pathname = usePathname()
  const { session } = useSession()
  const authed = !!session

  const items = useMemo(
    () => [
      { href: '/train', label: 'Training' },
      { href: '/challenge', label: 'Challenge' },
      { href: '/exercises', label: 'Exercises' },
      { href: '/history', label: 'History' }
    ],
    []
  )

  return (
    <header className="siteHeader">
      <div className="container siteHeaderInner siteHeaderInnerV2">
        <Link href="/" className="brand">
          Train
        </Link>

        <nav className="headerPills" aria-label="Main navigation">
          {items.map((x) => {
            const active = pathname === x.href || (x.href !== '/' && pathname.startsWith(`${x.href}/`))
            return (
              <Link key={x.href} href={x.href} className={`headerPill${active ? ' headerPillActive' : ''}`}>
                {x.label}
              </Link>
            )
          })}
        </nav>

        <div className="navRight">
          {!authed ? (
            <>
              <Link className="btn btnGhost" href="/login">
                Sign in
              </Link>
              <Link className="btn btnPrimary" href="/register">
                Sign up
              </Link>
            </>
          ) : (
            <Link className="btn btnPrimary" href="/settings">
              Account
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
