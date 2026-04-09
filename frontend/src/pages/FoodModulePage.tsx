import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary } from '../lib/food/api'
import type { DaySummary, FoodMealType } from '../lib/food/types_runtime'
import { useAuth } from '../state/auth-context'
import AppButton from '../components/ui/AppButton'
import '../styles/food-module.css'

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
          <div className="cl_blog-widget mb-30 food-module-hero">
            <div className="food-module-hero-grid">
              <div className="food-module-hero-copy">
                <div className="food-module-hero-eyebrow">AI-FIT Food Tracker</div>
                <h3 className="food-module-hero-title">Track meals and nutrition in one place.</h3>
                <p className="food-module-hero-desc">
                  Build breakfast, lunch, dinner, and snacks inside AI-FIT. Keep daily nutrition totals visible, save each meal by time of day, and use image recognition when you want a faster entry flow.
                </p>
              </div>
              <div className="food-module-hero-side">
                <div className="food-module-hero-status">
                  {auth.user ? `${completedMeals} meals saved today` : 'Login to load today summary'}
                </div>
                <div className="food-module-hero-actions">
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
                <div className="food-module-overview-head">
                  <div>
                    <h4 className="cl_blog-widget-title mb-15">Today Overview</h4>
                    <p className="food-module-overview-sub">
                      Start from a meal below. Breakfast, lunch, dinner, and snack all feed into the same daily nutrition summary.
                    </p>
                  </div>
                  <div className="food-module-overview-actions">
                    <Link to="/food/meal/lunch" className="cl_theme-btn">
                      Open Lunch
                    </Link>
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
                        <div className="food-module-metric-label">Calories</div>
                        <div className="food-module-metric-value">{formatMetric(totals.kcal, 'kcal')}</div>
                      </div>
                      <div className="food-module-metric food-module-metric--protein">
                        <div className="food-module-metric-label">Protein</div>
                        <div className="food-module-metric-value">{formatMetric(totals.protein, 'g')}</div>
                      </div>
                      <div className="food-module-metric food-module-metric--fat">
                        <div className="food-module-metric-label">Fat</div>
                        <div className="food-module-metric-value">{formatMetric(totals.fat, 'g')}</div>
                      </div>
                      <div className="food-module-metric food-module-metric--carbs">
                        <div className="food-module-metric-label">Carbs</div>
                        <div className="food-module-metric-value">{formatMetric(totals.carbs, 'g')}</div>
                      </div>
                    </div>

                    <div className="food-module-meals">
                      {mealCards.map((meal) => {
                        const currentMeal = findMeal(summary, meal.type)
                        return (
                          <div key={meal.type} className="food-module-meal-card">
                            <div className="food-module-meal-accent" style={{ background: meal.accent }} />
                            <div className="food-module-meal-head">
                              <div>
                                <div className="food-module-meal-title">{meal.label}</div>
                                <div className="food-module-meal-note">{meal.note}</div>
                              </div>
                              <div className="food-module-meal-count">
                                {currentMeal ? `${currentMeal.items.length} items` : 'No record'}
                              </div>
                            </div>
                            <div className="food-module-meal-summary">
                              {currentMeal
                                ? `Current meal total: ${currentMeal.totals.kcal.toFixed(1)} kcal`
                                : 'No saved meal yet. Open this slot to add foods and save the formal record.'}
                            </div>
                            <div className="food-module-meal-actions">
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
