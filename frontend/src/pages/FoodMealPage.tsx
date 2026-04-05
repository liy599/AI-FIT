import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deleteMeal, getFoods, getFoodsBulk, getTodaySummary, recognizeFoods, saveMeal } from '../lib/food/api'
import type { FoodItem, FoodMealType } from '../lib/food/types_runtime'
import { useAuth } from '../state/auth-context'

type CartItem = {
  food: FoodItem
  grams: number
}

type RecognitionSummary = {
  fileName: string
  recognizedNames: string[]
  matchedNames: string[]
  unmatchedNames: string[]
}

const mealTitles: Record<FoodMealType, { title: string; note: string; accent: string }> = {
  breakfast: {
    title: 'Breakfast',
    note: 'Start with a clean first meal and keep the morning intake visible.',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)'
  },
  lunch: {
    title: 'Lunch',
    note: 'Build the midday meal with fast selection, image recognition, and formal save.',
    accent: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)'
  },
  dinner: {
    title: 'Dinner',
    note: 'Review evening intake with a structured draft before saving into today.',
    accent: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
  },
  snack: {
    title: 'Snack',
    note: 'Track add-on foods separately so the main meals stay clean.',
    accent: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
  }
}

const quickGramSteps = [50, 100, 150, 200]

function isMealType(value: string | undefined): value is FoodMealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
}

function calcTotals(cart: Record<number, CartItem>) {
  let kcal = 0
  let protein = 0
  let fat = 0
  let carbs = 0
  for (const item of Object.values(cart)) {
    const factor = item.grams / 100
    kcal += item.food.calories * factor
    protein += item.food.protein * factor
    fat += item.food.fat * factor
    carbs += item.food.carbs * factor
  }
  return {
    kcal: Number(kcal.toFixed(2)),
    protein: Number(protein.toFixed(2)),
    fat: Number(fat.toFixed(2)),
    carbs: Number(carbs.toFixed(2))
  }
}

function formatMacro(value: number, unit: string) {
  return `${value.toFixed(1)} ${unit}`
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

export default function FoodMealPage() {
  const params = useParams()
  const auth = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const routeMealType = isMealType(params.mealType) ? params.mealType : null
  const mealType = routeMealType ?? 'lunch'
  const meal = mealTitles[mealType]

  const [foods, setFoods] = useState<FoodItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<Record<number, CartItem>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedMealId, setSavedMealId] = useState<number | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeHint, setRecognizeHint] = useState<string | null>(null)
  const [successHint, setSuccessHint] = useState<string | null>(null)
  const [recognitionSummary, setRecognitionSummary] = useState<RecognitionSummary | null>(null)
  const authError = isAuthErrorMessage(error)

  useEffect(() => {
    let cancelled = false
    if (!routeMealType) {
      setLoading(false)
      setError('Invalid meal type')
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setError(null)
    setSuccessHint(null)
    Promise.all([getFoods({ limit: 300 }), auth.user ? getTodaySummary() : Promise.resolve(null)])
      .then(([foodItems, summary]) => {
        if (cancelled) return
        setFoods(foodItems)
        if (summary) {
          const existingMeal = summary.meals.find((item) => item.mealType === mealType) ?? null
          setSavedMealId(existingMeal?.id ?? null)
          if (existingMeal) {
            const nextCart: Record<number, CartItem> = {}
            for (const item of existingMeal.items) {
              if (!item.food) continue
              nextCart[item.food.id] = {
                food: item.food,
                grams: item.grams
              }
            }
            setCart(nextCart)
          } else {
            setCart({})
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load meal editor')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [auth.user, mealType, routeMealType])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(foods.map((item) => item.category)))
    return ['all', ...unique]
  }, [foods])

  const filteredFoods = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return foods.filter((item) => {
      const inCategory = selectedCategory === 'all' ? true : item.category === selectedCategory
      if (!inCategory) return false
      if (!normalized) return true
      return (
        item.displayName.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized) ||
        item.aliases.some((alias) => alias.toLowerCase().includes(normalized))
      )
    })
  }, [foods, query, selectedCategory])

  const selectedItems = useMemo(() => Object.values(cart), [cart])
  const totals = useMemo(() => calcTotals(cart), [cart])
  const selectedCount = selectedItems.length

  function toggleFood(food: FoodItem) {
    setError(null)
    setSuccessHint(null)
    setCart((prev) => {
      const next = { ...prev }
      if (next[food.id]) {
        delete next[food.id]
      } else {
        next[food.id] = { food, grams: 100 }
      }
      return next
    })
  }

  function updateGrams(foodId: number, grams: number) {
    setCart((prev) => {
      const current = prev[foodId]
      if (!current) return prev
      return {
        ...prev,
        [foodId]: {
          ...current,
          grams: Math.max(1, Math.round(grams))
        }
      }
    })
  }

  function removeFood(foodId: number) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[foodId]
      return next
    })
  }

  async function handleRecognize(file: File) {
    setError(null)
    setSuccessHint(null)
    setRecognizeHint(null)
    setRecognizing(true)
    try {
      const result = await recognizeFoods(file)
      setRecognitionSummary({
        fileName: file.name,
        recognizedNames: result.names,
        matchedNames: [],
        unmatchedNames: result.unmatchedNames
      })
      if (result.foodIds.length === 0) {
        setRecognizeHint(result.unmatchedNames.length ? `Unmatched: ${result.unmatchedNames.join(', ')}` : 'No food matched.')
        return
      }
      const recognizedItems = await getFoodsBulk(result.foodIds)
      const matchedNames = recognizedItems.map((item) => item.displayName)
      setRecognitionSummary({
        fileName: file.name,
        recognizedNames: result.names,
        matchedNames,
        unmatchedNames: result.unmatchedNames
      })
      setCart((prev) => {
        const next = { ...prev }
        for (const item of recognizedItems) {
          if (!next[item.id]) {
            next[item.id] = { food: item, grams: 100 }
          }
        }
        return next
      })
      setSuccessHint(`Added ${recognizedItems.length} food item(s) from image recognition.`)
      if (result.unmatchedNames.length) {
        setRecognizeHint(`Partially matched. Unmatched: ${result.unmatchedNames.join(', ')}`)
      }
    } catch (err: unknown) {
      setRecognizeHint(err instanceof Error ? err.message : 'Recognize failed')
    } finally {
      setRecognizing(false)
    }
  }

  async function handleSave() {
    if (selectedCount === 0) {
      setError('Select at least one food before saving')
      return
    }
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      const saved = await saveMeal(
        mealType,
        selectedItems.map((item) => ({
          foodId: item.food.id,
          grams: item.grams
        }))
      )
      setSavedMealId(saved.id)
      setSuccessHint(`${meal.title} saved to today's formal meal record.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMeal() {
    if (!savedMealId) return
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      await deleteMeal(savedMealId)
      setSavedMealId(null)
      setCart({})
      setSuccessHint(`${meal.title} meal record deleted.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  function clearDraft() {
    setCart({})
    setError(null)
    setSuccessHint(null)
  }

  if (!routeMealType) {
    return (
      <>
        <section className="cl_breadcrumb-area">
          <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-md-9 col-12">
                  <div className="cl_breadcrumb-content">
                    <h2 className="cl_breadcrumb-content-title">Invalid Meal Slot</h2>
                    <div className="cl_breadcrumb-content-list">
                      <Link to="/">Home</Link>
                      <Link to="/food">Food Module</Link>
                      <span>Invalid Meal Slot</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-100 pb-100">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-9">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title mb-20">Route Not Supported</h4>
                  <p style={{ color: '#64748b', marginBottom: 18 }}>
                    This meal route is not part of the formal food flow. Use breakfast, lunch, dinner, or snack.
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/food" className="cl_theme-btn">
                      Back to Food
                    </Link>
                    <Link to="/food/meal/lunch" className="cl_theme-btn">
                      Open Lunch
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">{meal.title}</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to="/food">Food Module</Link>
                    <span>{meal.title}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          {!auth.user ? (
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-9">
                <div className="cl_blog-widget">
                  <h4 className="cl_blog-widget-title mb-20">{meal.title} Editor</h4>
                  <p style={{ color: '#64748b', marginBottom: 18 }}>
                    Meal records are now bound to the formal AI-FIT account. Login first to continue.
                  </p>
                  <Link to="/login" className="cl_theme-btn">
                    Go Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-xl-8 col-lg-7">
                <div
                  className="cl_blog-widget mb-30"
                  style={{
                    background: meal.accent,
                    color: '#fff',
                    border: 'none',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: 620 }}>
                      <div style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.78 }}>
                        Formal Meal Editor
                      </div>
                      <h3 style={{ fontSize: 34, lineHeight: 1.15, marginTop: 10, marginBottom: 12 }}>{meal.title}</h3>
                      <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.86)' }}>{meal.note}</p>
                    </div>
                    <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.18)',
                          fontSize: 13
                        }}
                      >
                        {savedMealId ? `Saved meal #${savedMealId}` : 'Draft not saved'}
                      </div>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.18)',
                          fontSize: 13
                        }}
                      >
                        {selectedCount} selected / {filteredFoods.length} visible
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cl_blog-widget mb-30">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h4 className="cl_blog-widget-title mb-15">Select Foods</h4>
                      <p style={{ color: '#64748b', marginBottom: 0 }}>
                        Search the formal food library, filter by category, or add foods from image recognition.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={recognizing}
                      style={{
                        width: '100%',
                        borderRadius: 22,
                        border: '1.5px dashed rgba(15, 118, 110, 0.35)',
                        background: recognizing ? '#f0fdfa' : 'linear-gradient(180deg, #f8fffd 0%, #ecfdf5 100%)',
                        padding: '26px 24px',
                        textAlign: 'left',
                        display: 'grid',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                            {recognizing ? 'Recognizing image...' : 'Upload an image to recognize foods'}
                          </div>
                          <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
                            Click to choose a photo. We will identify foods and add matched items into the current meal draft.
                          </div>
                        </div>
                        <div
                          style={{
                            minHeight: 42,
                            padding: '0 18px',
                            borderRadius: 999,
                            background: '#10b981',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700
                          }}
                        >
                          {recognizing ? 'Recognizing...' : 'Choose Image'}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#0f766e' }}>
                        JPG, PNG, or other common image formats are supported.
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void handleRecognize(file)
                      }}
                    />

                    {recognitionSummary ? (
                      <div
                        style={{
                          borderRadius: 18,
                          background: '#f8fafc',
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                          padding: 18,
                          display: 'grid',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Latest Recognition</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{recognitionSummary.fileName}</div>
                          </div>
                          <div style={{ fontSize: 13, color: '#475569' }}>
                            {recognitionSummary.matchedNames.length} matched / {recognitionSummary.unmatchedNames.length} unmatched
                          </div>
                        </div>

                        {recognitionSummary.recognizedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Recognized labels</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.recognizedNames.map((name) => (
                                <span
                                  key={`recognized-${name}`}
                                  style={{
                                    borderRadius: 999,
                                    background: '#e2e8f0',
                                    color: '#334155',
                                    padding: '6px 10px',
                                    fontSize: 12
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {recognitionSummary.matchedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Added to meal draft</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.matchedNames.map((name) => (
                                <span
                                  key={`matched-${name}`}
                                  style={{
                                    borderRadius: 999,
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '6px 10px',
                                    fontSize: 12
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {recognitionSummary.unmatchedNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Needs manual selection</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {recognitionSummary.unmatchedNames.map((name) => (
                                <span
                                  key={`unmatched-${name}`}
                                  style={{
                                    borderRadius: 999,
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    padding: '6px 10px',
                                    fontSize: 12
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search foods in Chinese or English"
                      style={{
                        width: '100%',
                        minHeight: 52,
                        borderRadius: 16,
                        border: '1px solid rgba(148, 163, 184, 0.28)',
                        padding: '0 16px'
                      }}
                    />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {categories.map((category) => {
                        const active = selectedCategory === category
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            style={{
                              border: active ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.24)',
                              background: active ? '#ecfeff' : '#fff',
                              color: active ? '#0f766e' : '#475569',
                              minHeight: 40,
                              padding: '0 14px',
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 600
                            }}
                          >
                            {category === 'all' ? 'All Categories' : category}
                          </button>
                        )
                      })}
                    </div>

                    {authError ? (
                      <div style={{ borderRadius: 14, background: '#fff7ed', color: '#9a3412', padding: '14px 16px' }}>
                        Your login session is no longer valid for meal records. Re-login before saving or loading this meal.
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                          <Link to="/login" className="cl_theme-btn">
                            Go Login
                          </Link>
                          <button type="button" className="cl_theme-btn" onClick={auth.logout}>
                            Clear Session
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {recognizeHint ? (
                      <div style={{ borderRadius: 14, background: '#ecfeff', color: '#0f766e', padding: '12px 14px' }}>
                        {recognizeHint}
                      </div>
                    ) : null}
                    {successHint ? (
                      <div style={{ borderRadius: 14, background: '#f0fdf4', color: '#166534', padding: '12px 14px' }}>
                        {successHint}
                      </div>
                    ) : null}
                    {error ? (
                      <div style={{ borderRadius: 14, background: '#fef2f2', color: '#b91c1c', padding: '12px 14px' }}>
                        {error}
                      </div>
                    ) : null}
                    {loading ? <div style={{ color: '#64748b' }}>Loading foods...</div> : null}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 14
                      }}
                    >
                      {filteredFoods.map((food) => {
                        const selected = Boolean(cart[food.id])
                        return (
                          <button
                            key={food.id}
                            type="button"
                            onClick={() => toggleFood(food)}
                            style={{
                              border: selected ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.24)',
                              background: selected ? '#f0fdfa' : '#fff',
                              borderRadius: 18,
                              padding: 18,
                              textAlign: 'left',
                              display: 'grid',
                              gap: 10,
                              boxShadow: selected ? '0 12px 24px rgba(15, 118, 110, 0.08)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                              <div>
                                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{food.displayName}</div>
                                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{food.name}</div>
                              </div>
                              <div
                                style={{
                                  minWidth: 72,
                                  textAlign: 'right',
                                  color: selected ? '#0f766e' : '#94a3b8',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  letterSpacing: '0.06em'
                                }}
                              >
                                {selected ? 'SELECTED' : 'ADD'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  borderRadius: 999,
                                  background: '#f8fafc',
                                  color: '#475569',
                                  padding: '6px 10px',
                                  fontSize: 12
                                }}
                              >
                                {food.category}
                              </span>
                              <span
                                style={{
                                  borderRadius: 999,
                                  background: '#fff7ed',
                                  color: '#c2410c',
                                  padding: '6px 10px',
                                  fontSize: 12
                                }}
                              >
                                {Math.round(food.calories)} kcal / 100g
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Protein</div>
                                <div style={{ marginTop: 2, fontWeight: 700, color: '#0f172a' }}>{food.protein.toFixed(1)}g</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Fat</div>
                                <div style={{ marginTop: 2, fontWeight: 700, color: '#0f172a' }}>{food.fat.toFixed(1)}g</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Carbs</div>
                                <div style={{ marginTop: 2, fontWeight: 700, color: '#0f172a' }}>{food.carbs.toFixed(1)}g</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      {!loading && foods.length === 0 ? (
                        <div style={{ color: '#64748b' }}>
                          The formal food library is currently empty. Check backend seed data and `/api/foods`.
                        </div>
                      ) : null}
                      {!loading && foods.length > 0 && filteredFoods.length === 0 ? (
                        <div style={{ color: '#64748b' }}>No foods matched the current filters.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-4 col-lg-5">
                <div className="cl_blog-widget">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <h4 className="cl_blog-widget-title mb-0">Meal Draft</h4>
                    {selectedCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearDraft}
                        style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 700 }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 12
                    }}
                  >
                    <div style={{ padding: 14, borderRadius: 16, background: '#f8fafc' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Selected foods</div>
                      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{selectedCount}</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 16, background: '#f8fafc' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Save state</div>
                      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                        {savedMealId ? 'Saved' : 'Draft'}
                      </div>
                    </div>
                  </div>

                  {selectedCount === 0 ? (
                    <div style={{ color: '#64748b', marginTop: 18 }}>
                      No food selected yet. Pick from the library or use image recognition to build the meal draft.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                      {selectedItems.map((item) => (
                        <div
                          key={item.food.id}
                          style={{
                            border: '1px solid rgba(148, 163, 184, 0.18)',
                            borderRadius: 18,
                            padding: 16,
                            background: '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.food.displayName}</div>
                              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                                {Math.round((item.food.calories * item.grams) / 100)} kcal current serving
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFood(item.food.id)}
                              style={{ color: '#b91c1c', background: 'transparent', border: 'none', fontWeight: 700 }}
                            >
                              Remove
                            </button>
                          </div>
                          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                            <input
                              type="number"
                              min={1}
                              value={item.grams}
                              onChange={(event) => {
                                const grams = Number(event.target.value)
                                if (Number.isFinite(grams) && grams > 0) updateGrams(item.food.id, grams)
                              }}
                              style={{
                                width: '100%',
                                minHeight: 46,
                                borderRadius: 14,
                                border: '1px solid rgba(148, 163, 184, 0.28)',
                                padding: '0 12px'
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {quickGramSteps.map((grams) => (
                                <button
                                  key={grams}
                                  type="button"
                                  onClick={() => updateGrams(item.food.id, grams)}
                                  style={{
                                    minHeight: 34,
                                    padding: '0 12px',
                                    borderRadius: 999,
                                    border: item.grams === grams ? '1px solid #0f766e' : '1px solid rgba(148, 163, 184, 0.22)',
                                    background: item.grams === grams ? '#ecfeff' : '#fff',
                                    color: item.grams === grams ? '#0f766e' : '#475569',
                                    fontSize: 12,
                                    fontWeight: 700
                                  }}
                                >
                                  {grams}g
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => updateGrams(item.food.id, item.grams + 25)}
                                style={{
                                  minHeight: 34,
                                  padding: '0 12px',
                                  borderRadius: 999,
                                  border: '1px solid rgba(148, 163, 184, 0.22)',
                                  background: '#fff',
                                  color: '#475569',
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                +25g
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 10
                      }}
                    >
                      <div style={{ padding: 12, borderRadius: 14, background: '#fff7ed' }}>
                        <div style={{ fontSize: 12, color: '#9a3412' }}>Calories</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#7c2d12' }}>{formatMacro(totals.kcal, 'kcal')}</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 14, background: '#eff6ff' }}>
                        <div style={{ fontSize: 12, color: '#1d4ed8' }}>Protein</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#1e3a8a' }}>{formatMacro(totals.protein, 'g')}</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 14, background: '#fefce8' }}>
                        <div style={{ fontSize: 12, color: '#a16207' }}>Fat</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#854d0e' }}>{formatMacro(totals.fat, 'g')}</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 14, background: '#f0fdf4' }}>
                        <div style={{ fontSize: 12, color: '#15803d' }}>Carbs</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#166534' }}>{formatMacro(totals.carbs, 'g')}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                      <button
                        type="button"
                        className="cl_theme-btn"
                        onClick={() => void handleSave()}
                        disabled={busy || selectedCount === 0}
                      >
                        {busy ? 'Saving...' : 'Save Meal'}
                      </button>
                      {savedMealId ? (
                        <button
                          type="button"
                          className="cl_theme-btn"
                          onClick={() => void handleDeleteMeal()}
                          disabled={busy}
                        >
                          Delete Meal
                        </button>
                      ) : null}
                      <Link to="/food" className="cl_theme-btn">
                        Back to Module
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
