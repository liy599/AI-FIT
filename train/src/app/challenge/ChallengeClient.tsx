'use client'

import Link from 'next/link'
import { useState } from 'react'

function Bullseye() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="emptySvg" aria-hidden="true">
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="4" opacity="0.4" />
      <circle cx="32" cy="32" r="6" fill="currentColor" opacity="0.8" />
      <path d="M43 21l8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 22l-8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function ChallengeClient() {
  const [tab, setTab] = useState<'active' | 'past'>('active')

  return (
    <main className="container page">
      <div className="pageTop">
        <div>
          <div className="pageTitle">Challenge</div>
          <div className="pageSub">Goal-driven · Track progress</div>
        </div>
        <Link className="btn btnOutline" href="/placeholder/challenge-create">
          New
        </Link>
      </div>

      <div className="seg segLg">
        <button className={`segBtn${tab === 'active' ? ' segBtnActive' : ''}`} onClick={() => setTab('active')}>
          Active
        </button>
        <button className={`segBtn${tab === 'past' ? ' segBtnActive' : ''}`} onClick={() => setTab('past')}>
          Past
        </button>
      </div>

      <div className="emptyCard card">
        <div className="cardInner emptyInner">
          <div className="emptyGraphic">
            <Bullseye />
          </div>
          <div className="emptyTitle">{tab === 'active' ? 'No active challenges' : 'No past challenges'}</div>
          <div className="emptySub">This page is a placeholder</div>
          <div className="emptyCtas">
            <Link className="btn btnPrimary" href="/placeholder/challenge-create">
              Create challenge
            </Link>
            <Link className="btn btnGhost" href="/placeholder/challenge-rules">
              View rules
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
