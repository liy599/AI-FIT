import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary } from '../lib/food/api'
import type { DaySummary, FoodMealType } from '../lib/food/types_runtime'
import { useAuth } from '../state/auth-context'

const mealCards: Array<{ type: FoodMealType; label: string; note: string; accent: string }> = [
  {
    type: 'breakfast',
    label: 'Breakfast',
    note: 'Open the first meal quickly and keep the morning intake structured.',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)'
  },
  {
    type: 'lunch',
    label: 'Lunch',
    note: 'Track the midday meal with fast search, recognition, and save flow.',
    accent: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)'
  },
  {
    type: 'dinner',
    label: 'Dinner',
    note: 'Review the evening meal totals before committing the formal record.',
    accent: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
  },
  {
    type: 'snack',
    label: 'Snack',
    note: 'Keep add-on foods separate so the main meals stay clean.',
    accent: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
  }
]

function formatMetric(value: number | undefined, unit: string) {
  if (value == null) return `-- ${unit}`
  return `${value.toFixed(1)} ${unit}`
}

function findMeal(summary: DaySummary | null, mealType: FoodMealType) {
  return summary?.meals.find((meal) => meal.mealType === mealType) ?? null
}

function isAuthErrorMessage(message: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('authorization') ||
    normalized.includes('token has expired') ||
    normalized.includes('jwt') ||
    normalized.includes('signature verification failed')
  )
}

export default function FoodModulePage() {
  const auth = useAuth()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const summaryAuthError = isAuthErrorMessage(error)

  useEffect(() => {
    let cancelled = false
    if (!auth.user) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError(null)
    getTodaySummary()
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load food summary')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [auth.user])

  const totals = useMemo(
    () =>
      summary?.totals ?? {
        kcal: 0,
        carbs: 0,
        protein: 0,
        fat: 0
      },
    [summary]
  )

  const completedMeals = useMemo(() => summary?.meals.length ?? 0, [summary])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Food Module</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Food Module</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div
            className="cl_blog-widget mb-30"
            style={{
              background: 'linear-gradient(135deg, #0f766e 0%, #10b981 55%, #34d399 100%)',
              color: '#fff',
              border: 'none',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 700 }}>
                <div style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.82 }}>
                  AI-FIT Food Tracker
                </div>
                <h3 style={{ fontSize: 42, lineHeight: 1.08, marginTop: 12, marginBottom: 14 }}>Track meals and nutrition in one place.</h3>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.88)', maxWidth: 620 }}>
                  Build breakfast, lunch, dinner, and snacks inside AI-FIT. Keep daily nutrition totals visible, save each meal by time of day, and use image recognition when you want a faster entry flow.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 260 }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.16)',
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  {auth.user ? `${completedMeals} meals saved today` : 'Login to load today summary'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link to="/food/meal/lunch" className="cl_theme-btn">
                    Open Lunch
                  </Link>
                  <Link to="/food/meal/dinner" className="cl_theme-btn">
                    Open Dinner
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="cl_blog-widget mb-30">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h4 className="cl_blog-widget-title mb-15">Today Overview</h4>
                    <p style={{ marginBottom: 0, color: '#64748b' }}>
                      Start from a meal below. Breakfast, lunch, dinner, and snack all feed into the same daily nutrition summary.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/food/meal/lunch" className="cl_theme-btn">
                      Open Lunch
                    </Link>
                  </div>
                </div>

                {!auth.user ? (
                  <div style={{ marginTop: 22, padding: 20, borderRadius: 18, background: '#f8fafc' }}>
                    <h6 className="sub-title mb-10">Login Required</h6>
                    <p style={{ marginBottom: 14, color: '#64748b' }}>
                      Meals are bound to the formal user account. Login first to load today&apos;s summary and continue editing meals.
                    </p>
                    <Link to="/login" className="cl_theme-btn">
                      Go Login
                    </Link>
                  </div>
                ) : loading ? (
                  <div style={{ marginTop: 22, color: '#64748b' }}>Loading today&apos;s summary...</div>
                ) : error ? (
                  <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
                    <div style={{ borderRadius: 16, background: '#fef2f2', color: '#b91c1c', padding: '14px 16px' }}>{error}</div>
                    {summaryAuthError ? (
                      <div style={{ padding: 20, borderRadius: 18, background: '#f8fafc' }}>
                        <h6 className="sub-title mb-10">Login Expired</h6>
                        <p style={{ marginBottom: 14, color: '#64748b' }}>
                          The current session could not load today&apos;s meal summary. Re-login to continue with formal meal records.
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <Link to="/login" className="cl_theme-btn">
                            Go Login
                          </Link>
                          <button type="button" className="cl_theme-btn" onClick={auth.logout}>
                            Clear Session
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 14,
                        marginTop: 22
                      }}
                    >
                      <div style={{ padding: 18, borderRadius: 18, background: '#fff7ed' }}>
                        <div style={{ color: '#9a3412', fontSize: 13 }}>Calories</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#7c2d12', marginTop: 6 }}>
                          {formatMetric(totals.kcal, 'kcal')}
                        </div>
                      </div>
                      <div style={{ padding: 18, borderRadius: 18, background: '#eff6ff' }}>
                        <div style={{ color: '#1d4ed8', fontSize: 13 }}>Protein</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a', marginTop: 6 }}>
                          {formatMetric(totals.protein, 'g')}
                        </div>
                      </div>
                      <div style={{ padding: 18, borderRadius: 18, background: '#fefce8' }}>
                        <div style={{ color: '#a16207', fontSize: 13 }}>Fat</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#854d0e', marginTop: 6 }}>
                          {formatMetric(totals.fat, 'g')}
                        </div>
                      </div>
                      <div style={{ padding: 18, borderRadius: 18, background: '#f0fdf4' }}>
                        <div style={{ color: '#15803d', fontSize: 13 }}>Carbs</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#166534', marginTop: 6 }}>
                          {formatMetric(totals.carbs, 'g')}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 16,
                        marginTop: 24
                      }}
                    >
                      {mealCards.map((meal) => {
                        const currentMeal = findMeal(summary, meal.type)
                        return (
                          <div
                            key={meal.type}
                            style={{
                              border: '1px solid rgba(148, 163, 184, 0.18)',
                              borderRadius: 20,
                              padding: 20,
                              background: '#fff',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              minHeight: 320
                            }}
                          >
                            <div
                              style={{
                                height: 10,
                                borderRadius: 999,
                                background: meal.accent,
                                marginBottom: 16
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', minHeight: 82 }}>
                              <div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{meal.label}</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{meal.note}</div>
                              </div>
                              <div style={{ minWidth: 76, textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                                {currentMeal ? `${currentMeal.items.length} items` : 'No record'}
                              </div>
                            </div>
                            <div style={{ marginTop: 16, color: '#334155', fontSize: 14, flex: 1 }}>
                              {currentMeal
                                ? `Current meal total: ${currentMeal.totals.kcal.toFixed(1)} kcal`
                                : 'No saved meal yet. Open this slot to add foods and save the formal record.'}
                            </div>
                            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <Link to={`/food/meal/${meal.type}`} className="cl_theme-btn">
                                Open {meal.label}
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
