'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

export default function LoginCtaCard(props: { title?: string; subtitle?: string }) {
  const pathname = usePathname()
  const sp = useSearchParams()

  const next = useMemo(() => {
    const qs = sp?.toString()
    return encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, sp])

  return (
    <div className="emptyCard card">
      <div className="cardInner emptyInner">
        <div className="emptyIcon">🔒</div>
        <div className="emptyTitle">{props.title ?? 'Sign in required'}</div>
        <div className="emptySub">{props.subtitle ?? 'Please sign in to access this page'}</div>
        <div className="emptyCtas">
          <Link href={`/login?next=${next}`} className="btn btnPrimary">
            Sign in
          </Link>
          <Link href={`/register?next=${next}`} className="btn btnGhost">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
