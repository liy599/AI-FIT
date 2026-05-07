import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary, type DaySummary, type FoodMealType } from '../../modules/food'
import { useAuth } from '../../state/auth-context'
import AppButton from '../../components/ui/AppButton'
import '../../styles/food-module.css'

const mealCards: Array<{ type: FoodMealType; label: string; note: string; accent: string; imageSrc: string }> = [
  {
    type: 'breakfast',
    label: 'Breakfast',
    note: 'Open the first meal quickly and keep the morning intake structured.',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    imageSrc: '/assets/images/food/breakfast.jpg'
  },
  {
    type: 'lunch',
    label: 'Lunch',
    note: 'Track the midday meal with fast search, recognition, and save flow.',
    accent: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)',
    imageSrc: '/assets/images/food/lunch.jpg'
  },
  {
    type: 'dinner',
    label: 'Dinner',
    note: 'Review the evening meal totals before committing the formal record.',
    accent: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    imageSrc: '/assets/images/food/dinner.jpg'
  },
  {
    type: 'snack',
    label: 'Snack',
    note: 'Keep add-on foods separate so the main meals stay clean.',
    accent: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    imageSrc: '/assets/images/food/snack.jpg'
  }
]

function formatMetricParts(value: number | undefined, unit: string) {
  if (value == null) return { numberText: '--', unitText: unit }
  return { numberText: value.toFixed(1), unitText: unit }
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
  const nextMeal = useMemo(() => {
    if (!summary) return mealCards[1]
    for (const meal of mealCards) {
      if (!findMeal(summary, meal.type)) return meal
    }
    return mealCards[0]
  }, [summary])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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
        <div className="page-container">
          <div className="cl_blog-widget mb-30 food-module-hero">
            <div className="food-module-hero-grid">
              <div className="food-module-hero-copy">
                <div className="food-module-hero-eyebrow">AI-FIT</div>
                <h3 className="food-module-hero-title">AI-FIT Food Tracker</h3>
                <div className="food-module-hero-subtitle">Track meals and nutrition in one place.</div>
                <p className="food-module-hero-desc">
                  Build breakfast, lunch, dinner, and snacks inside AI-FIT. Keep daily nutrition totals visible, save each meal by time of day, and use image recognition when you want a faster entry flow.
                </p>
              </div>
              <div className="food-module-hero-side">
                <div className="food-module-hero-status-badge">
                  <div className="food-module-hero-status-icon">{auth.user ? 'OK' : 'LOCK'}</div>
                  <div className="food-module-hero-status-copy">
                    <div className="food-module-hero-status-title">{auth.user ? 'Saved Today' : 'Login Required'}</div>
                    <div className="food-module-hero-status-value">{auth.user ? `${completedMeals} meal${completedMeals === 1 ? '' : 's'}` : 'View today summary'}</div>
                  </div>
                </div>
                <div className="food-module-hero-actions">
                  {auth.user ? (
                    <Link to={`/food/meal/${nextMeal.type}`} className="cl_theme-btn">
                      Continue {nextMeal.label}
                    </Link>
                  ) : (
                    <Link to="/login" className="cl_theme-btn">
                      Go Login
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="cl_blog-widget mb-30">
                <div className="food-module-overview-head">
                  <div>
                    <h4 className="cl_blog-widget-title mb-15">Today Overview</h4>
                    <p className="food-module-overview-sub">
                      Start from a meal below. Breakfast, lunch, dinner, and snack all feed into the same daily nutrition summary.
                    </p>
                  </div>
                  <div className="food-module-overview-actions">
                    {auth.user ? (
                      <Link to={`/food/meal/${nextMeal.type}`} className="cl_theme-btn">
                        Continue {nextMeal.label}
                      </Link>
                    ) : (
                      <Link to="/login" className="cl_theme-btn">
                        Go Login
                      </Link>
                    )}
                  </div>
                </div>

                {!auth.user ? (
                  <div className="food-module-login-card">
                    <h6 className="sub-title mb-10">Login Required</h6>
                    <p className="food-module-overview-sub mb-15">
                      Meals are bound to the formal user account. Login first to load today&apos;s summary and continue editing meals.
                    </p>
                    <Link to="/login" className="cl_theme-btn">
                      Go Login
                    </Link>
                  </div>
                ) : loading ? (
                  <div className="food-module-loading">Loading today&apos;s summary...</div>
                ) : error ? (
                  <div className="food-module-error-wrap">
                    <div className="food-module-error">{error}</div>
                    {summaryAuthError ? (
                      <div className="food-module-auth-expired-card">
                        <h6 className="sub-title mb-10">Login Expired</h6>
                        <p className="food-module-overview-sub mb-15">
                          The current session could not load today&apos;s meal summary. Re-login to continue with formal meal records.
                        </p>
                        <div className="food-module-auth-actions">
                          <Link to="/login" className="cl_theme-btn">
                            Go Login
                          </Link>
                          <AppButton type="button" variant="brand" onClick={auth.logout}>
                            Clear Session
                          </AppButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="food-module-metrics">
                      <div className="food-module-metric food-module-metric--calories">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🔥</span> Calories
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.kcal, 'kcal').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.kcal, 'kcal').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--protein">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">💪</span> Protein
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.protein, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.protein, 'g').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--fat">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🥑</span> Fat
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.fat, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.fat, 'g').unitText}</span>
                        </div>
                      </div>
                      <div className="food-module-metric food-module-metric--carbs">
                        <div className="food-module-metric-label">
                          <span className="food-module-metric-icon">🍚</span> Carbs
                        </div>
                        <div className="food-module-metric-value">
                          <span className="food-module-metric-number">{formatMetricParts(totals.carbs, 'g').numberText}</span>
                          <span className="food-module-metric-unit">{formatMetricParts(totals.carbs, 'g').unitText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="food-module-meals">
                      {mealCards.map((meal) => {
                        const currentMeal = findMeal(summary, meal.type)
                        const hasRecord = Boolean(currentMeal)
                        const itemCount = currentMeal?.items.length ?? 0
                        return (
                          <div key={meal.type} className="food-module-meal-card">
                            <div className={`food-module-meal-accent food-module-meal-accent--${meal.type}`} />
                            <div className="food-module-meal-visual" aria-hidden="true">
                              <img className="food-module-meal-image" src={meal.imageSrc} alt={meal.label} loading="lazy" />
                            </div>
                            <div className="food-module-meal-head">
                              <div>
                                <div className="food-module-meal-title">{meal.label}</div>
                                <div className="food-module-meal-note">{meal.note}</div>
                              </div>
                              <div className="food-module-meal-meta">
                                {hasRecord ? (
                                  <>
                                    <span className="food-module-badge food-module-badge--success">✓ Saved</span>
                                    <span className="food-module-badge">{itemCount} items</span>
                                  </>
                                ) : (
                                  <span className="food-module-badge food-module-badge--muted">○ No record</span>
                                )}
                              </div>
                            </div>
                            <div className="food-module-meal-actions">
                              <Link to={`/food/meal/${meal.type}`} className="cl_theme-btn food-module-btn-pill">
                                {hasRecord ? `Continue ${meal.label}` : `Open ${meal.label}`}
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
      </section>
    </>
  )
}

