import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary } from '../../lib/food/api'
import type { DaySummary, FoodMealType } from '../../lib/food/types_runtime'

const GOALS = { kcal: 2000, protein: 50, carbs: 250, fat: 65 }

const MEALS: { type: FoodMealType; label: string; icon: string; color: string; bg: string; gradient: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '🌅', color: '#f59e0b', bg: '#fffbeb', gradient: 'linear-gradient(135deg,#fffbeb,#fef3c7)' },
  { type: 'lunch',     label: 'Lunch',     icon: '☀️', color: '#22c55e', bg: '#f0fdf4', gradient: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
  { type: 'dinner',    label: 'Dinner',    icon: '🌙', color: '#6366f1', bg: '#eef2ff', gradient: 'linear-gradient(135deg,#eef2ff,#e0e7ff)' },
  { type: 'snack',     label: 'Snack',     icon: '🍎', color: '#ef4444', bg: '#fef2f2', gradient: 'linear-gradient(135deg,#fef2f2,#fee2e2)' },
]

const QUICK_TIPS = [
  { icon: '💧', text: 'Aim for 8 glasses of water today' },
  { icon: '🥗', text: 'Fill half your plate with vegetables' },
  { icon: '⏰', text: 'Eat every 3–4 hours to keep energy stable' },
  { icon: '🎯', text: 'Track consistently for accurate weekly insights' },
]

function CalorieRing({ current, goal }: { current: number; goal: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = Math.min(current / goal, 1)
  const dash = circ * pct
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="72" cy="72" r={r} fill="none" stroke="var(--color-border-default)" strokeWidth="12" />
      <circle cx="72" cy="72" r={r} fill="none" stroke="var(--color-brand)" strokeWidth="12"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 72 72)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="72" y="66" textAnchor="middle" fill="var(--color-text-primary)" fontSize="22" fontWeight="800" fontFamily="inherit">
        {current.toFixed(0)}
      </text>
      <text x="72" y="82" textAnchor="middle" fill="var(--color-text-muted)" fontSize="11" fontFamily="inherit">
        of {goal} kcal
      </text>
    </svg>
  )
}

function MacroBar({ label, current, goal, color, bg }: { label: string; current: number; goal: number; color: string; bg: string }) {
  const pct = Math.min((current / goal) * 100, 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
        </div>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: 12 }}>
          {current.toFixed(1)}g <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {goal}g</span>
        </span>
      </div>
      <div style={{ background: bg, borderRadius: 999, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function FoodModulePage() {
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [error, setError] = useState('')
  const tipIndex = new Date().getDay() % QUICK_TIPS.length

  useEffect(() => {
    getTodaySummary()
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load today's data"))
  }, [])

  const totals = summary?.totals ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  const mealMap = Object.fromEntries((summary?.meals ?? []).map((m) => [m.mealType, m]))
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const remaining = Math.max(GOALS.kcal - totals.kcal, 0)
  const tip = QUICK_TIPS[tipIndex]

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-brand)', letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            NUTRITION TRACKER
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Today's Nutrition
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>{today}</p>
        </div>

        {error && (
          <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div className="row">

          {/* Left: calorie ring + macros */}
          <div className="col-lg-4" style={{ marginBottom: 24 }}>
            <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: '24px 20px', boxShadow: 'var(--shadow-soft)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 16px' }}>
                Calories
              </p>

              <CalorieRing current={totals.kcal} goal={GOALS.kcal} />

              {/* Eaten / Remaining */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 0, margin: '16px 0 20px' }}>
                {[
                  { label: 'Eaten', value: totals.kcal.toFixed(0), color: 'var(--color-brand)' },
                  { label: 'Remaining', value: remaining.toFixed(0), color: 'var(--color-text-primary)' },
                ].map(({ label, value, color }, i) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center', padding: '0 12px', borderRight: i === 0 ? '1px solid var(--color-border-default)' : 'none' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color, margin: '0 0 2px' }}>{value}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>

              <MacroBar label="Protein"      current={totals.protein} goal={GOALS.protein} color="#3b82f6" bg="#eff6ff" />
              <MacroBar label="Carbohydrates" current={totals.carbs}  goal={GOALS.carbs}   color="#f59e0b" bg="#fffbeb" />
              <MacroBar label="Fat"           current={totals.fat}    goal={GOALS.fat}     color="#ef4444" bg="#fef2f2" />

              {/* Progress pct */}
              <div style={{ marginTop: 16, background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Daily goal progress
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--color-brand)' }}>
                  {Math.min(Math.round((totals.kcal / GOALS.kcal) * 100), 100)}%
                </p>
              </div>
            </div>
          </div>

          {/* Right: meal cards */}
          <div className="col-lg-8" style={{ marginBottom: 24 }}>
            {/* 2×2 fixed-size meal grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {MEALS.map(({ type, label, icon, color, gradient }) => {
                const meal = mealMap[type]
                const kcal = meal?.totals.kcal ?? 0
                const count = meal?.items.length ?? 0
                const hasData = count > 0
                const pct = Math.min(Math.round((kcal / (GOALS.kcal / 4)) * 100), 100)
                return (
                  <div key={type} style={{
                    background: hasData ? gradient : 'var(--color-bg-surface)',
                    borderRadius: 20,
                    padding: '18px 16px',
                    border: `1.5px solid ${hasData ? `${color}30` : 'var(--color-border-default)'}`,
                    boxShadow: 'var(--shadow-soft)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {icon}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>{label}</span>
                      </div>
                      <Link to={`/food/meal/${type}`}
                        style={{ fontSize: 12, fontWeight: 700, textDecoration: 'none', padding: '4px 12px', borderRadius: 999, background: hasData ? `${color}18` : 'var(--color-bg-soft)', color: hasData ? color : 'var(--color-text-muted)', border: `1px solid ${hasData ? `${color}35` : 'var(--color-border-default)'}` }}>
                        {hasData ? 'Edit' : '+ Add'}
                      </Link>
                    </div>

                    {hasData ? (
                      <>
                        <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                          {kcal.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>kcal</span>
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                          {count} item{count !== 1 ? 's' : ''} logged
                        </p>
                        <div style={{ background: `${color}20`, borderRadius: 999, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.6s ease' }} />
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                        Tap "+ Add" to log your {label.toLowerCase()}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Daily tip */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              border: '1px solid rgba(52, 204, 149, 0.2)',
              borderRadius: 16, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{tip.icon}</span>
              <p style={{ margin: 0, fontSize: 13, color: '#065f46', fontWeight: 600, lineHeight: 1.5 }}>{tip.text}</p>
            </div>
          </div>

        </div>

        {/* Quick-add food category shortcuts */}
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Browse by Category
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Grains', icon: '🌾', color: '#d97706', bg: '#fffbeb' },
              { label: 'Protein', icon: '🥩', color: '#dc2626', bg: '#fef2f2' },
              { label: 'Vegetables', icon: '🥦', color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Fruits', icon: '🍎', color: '#ea580c', bg: '#fff7ed' },
              { label: 'Dairy', icon: '🥛', color: '#2563eb', bg: '#eff6ff' },
              { label: 'Seafood', icon: '🐟', color: '#0891b2', bg: '#ecfeff' },
              { label: 'Beverages', icon: '🥤', color: '#7c3aed', bg: '#faf5ff' },
            ].map(({ label, icon, color, bg }) => (
              <Link
                key={label}
                to={`/food/meal/snack`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 999, textDecoration: 'none',
                  background: bg, border: `1.5px solid ${color}30`,
                  color, fontSize: 13, fontWeight: 700,
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 16 }}>{icon}</span> {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
