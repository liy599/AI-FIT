import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getTodaySummary } from '../../lib/food/api'
import type { DaySummary } from '../../lib/food/types_runtime'

export default function FoodModulePage() {
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getTodaySummary().then(setSummary).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load meals')) }, [])
  return <section className="pt-100 pb-100"><div className="container">
    <div className="cl_blog-widget mb-30">
      <h1 className="cl_blog-widget-title">Food and Nutrition</h1>
      <p>Search foods, build meals, and keep daily nutrition totals in your AI-FIT account.</p>
      {error ? <p>{error}</p> : null}
      {summary ? <p>Today: {summary.totals.kcal.toFixed(0)} kcal, {summary.meals.length} meals saved.</p> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => <Link className="cl_theme-btn" key={type} to={`/food/meal/${type}`}>{type}</Link>)}
      </div>
    </div>
  </div></section>
}
