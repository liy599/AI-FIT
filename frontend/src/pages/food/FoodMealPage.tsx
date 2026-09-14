import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFoods, getFoodsBulk, getTodaySummary, recognizeFoods, saveMeal } from '../../lib/food/api'
import type { FoodItem, FoodMealType } from '../../lib/food/types_runtime'
import { useAuth } from '../../state/auth-context'

export default function FoodMealPage() {
  const { mealType } = useParams()
  const auth = useAuth()
  const type = mealType as FoodMealType
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [message, setMessage] = useState('')
  useEffect(() => {
    getFoods().then(setFoods).catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Unable to load foods'))
    if (auth.user) getTodaySummary().then((summary) => {
      const meal = summary.meals.find((item) => item.mealType === type)
      if (meal) setSelected(Object.fromEntries(meal.items.map((item) => [item.foodId, item.grams])))
    }).catch(() => {})
  }, [auth.user, type])
  const visible = useMemo(() => foods.filter((food) => `${food.displayName} ${food.name}`.toLowerCase().includes(query.toLowerCase())), [foods, query])
  const totals = useMemo(() => Object.entries(selected).reduce((sum, [id, grams]) => {
    const food = foods.find((item) => item.id === Number(id)); const factor = grams / 100
    return sum + (food?.calories ?? 0) * factor
  }, 0), [foods, selected])
  async function recognize(file: File) {
    const result = await recognizeFoods(file); const matched = await getFoodsBulk(result.foodIds)
    setSelected((old) => ({ ...old, ...Object.fromEntries(matched.map((food) => [food.id, 100])) }))
    setMessage(result.unmatchedNames.length ? `Unmatched: ${result.unmatchedNames.join(', ')}` : 'Foods added from image.')
  }
  async function save() {
    if (!auth.user) { setMessage('Please sign in to save meals.'); return }
    await saveMeal(type, Object.entries(selected).map(([foodId, grams]) => ({ foodId: Number(foodId), grams })))
    setMessage('Meal saved.')
  }
  return <section className="pt-100 pb-100"><div className="container"><div className="cl_blog-widget">
    <Link to="/food">Food</Link><h1 className="cl_blog-widget-title">{type} meal</h1>
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" />
    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && recognize(e.target.files[0]).catch((err: unknown) => setMessage(err instanceof Error ? err.message : 'Recognition failed'))} />
    <p>{totals.toFixed(0)} kcal</p>
    <div className="row">{visible.map((food) => <div className="col-md-4 col-sm-6" key={food.id}>
      <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
        {food.imageUrl ? <img src={food.imageUrl} alt={food.displayName} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} /> : null}
        <input type="checkbox" checked={food.id in selected} onChange={() => setSelected((old) => { const next = { ...old }; if (food.id in next) delete next[food.id]; else next[food.id] = 100; return next })} /> {food.displayName} ({food.calories} kcal/100g)
      </label>
    </div>)}</div>
    <button className="cl_theme-btn" onClick={() => save().catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Save failed'))}>Save meal</button>
    {message ? <p>{message}</p> : null}
  </div></div></section>
}
