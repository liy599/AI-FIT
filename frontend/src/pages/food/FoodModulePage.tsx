import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary } from '../../lib/food/api'
import type { DaySummary, FoodMealType } from '../../lib/food/types_runtime'

const GOALS = { kcal: 2000, protein: 50, carbs: 250, fat: 65 }

const MEALS: { type: FoodMealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { type: 'lunch', label: 'Lunch', icon: '☀️' },
  { type: 'dinner', label: 'Dinner', icon: '🌙' },
  { type: 'snack', label: 'Snack', icon: '🍎' },
]

function CalorieRing({ current, goal }: { current: number; goal: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const pct = Math.min(current / goal, 1)
  const dash = circ * pct
  return (
    <svg width="148" height="148" viewBox="0 0 148 148" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="74" cy="74" r={r} fill="none" stroke="var(--color-border-default)" strokeWidth="13" />
      <circle
        cx="74" cy="74" r={r} fill="none"
        stroke="var(--color-brand)" strokeWidth="13"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 74 74)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="74" y="68" textAnchor="middle" fill="var(--color-text-primary)" fontSize="24" fontWeight="800" fontFamily="inherit">
        {current.toFixed(0)}
      </text>
      <text x="74" y="86" textAnchor="middle" fill="var(--color-text-muted)" fontSize="12" fontFamily="inherit">
        of {goal} kcal
      </text>
    </svg>
  )
}

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min((current / goal) * 100, 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
          {current.toFixed(1)}g{' '}
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {goal}g</span>
        </span>
      </div>
      <div style={{ background: 'var(--color-border-default)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div
          style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.8s ease' }}
        />
      </div>
    </div>
  )
}

export default function FoodModulePage() {
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTodaySummary()
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load today\'s data'))
  }, [])

  const totals = summary?.totals ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  const mealMap = Object.fromEntries((summary?.meals ?? []).map((m) => [m.mealType, m]))
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const remaining = Math.max(GOALS.kcal - totals.kcal, 0)

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Nutrition Tracker
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 15, margin: 0 }}>{today}</p>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-error-bg)', color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24, fontSize: 14
          }}>
            {error}
          </div>
        )}

        <div className="row">

          {/* Left column: calorie ring + macros */}
          <div className="col-lg-4 col-md-5" style={{ marginBottom: 24 }}>
            <div style={{
              background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
              padding: '28px 24px', boxShadow: 'var(--shadow-soft)', height: '100%'
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 20px' }}>
                TODAY'S CALORIES
              </p>

              <CalorieRing current={totals.kcal} goal={GOALS.kcal} />

              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, margin: '16px 0 28px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-brand)', margin: '0 0 2px' }}>
                    {totals.kcal.toFixed(0)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Eaten</p>
                </div>
                <div style={{ width: 1, background: 'var(--color-border-default)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                    {remaining.toFixed(0)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Remaining</p>
                </div>
              </div>

              <MacroBar label="Protein" current={totals.protein} goal={GOALS.protein} color="#3b82f6" />
              <MacroBar label="Carbohydrates" current={totals.carbs} goal={GOALS.carbs} color="#f59e0b" />
              <MacroBar label="Fat" current={totals.fat} goal={GOALS.fat} color="#ef4444" />
            </div>
          </div>

          {/* Right column: meal cards */}
          <div className="col-lg-8 col-md-7">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {MEALS.map(({ type, label, icon }) => {
                const meal = mealMap[type]
                const kcal = meal?.totals.kcal ?? 0
                const count = meal?.items.length ?? 0
                const hasData = count > 0
                return (
                  <div key={type} style={{
                    background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                    padding: 20, boxShadow: 'var(--shadow-soft)',
                    border: hasData ? '1.5px solid rgba(52, 204, 149, 0.25)' : '1.5px solid transparent'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{label}</span>
                      </div>
                      <Link
                        to={`/food/meal/${type}`}
                        style={{
                          fontSize: 12, fontWeight: 700, textDecoration: 'none',
                          padding: '4px 12px', borderRadius: 999,
                          background: hasData ? 'rgba(52, 204, 149, 0.1)' : 'var(--color-bg-soft)',
                          color: hasData ? 'var(--color-brand)' : 'var(--color-text-muted)',
                          border: `1px solid ${hasData ? 'rgba(52, 204, 149, 0.3)' : 'var(--color-border-default)'}`
                        }}
                      >
                        {hasData ? 'Edit' : '+ Add'}
                      </Link>
                    </div>

                    {hasData ? (
                      <>
                        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                          {kcal.toFixed(0)}{' '}
                          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>kcal</span>
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                          {count} food item{count !== 1 ? 's' : ''} logged
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                        No foods logged yet
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tip */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              border: '1px solid rgba(52, 204, 149, 0.2)',
              borderRadius: 'var(--radius-lg)', padding: '14px 20px'
            }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-success)', fontWeight: 600 }}>
                💡 Log all your meals consistently to get accurate weekly nutrition insights.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
