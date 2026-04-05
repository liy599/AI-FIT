'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Plan = {
  id: string
  title: string
  subtitle: string
  meta: string
}

function Icon({ name }: { name: 'food' | 'scan' | 'water' | 'weight' | 'camera' | 'more' }) {
  if (name === 'food') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
        <path d="M4 3v8a4 4 0 0 0 4 4v6h2V3H4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 3v7a3 3 0 0 0 6 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'scan') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
        <path d="M4 7V5a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 7V5a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 17v2a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 17v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'water') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
        <path
          d="M12 2S6 9 6 13.2A6 6 0 0 0 12 19a6 6 0 0 0 6-5.8C18 9 12 2 12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9.5 14.5c.7 1.3 2 2 3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'weight') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
        <path d="M6 7a6 6 0 0 1 12 0v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7Z" stroke="currentColor" strokeWidth="2" />
        <path d="M9 7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 10v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'camera') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
        <path
          d="M4 7a2 2 0 0 1 2-2h3l1-2h4l1 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="icon24" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function TrainHomeClient() {
  const [tab, setTab] = useState<'official' | 'mine'>('official')

  const plans = useMemo<Plan[]>(
    () => [
      { id: 'p1', title: 'Beginner Hypertrophy', subtitle: '3x/week · Full body', meta: '6 weeks · Low barrier' },
      { id: 'p2', title: 'Strength Foundations', subtitle: '4x/week · Upper/Lower split', meta: '8 weeks · Progressive overload' },
      { id: 'p3', title: 'Posture & Mobility', subtitle: '3x/week · Mobility + stability', meta: '4 weeks · Low intensity' }
    ],
    []
  )

  return (
    <main className="container page">
      <section className="card dietCard">
        <div className="cardInner">
          <div className="dietTop">
            <div>
              <div className="dietTitle">Nutrition</div>
              <div className="dietSub">Placeholder · Today</div>
            </div>
            <Link className="btn btnOutline" href="/placeholder/diet-edit">
              Edit
            </Link>
          </div>

          <div className="dietMetrics">
            <div className="metricCard">
              <div className="metricLabel">Calories</div>
              <div className="metricValue">—</div>
              <div className="metricHint">kcal</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Protein</div>
              <div className="metricValue">—</div>
              <div className="metricHint">g</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Fat</div>
              <div className="metricValue">—</div>
              <div className="metricHint">g</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Carbs</div>
              <div className="metricValue">—</div>
              <div className="metricHint">g</div>
            </div>
          </div>

          <div className="dietActions">
            <Link className="iconBtn" href="/placeholder/diet">
              <Icon name="food" />
              <span>Food</span>
            </Link>
            <Link className="iconBtn" href="/placeholder/scan">
              <Icon name="scan" />
              <span>Scan</span>
            </Link>
            <Link className="iconBtn" href="/placeholder/water">
              <Icon name="water" />
              <span>Water</span>
            </Link>
            <Link className="iconBtn" href="/placeholder/weight">
              <Icon name="weight" />
              <span>Weight</span>
            </Link>
            <Link className="iconBtn" href="/placeholder/photo">
              <Icon name="camera" />
              <span>Photo</span>
            </Link>
            <Link className="iconBtn" href="/placeholder/train-more">
              <Icon name="more" />
              <span>More</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="trainSection">
        <div className="sectionTop">
          <div className="sectionTitleV2">Plans</div>
          <div className="seg">
            <button className={`segBtn${tab === 'official' ? ' segBtnActive' : ''}`} onClick={() => setTab('official')}>
              Official
            </button>
            <button className={`segBtn${tab === 'mine' ? ' segBtnActive' : ''}`} onClick={() => setTab('mine')}>
              Mine
            </button>
          </div>
        </div>

        {tab === 'mine' ? (
          <div className="emptyCard card">
            <div className="cardInner emptyInner">
              <div className="emptyIcon">🎯</div>
              <div className="emptyTitle">No plans</div>
              <div className="emptySub">Placeholder</div>
            </div>
          </div>
        ) : (
          <div className="planGrid">
            {plans.map((p) => (
              <div key={p.id} className="card planCard">
                <div className="cardInner planInner">
                  <div className="planTitle">{p.title}</div>
                  <div className="planSub">{p.subtitle}</div>
                  <div className="planMeta">{p.meta}</div>
                  <div className="planCtas">
                    <Link className="btn btnPrimary" href={`/placeholder/plan-view?planId=${encodeURIComponent(p.id)}`}>
                      View
                    </Link>
                    <Link className="btn btnGhost" href={`/placeholder/plan-join?planId=${encodeURIComponent(p.id)}`}>
                      Join
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
